import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Plus, Inbox, BookmarkPlus, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { PartnerLogo } from "@/components/branding/PartnerLogo";
import { PortalProvider, usePortalContext } from "@/contexts/PortalContext";
import { PortalSubmissionForm } from "@/components/portal/PortalSubmissionForm";
import { PortalSubmissionsList } from "@/components/portal/PortalSubmissionsList";
import { PortalPresets } from "@/components/portal/PortalPresets";
import { ClientOverview } from "@/components/portal/ClientOverview";
import { cn } from "@/lib/utils";

type TabKey = "home" | "new" | "mine" | "presets";

const TABS: { key: TabKey; label: string; short: string; icon: typeof Plus }[] = [
  { key: "home", label: "Início", short: "Início", icon: Home },
  { key: "new", label: "Nova Demanda", short: "Nova", icon: Plus },
  { key: "mine", label: "Minhas Solicitações", short: "Solicitações", icon: Inbox },
  { key: "presets", label: "Modelos de Demanda", short: "Modelos", icon: BookmarkPlus },
];

function ClientShell({ slug, onSignOut, email }: { slug: string; onSignOut: () => void; email?: string }) {
  const { loading, error } = usePortalContext();
  const { branding } = usePartnerBranding(slug);
  const [tab, setTab] = useState<TabKey>("home");
  const [editingSubmission, setEditingSubmission] = useState<any | null>(null);
  const [prefill, setPrefill] = useState<{ presetName?: string; payload: any } | null>(null);

  const go = (key: TabKey) => {
    if (key === "new") {
      setEditingSubmission(null);
      setPrefill(null);
    }
    setTab(key);
    window.scrollTo({ top: 0 });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-3">
          <p className="text-destructive font-medium">Não foi possível carregar seu portal</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            <Button variant="ghost" onClick={onSignOut}>Sair</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <PartnerLogo src={branding?.logo_url} size="md" rounded="lg" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate leading-tight">{branding?.display_name || "Portal do Cliente"}</div>
              {email && <div className="text-[11px] text-muted-foreground truncate leading-tight">{email}</div>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut} className="shrink-0" title="Sair">
            <LogOut /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
        <nav className="hidden md:block border-t">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => go(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 pb-24 md:pb-8">
        {tab === "home" && <ClientOverview onNew={() => go("new")} onPresets={() => go("presets")} onSeeAll={() => go("mine")} />}
        {tab === "new" && (
          <PortalSubmissionForm
            token={null}
            editing={editingSubmission}
            prefill={prefill}
            onDone={() => {
              setEditingSubmission(null);
              setPrefill(null);
              setTab("mine");
            }}
          />
        )}
        {tab === "mine" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Minhas solicitações</h1>
              <p className="text-sm text-muted-foreground">Acompanhe o status e o relatório de entrega de cada demanda.</p>
            </div>
            <PortalSubmissionsList token={null} />
          </div>
        )}
        {tab === "presets" && (
          <PortalPresets
            token={null}
            onUse={(p) => {
              setEditingSubmission(null);
              setPrefill({ presetName: p.name, payload: p.payload });
              setTab("new");
            }}
          />
        )}
      </main>

      {/* Navegação inferior no celular */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => go(t.key)}
              className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
            >
              {t.key === "new" ? (
                <span className={cn("h-5 w-5 rounded-full flex items-center justify-center", active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary")}>
                  <Plus className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Icon className="h-5 w-5" />
              )}
              {t.short}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function ClientHome() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();

  if (!authLoading && !user) return <Navigate to={`/${slug}/login`} replace />;
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PortalProvider>
      <ClientShell slug={slug} onSignOut={signOut} email={user?.email} />
    </PortalProvider>
  );
}
