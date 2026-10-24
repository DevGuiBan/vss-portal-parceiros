import { useEffect, useState } from "react";
import { hexToHslTriple } from "@/lib/color";

export interface PartnerBranding {
  slug: string;
  display_name: string;
  logo_url: string;
  primary_color: string;
}

type Status = "loading" | "ready" | "not_found";

/**
 * Resolve o branding público de um parceiro pelo slug (edge function
 * partner-public-info, sem auth) e aplica no documento antes de renderizar
 * qualquer coisa — título, favicon e a CSS var --primary (convertida de hex
 * para a tripla H/S/L que o tailwind.config.ts espera).
 */
export function usePartnerBranding(slug: string) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!slug) { setStatus("not_found"); return; }
    let cancelled = false;
    setStatus("loading");

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-public-info?slug=${encodeURIComponent(slug)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        return (await res.json()) as PartnerBranding;
      })
      .then((data) => {
        if (cancelled) return;
        setBranding(data);
        setStatus("ready");

        document.title = data.display_name || "Portal do Parceiro";
        const hsl = hexToHslTriple(data.primary_color || "");
        if (hsl) {
          document.documentElement.style.setProperty("--primary", hsl);
          document.documentElement.style.setProperty("--ring", hsl);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("not_found");
      });

    return () => { cancelled = true; };
  }, [slug]);

  return { branding, status };
}
