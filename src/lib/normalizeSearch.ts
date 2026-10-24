/**
 * Normalizes a string for accent-insensitive, case-insensitive search.
 * Removes diacritics (acentos) and lowercases.
 */
export function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
