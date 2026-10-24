import { useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { PartnerLogo } from "@/components/branding/PartnerLogo";
import { guardedSignIn } from "@/lib/guardedLogin";
import { callPartnerApi } from "@/lib/partnerApi";
import { callPortalApi } from "@/lib/portalApi";
import { supabase } from "@/integrations/supabase/client";
import { Turnstile } from "@/components/auth/Turnstile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export default function Login() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { branding, status } = usePartnerBranding(slug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  if (!authLoading && user) return <Navigate to={`/${slug}`} replace />;

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Portal não encontrado.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await guardedSignIn(email.trim().toLowerCase(), password, captchaToken);
      if (error) throw error;

      // Resolve o papel do usuário: staff do parceiro ou cliente final.
      try {
        const partnerProfile = await callPartnerApi("get-partner-profile");
        if (partnerProfile?.partner?.slug && partnerProfile.partner.slug !== slug) {
          await supabase.auth.signOut();
          throw new Error("Esta conta pertence a outro parceiro.");
        }
        toast.success("Acesso liberado!");
        navigate(`/${slug}/admin`, { replace: true });
        return;
      } catch {
        // Não é staff de parceiro — tenta como cliente final.
      }

      try {
        await callPortalApi("get-profile");
        toast.success("Acesso liberado!");
        navigate(`/${slug}`, { replace: true });
        return;
      } catch {
        await supabase.auth.signOut();
        throw new Error("Esta conta não tem acesso a este portal.");
      }
    } catch (err: any) {
      toast.error(err?.message || "E-mail ou senha inválidos");
    } finally {
      setLoading(false);
      setCaptchaToken("");
      setCaptchaResetSignal((n) => n + 1);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex items-center justify-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <PartnerLogo src={branding?.logo_url} size="lg" rounded="2xl" className="mx-auto" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-4">
            {branding?.display_name || "Portal do Parceiro"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Entre com seu e-mail e senha</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <Turnstile siteKey={TURNSTILE_SITE_KEY} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} resetSignal={captchaResetSignal} />
            <Button type="submit" disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)} className="w-full h-11">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
