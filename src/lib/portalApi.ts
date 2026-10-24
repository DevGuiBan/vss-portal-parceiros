import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper mínimo da edge function portal-api (mesma usada pelo portal direto
 * do cliente, em vss-disparos-manager/src/contexts/PortalContext.tsx) — só
 * a leitura de perfil, usada aqui para confirmar o login do cliente final.
 * A tela completa de envio de demandas ainda não foi portada para este app.
 */
export async function callPortalApi(action: string, body: Record<string, unknown> = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-api?${new URLSearchParams({ action })}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro");
  return json;
}
