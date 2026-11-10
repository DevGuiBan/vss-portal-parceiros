// Geração de senha e texto de acesso enviados pelo parceiro ao cliente.

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar a digitação pelo cliente.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#$%&*!?";

function randomInt(max: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function pick(set: string) {
  return set[randomInt(set.length)];
}

/** Senha aleatória (crypto) com ao menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo. */
export function generatePassword(length = 12): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const pool = UPPER + LOWER + DIGITS;
  while (chars.length < length) chars.push(pick(pool));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function portalLoginUrl(slug: string) {
  return `${window.location.origin}/${slug}/login`;
}

export function buildAccessMessage(opts: {
  partnerName: string;
  recipientName?: string;
  url: string;
  email: string;
  password: string;
  isReset?: boolean;
}) {
  const greeting = opts.recipientName?.trim() ? `Olá, *${opts.recipientName.trim()}*! 👋` : "Olá! 👋";
  const intro = opts.isReset
    ? `Sua senha de acesso ao portal *${opts.partnerName}* foi redefinida.`
    : `Seu acesso ao portal *${opts.partnerName}* está pronto.`;
  return [
    greeting,
    intro,
    "",
    `🔗 Acesse: ${opts.url}`,
    `📧 E-mail: ${opts.email}`,
    `🔑 Senha: ${opts.password}`,
    "",
    "Pelo portal você envia novas demandas de disparo e acompanha os relatórios de entrega.",
    "Guarde esses dados em local seguro.",
  ].join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para contextos sem Clipboard API (http, iframes restritos).
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function whatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
