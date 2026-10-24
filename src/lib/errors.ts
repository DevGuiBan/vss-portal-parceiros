/**
 * Extracts a human-readable message from an unknown error value.
 * Use inside `catch (e: unknown)` blocks instead of `e.message`.
 */
export function getErrorMessage(error: unknown, fallback = "Erro inesperado"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return fallback;
}
