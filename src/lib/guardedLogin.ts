import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Login por senha com bloqueio próprio de força bruta (edge function
 * guarded-login, compartilhada com o app admin). Nunca cai para
 * signInWithPassword direto — ver AGENTS.md do repositório principal:
 * "fail closed" se a guarda estiver indisponível.
 */
export async function guardedSignIn(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<{ data: { user: User | null }; error: Error | null }> {
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke("guarded-login", {
      body: { email, password, captchaToken: captchaToken || undefined },
    });
    if (fnError) throw fnError;
    if (!fnData?.ok) {
      return { data: { user: null }, error: new Error(fnData?.error || "Não foi possível validar o acesso") };
    }
    if (typeof fnData.access_token !== "string" || typeof fnData.refresh_token !== "string") {
      throw new Error("Resposta de acesso inválida");
    }
    const { data, error } = await supabase.auth.setSession({
      access_token: fnData.access_token,
      refresh_token: fnData.refresh_token,
    });
    return { data: { user: data.user }, error };
  } catch (error) {
    console.error("guarded-login unavailable", error);
    return { data: { user: null }, error: new Error("Acesso temporariamente indisponível. Tente novamente em instantes.") };
  }
}
