import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck, LayoutDashboard, LogOut, Plus, Users } from "lucide-react";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { PartnerLogo } from "@/components/branding/PartnerLogo";
import { callPartnerApi } from "@/lib/partnerApi";
import { rangeToApi, type DateRange } from "@/components/common/PeriodFilter";
import { PartnerOverview } from "@/components/parceiros/PartnerOverview";
import { ClientsList, type DetailTab } from "@/components/parceiros/ClientsList";
import { ClientDetailSheet } from "@/components/parceiros/ClientDetailSheet";
import { CreateClientDialog } from "@/components/parceiros/CreateClientDialog";
import type { ClientStat } from "@/lib/partnerTypes";
import { cn } from "@/lib/utils";
import { cachedFetch, invalidate, peek } from "@/lib/queryCache";
import { DayDemands } from "@/components/parceiros/DayDemands";
import { todayBR, useDayDemands, dayGroup, isLate } from "@/lib/dayDemands";

type NavKey = "dashboard" | "day" | "clients";
const NAV: { key: NavKey; label: string; short: string; icon: typeof Users }[] = [
  { key: "dashboard", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
  { key: "day", label: "Demandas do Dia", short: "Do dia", icon: CalendarCheck },
  { key: "clients", label: "Clientes", short: "Clientes", icon: Users },
];

export default function PartnerDashboard() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { branding } = usePartnerBranding(slug);
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [clients, setClients] = useState<ClientStat[]>([]);
  const [range, setRange] = useState<DateRange>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ClientStat | null>(null);
  const [selectedTab, setSelectedTab] = useState<DetailTab>("summary");
  const [selectedRange, setSelectedRange] = useState<DateRange | null>(null);
  const [day, setDay] = useState(todayBR);

  // Resumo de hoje para o card do Dashboard (mesmo cache da aba Demandas do Dia).
  const todayData = useDayDemands(todayBR(), !!user && nav === "dashboard");
  const todaySummary = todayData.demands
    ? {
        total: todayData.demands.length,
        done: todayData.demands.filter((d) => dayGroup(d.status) === "done").length,
        late: todayData.demands.filter((d) => isLate(d)).length,
      }
    : null;

  const partnerName = branding?.display_name || "Portal do Parceiro";

  // Cache por período: trocar de período e voltar é instantâneo; dados
  // anteriores ficam na tela enquanto revalida (sem skeleton piscando).
  const load = async (opts: { force?: boolean } = {}) => {
    const params = rangeToApi(range);
    const key = `partner:clients:${params.from ?? ""}:${params.to ?? ""}`;
    const cached = peek<ClientStat[]>(key);
    if (cached) setClients(cached);
    else setLoading(true);
    try {
      const list = await cachedFetch(key, 60_000, async () => {
        const j = await callPartnerApi("list-clients-with-stats", params);
        return (j.clients || []) as ClientStat[];
      }, opts);
      setClients(list);
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("parceiro")) setForbidden(true);
      else toast.error(e?.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, range.from?.getTime(), range.to?.getTime()]);

  const openClient = (c: ClientStat, tab: DetailTab = "summary", rangeOverride: DateRange | null = null) => {
    setSelectedTab(tab);
    setSelectedRange(rangeOverride);
    setSelected(c);
  };

  // A partir das Demandas do Dia: abre o cliente já nos disparos daquele dia.
  const openClientFromDay = (responsibleId: string, d: string) => {
    const c = clients.find((x) => x.id === responsibleId);
    if (!c) return toast.error("Cliente não encontrado. Atualize a página.");
    const date = parseISO(d);
    openClient(c, "dispatches", { from: date, to: date });
  };

  if (!authLoading && !user) return <Navigate to={`/${slug}/login`} replace />;
  if (forbidden) return <Navigate to={`/${slug}/login`} replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <PartnerLogo src={branding?.logo_url} size="md" rounded="lg" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate leading-tight">{partnerName}</div>
              <div className="text-[11px] text-muted-foreground truncate leading-tight">Painel do parceiro</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 rounded-lg bg-muted p-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.key}
                  onClick={() => setNav(n.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    nav === n.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden lg:block text-xs text-muted-foreground max-w-[180px] truncate">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sair">
              <LogOut /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8">
        {nav === "dashboard" ? (
          <PartnerOverview
            clients={clients}
            loading={loading}
            range={range}
            onRangeChange={setRange}
            onOpenClient={(c) => openClient(c)}
            onCreate={() => setCreateOpen(true)}
            onGoToClients={() => setNav("clients")}
            today={todaySummary}
            onGoToToday={() => { setDay(todayBR()); setNav("day"); }}
          />
        ) : nav === "day" ? (
          <DayDemands day={day} onDayChange={setDay} onOpenClient={openClientFromDay} />
        ) : (
          <ClientsList
            clients={clients}
            loading={loading}
            range={range}
            onRangeChange={setRange}
            onOpenClient={openClient}
            onCreate={() => setCreateOpen(true)}
          />
        )}
      </main>

      {/* Navegação inferior no celular */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              onClick={() => setNav(n.key)}
              className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", nav === n.key ? "text-primary" : "text-muted-foreground")}
            >
              <Icon className="h-5 w-5" /> {n.short}
            </button>
          );
        })}
        <button onClick={() => setCreateOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></span>
          Novo cliente
        </button>
      </nav>

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        slug={slug}
        partnerName={partnerName}
        onCreated={() => { invalidate("partner:clients:"); load({ force: true }); }}
      />

      <ClientDetailSheet
        client={selected}
        initialTab={selectedTab}
        initialRange={selectedRange ?? range}
        slug={slug}
        partnerName={partnerName}
        onClose={() => setSelected(null)}
        onPriceUpdated={(id, price) => {
          invalidate("partner:clients:");
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, unit_price: price } : c)));
          setSelected((s) => (s && s.id === id ? { ...s, unit_price: price } : s));
        }}
        onDeleted={(id) => {
          invalidate("partner:");
          setClients((prev) => prev.filter((c) => c.id !== id));
          setSelected(null);
        }}
      />
    </div>
  );
}
