export function fmtInt(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR");
}

export function fmtBRL(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Custo unitário: até 4 casas (ex.: R$ 0,0350), mínimo 2. */
export function fmtUnitPrice(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** Aceita "0,05", "0.05", "R$ 1.234,50". Retorna NaN se inválido. */
export function parseMoney(input: string): number {
  let s = input.replace(/R\$|\s/g, "").trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

export function moneyInputValue(n: number | null | undefined) {
  if (!n) return "";
  return String(n).replace(".", ",");
}

export function deliveryRate(sent: number, delivered: number): number | null {
  return sent > 0 ? (delivered / sent) * 100 : null;
}

export function fmtPct(rate: number | null) {
  if (rate === null) return "—";
  return `${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export type RateTone = "good" | "ok" | "bad" | "none";

export function rateTone(rate: number | null): RateTone {
  if (rate === null) return "none";
  if (rate >= 90) return "good";
  if (rate >= 80) return "ok";
  return "bad";
}

export const RATE_TONE_CLASS: Record<RateTone, { text: string; bg: string; badge: string }> = {
  good: { text: "text-emerald-600", bg: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  ok: { text: "text-amber-600", bg: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  bad: { text: "text-red-600", bg: "bg-red-500", badge: "bg-red-500/10 text-red-700 border-red-500/30" },
  none: { text: "text-muted-foreground", bg: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground border-border" },
};
