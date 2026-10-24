const onlyDigits = (val: string) => String(val ?? "").replace(/\D+/g, "");

/**
 * Normaliza um telefone BR para o formato 55DDDNUMERO (ex.: 5511927021663).
 * Extraído de vss-disparos-manager/src/lib/listSanitizer.ts (sem o restante
 * do higienizador, fora de escopo deste app).
 */
function normalizePhone(input: string): string | null {
  let d = onlyDigits(input);
  if (!d) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = parseInt(d.slice(0, 2), 10);
  if (!(ddd >= 11 && ddd <= 99)) return null;
  let number = d.slice(2);
  if (number.length === 8) {
    if ("2345".includes(number[0])) {
      // fixo
    } else if ("6789".includes(number[0])) {
      number = "9" + number;
    } else {
      return null;
    }
  } else if (number.length === 9) {
    if (!number.startsWith("9")) return null;
  } else {
    return null;
  }
  return `55${String(ddd).padStart(2, "0")}${number}`;
}

/** Rótulos pré-definidos para os botões de call-to-action. */
export const BUTTON_LABEL_OPTIONS = [
  "CLIQUE AQUI",
  "FALE CONOSCO",
  "MAIS INFORMAÇÕES",
  "SABER MAIS",
] as const;

export type ButtonLabel = (typeof BUTTON_LABEL_OPTIONS)[number];

/**
 * Normaliza números de teste para o formato 55DDDNUMERO (ex.: 5511927021663).
 * Aceita entrada com quebras de linha, vírgulas, ponto e vírgula ou espaços.
 * Números inválidos são mantidos apenas com dígitos para o usuário corrigir.
 */
export function formatTestNumbers(raw: string): string {
  const parts = String(raw ?? "")
    .split(/[\n,;/|]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const digits = p.replace(/\D/g, "");
    if (!digits) continue;
    const norm = normalizePhone(digits) ?? digits;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out.join("\n");
}

/** true quando todas as linhas estão no padrão 55 + DDD + 8/9 dígitos. */
export function testNumbersAreValid(raw: string): boolean {
  const lines = String(raw ?? "").split(/\s+/).filter(Boolean);
  return lines.every((l) => /^55\d{10,11}$/.test(l));
}
