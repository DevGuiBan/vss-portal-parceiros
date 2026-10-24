import { supabase } from "@/integrations/supabase/client";

/** Chama a edge function partner-api (gestão de clientes do parceiro). */
export async function callPartnerApi(action: string, body: Record<string, unknown> = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro");
  return json;
}
