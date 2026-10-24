import { Label } from "@/components/ui/label";
import { Eye, User } from "lucide-react";
import { driveStreamUrl, driveThumbnailUrl, isVideoMedia } from "@/lib/driveMedia";

interface WhatsAppPreviewProps {
  senderName: string;
  senderPhoto?: string;
  messageText: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  scheduledTime?: string;
  buttons?: { label: string; link: string }[];
}

export function WhatsAppPreview({
  senderName,
  senderPhoto,
  messageText,
  mediaUrl,
  mediaMimeType,
  mediaFileName,
  scheduledTime,
  buttons,
}: WhatsAppPreviewProps) {
  const isVideo = !!mediaUrl && isVideoMedia(mediaMimeType, mediaFileName, mediaUrl);
  const streamSrc = isVideo && mediaUrl ? driveStreamUrl(mediaUrl) : null;
  const rawSrc = isVideo && mediaUrl && !/#t=/.test(mediaUrl) ? `${mediaUrl}#t=0.1` : mediaUrl;
  const videoSrc = streamSrc ?? rawSrc;
  const poster = mediaUrl ? driveThumbnailUrl(mediaUrl, 800) || undefined : undefined;
  const time =
    scheduledTime ||
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const displayName = senderName?.trim() || "Seu Nome";

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Eye className="h-4 w-4" /> Pré-visualização no WhatsApp
      </Label>
      <div
        className="rounded-lg overflow-hidden border shadow-inner"
        style={{ background: "linear-gradient(135deg, #0b141a 0%, #111b21 100%)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-3 py-2.5"
          style={{ background: "#202c33" }}
        >
          {senderPhoto ? (
            <img
              src={senderPhoto}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
              onError={(e) => {
                const fallback = driveStreamUrl(senderPhoto, "jpg");
                if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
              }}
            />
          ) : (
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "#6b7c85" }}
            >
              <User className="h-5 w-5" style={{ color: "#e9edef" }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "#e9edef" }}
            >
              {displayName}
            </p>
            <p className="text-[11px]" style={{ color: "#8696a0" }}>
              online
            </p>
          </div>
        </div>
        {/* Chat area */}
        <div
          className="px-3 py-4 min-h-[140px]"
          style={{
            backgroundColor: "#0b141a",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        >
          <div className="flex justify-start">
            <div
              className="max-w-[85%] rounded-lg overflow-hidden shadow-sm"
              style={{ background: "#202c33" }}
            >
              {mediaUrl && (
                <div className="p-1">
                  <div
                    className="relative w-full rounded-md overflow-hidden bg-black flex items-center justify-center"
                    style={{ aspectRatio: isVideo ? "16 / 9" : "4 / 5" }}
                  >
                    {isVideo ? (
                      <video
                        src={videoSrc}
                        poster={poster}
                        className="absolute inset-0 w-full h-full object-contain"
                        controls
                        preload="metadata"
                        playsInline
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          const fallback = mediaUrl ? driveStreamUrl(mediaUrl, "jpg") : null;
                          if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
              {(messageText || !mediaUrl) && (
                <div className="px-2.5 pt-1.5 pb-1">
                  <p
                    className="text-[13.5px] whitespace-pre-wrap break-words leading-snug"
                    style={{ color: "#e9edef" }}
                  >
                    {messageText || (
                      <span style={{ color: "#8696a0", fontStyle: "italic" }}>
                        Sua mensagem aparecerá aqui...
                      </span>
                    )}
                  </p>
                </div>
              )}
              <div className="flex justify-end items-center gap-1 px-2 pb-1">
                <span className="text-[10px]" style={{ color: "#8696a0" }}>
                  {time}
                </span>
                <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
                  <path
                    d="M11.071.653a.457.457 0 0 0-.304-.108.46.46 0 0 0-.336.143L4.65 6.831 2.245 4.341a.46.46 0 0 0-.66 0l-.71.737a.5.5 0 0 0 0 .686l3.446 3.567a.46.46 0 0 0 .335.143.46.46 0 0 0 .335-.143L12.418 1.99a.5.5 0 0 0 0-.686l-.347-.65z"
                    fill="#53bdeb"
                  />
                  <path
                    d="M15.071.653a.457.457 0 0 0-.304-.108.46.46 0 0 0-.336.143L8.65 6.831 8.245 6.42a.46.46 0 0 0-.66 0l-.71.737a.5.5 0 0 0 0 .686l1.446 1.498a.46.46 0 0 0 .335.143.46.46 0 0 0 .335-.143L16.418 1.99a.5.5 0 0 0 0-.686l-.347-.65z"
                    fill="#53bdeb"
                  />
                </svg>
              </div>
            </div>
          </div>
          {buttons && buttons.filter((b) => b.label.trim()).length > 0 && (
            <div className="flex justify-start mt-1.5">
              <div className="max-w-[85%] w-full flex flex-col gap-[2px]">
                {buttons
                  .filter((b) => b.label.trim())
                  .map((b, i) => (
                    <div
                      key={i}
                      className="rounded-lg py-2 px-3 text-center text-[13px] font-medium"
                      style={{ background: "#202c33", color: "#53bdeb" }}
                    >
                      {b.label}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
