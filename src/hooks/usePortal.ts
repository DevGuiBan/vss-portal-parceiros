// Backward-compatible wrapper, igual ao vss-disparos-manager — state fica em PortalContext.
import { usePortalContext } from "@/contexts/PortalContext";
export type { PortalDispatch, PortalReport, PortalOverview } from "@/contexts/PortalContext";
export function usePortal(_token?: string | null) {
  return usePortalContext();
}
