import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Plus, Inbox, BookmarkPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { PortalProvider, usePortalContext } from "@/contexts/PortalContext";
import { PortalSubmissionForm } from "@/components/portal/PortalSubmissionForm";
import { PortalSubmissionsList } from "@/components/portal/PortalSubmissionsList";
import { PortalPresets } from "@/components/portal/PortalPresets";
import { cn } from "@/lib/utils";

type TabKey = "new" | "mine" | "presets";

const TABS: { key: TabKey; label: string; icon: typeof Plus }[] = [
  { key: "new", label: "Nova Demanda", icon: Plus },
  { key: "mine", label: "Minhas Solicitações", icon: Inbox },
  { key: "presets", label: "Modelos de Demanda", icon: BookmarkPlus },
];

function ClientShell({ slug, onSignOut }: { slug: string; onSignOut: () => void }) {
  const { loading, error } = usePortalContext();
  const { branding } = usePartnerBranding(slug);
  const [tab, setTab] = useState<TabKey>("new");
  const [editingSubmission, setEditingSubmission] = useState<any | null>(null);
  const [prefill, setPrefill] = useState<{ presetName?: string; payload: any } | null>(null);

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
        <div>
          <p className="text-destructive font-medium">Não foi possível carregar seu portal</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
          <h1 className="text-lg font-semibold">{branding?.display_name || "Portal do Cliente"}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-1.5" /> Sair
        </Button>
      </header>

      <nav className="border-b border-border px-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                if (t.key === "new") {
                  setEditingSubmission(null);
                  setPrefill(null);
                }
                setTab(t.key);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-4 py-6">
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
        {tab === "mine" && <PortalSubmissionsList token={null} />}
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
      <ClientShell slug={slug} onSignOut={signOut} />
    </PortalProvider>
  );
}
