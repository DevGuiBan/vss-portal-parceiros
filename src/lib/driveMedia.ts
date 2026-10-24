/**
 * Helpers for working with Google Drive media URLs uploaded by the portal.
 *
 * Files uploaded through `portal-api` are stored on Drive with "anyone with
 * the link" permission. We store their canonical URL as
 * `https://lh3.googleusercontent.com/d/{id}` — that works for images, but
 * the browser cannot stream video from it. For videos we need either the
 * Drive iframe preview or the thumbnail endpoint (which returns a poster
 * frame that IS embeddable).
 */

const DRIVE_PATTERNS: RegExp[] = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/uc\?[^ ]*id=([a-zA-Z0-9_-]+)/,
  /docs\.google\.com\/[^/]+\/d\/([a-zA-Z0-9_-]+)/,
  /lh\d+\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  /googleusercontent\.com\/[^ ]*\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/thumbnail\?[^ ]*id=([a-zA-Z0-9_-]+)/,
];

export function extractDriveFileId(raw?: string | null): string | null {
  const url = (raw || "").trim();
  if (!url) return null;
  for (const re of DRIVE_PATTERNS) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Poster/thumbnail URL that works for both images and videos on Drive. */
export function driveThumbnailUrl(fileIdOrUrl: string, size = 800): string | null {
  const id = extractDriveFileId(fileIdOrUrl) || fileIdOrUrl;
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/** Iframe URL that plays videos inline (respects anyone-with-link permission). */
export function drivePreviewUrl(fileIdOrUrl: string): string | null {
  const id = extractDriveFileId(fileIdOrUrl) || fileIdOrUrl;
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

/**
 * URL de streaming direta servida pela edge function `media-proxy`.
 * É a mesma URL enviada à Infobip no cabeçalho do template, então a
 * pré-visualização mostra exatamente o arquivo que será disparado
 * (o link `lh3.googleusercontent.com/d/{id}` devolve só um frame do vídeo).
 */
export function driveStreamUrl(fileIdOrUrl: string, ext = "mp4"): string | null {
  const id = extractDriveFileId(fileIdOrUrl);
  if (!id) return null;
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return null;
  return `${base}/functions/v1/media-proxy/${id}.${ext}`;
}

export function isVideoMedia(mimeType?: string | null, fileName?: string | null, url?: string | null): boolean {
  if (mimeType && mimeType.toLowerCase().startsWith("video/")) return true;
  const check = (s?: string | null) => !!s && /\.(mp4|webm|mov|m4v|ogv|mkv|avi)(\?|#|$)/i.test(s);
  return check(fileName) || check(url);
}

/** Extensão do arquivo a partir do nome/mime, com fallback por tipo. */
export function mediaExtension(
  mimeType?: string | null,
  fileName?: string | null,
  url?: string | null,
): string {
  const fromName = (fileName || url || "").match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  const mt = (mimeType || "").toLowerCase();
  if (mt.startsWith("video/")) return mt.includes("3gpp") ? "3gp" : "mp4";
  if (mt.includes("png")) return "png";
  if (mt.startsWith("image/")) return "jpg";
  if (mt.includes("pdf")) return "pdf";
  return isVideoMedia(mimeType, fileName, url) ? "mp4" : "jpg";
}

/**
 * URL correta da mídia para uso no disparo/compartilhamento:
 * vídeos do Drive são servidos pelo `media-proxy` com o Content-Type real
 * (`.../media-proxy/{id}.mp4`); imagens mantêm o link direto do Drive,
 * que já entrega os bytes corretos.
 */
export function dispatchMediaUrl(
  url?: string | null,
  mimeType?: string | null,
  fileName?: string | null,
): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (!isVideoMedia(mimeType, fileName, raw)) return raw;
  const ext = mediaExtension(mimeType, fileName, raw);
  return driveStreamUrl(raw, /^(mp4|3gp|webm|mov|m4v)$/i.test(ext) ? ext : "mp4") || raw;
}
