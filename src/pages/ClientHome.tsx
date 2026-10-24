import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { callPortalApi } from "@/lib/portalApi";

/**
 * Página do cliente final após login. Ainda é um placeholder — confirma a
 * autenticação e mostra o nome do cliente, mas a tela completa de envio de
 * demandas (igual ao ClientPortal.tsx do app admin) ainda não foi portada
 * para este app. Próximo passo planejado, fora do escopo desta primeira
 * versão do portal white-label.
 */
export default function ClientHome() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { branding } = usePartnerBranding(slug);
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    callPortalApi("get-profile")
      .then((p) => setProfile(p))
      .catch((e) => {
        if (String(e?.message || "").toLowerCase().includes("carteira") || String(e?.message || "").includes("403")) setForbidden(true);
        else toast.error(e?.message || "Erro ao carregar perfil");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (!authLoading && !user) return <Navigate to={`/${slug}/login`} replace />;
  if (forbidden) return <Navigate to={`/${slug}/login`} replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
          <h1 className="text-lg font-semibold">{branding?.display_name || "Portal do Cliente"}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1.5" /> Sair
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <Card>
          <CardHeader><CardTitle className="text-base">{loading ? "Carregando…" : `Olá, ${profile?.name || ""}`}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O envio de novas demandas ainda está sendo preparado para este portal. Em breve você poderá enviar e acompanhar seus disparos por aqui.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
