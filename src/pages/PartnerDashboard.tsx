import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Plus, LogOut, Users, Search, CalendarDays, ClipboardList, X, Trash2, AlertTriangle, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { PartnerLogo } from "@/components/branding/PartnerLogo";
import { callPartnerApi } from "@/lib/partnerApi";
import { ClientUsersInline } from "@/components/parceiros/ClientUsersInline";
import { DispatchReportStats } from "@/components/portal/DispatchReportStats";
import { matchManualReport } from "@/lib/dispatchReport";
import { cn } from "@/lib/utils";

interface ClientStat { id: string; name: string; email: string | null; unit_price: number; sent: number; delivered: number }
interface ClientSubmission { id: string; action_name?: string | null; created_at: string; demand_id?: string | null; demand_status?: string | null }
interface ManualReportRow { demand_id: string | null; sent: number; delivered: number; failures: number }

type NavKey = "dashboard" | "clients";
const NAV: { key: NavKey; label: string; icon: typeof Users }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "clients", label: "Clientes", icon: Users },
];

export default function PartnerDashboard() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { branding } = usePartnerBranding(slug);
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [clients, setClients] = useState<ClientStat[]>([]);

  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [rangeOpen, setRangeOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<ClientStat | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSubmissions, setDetailSubmissions] = useState<ClientSubmission[]>([]);
  const [detailReports, setDetailReports] = useState<ManualReportRow[]>([]);
  const [priceDraft, setPriceDraft] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [reportRange, setReportRange] = useState<{ from?: Date; to?: Date }>({});
  const [reportRangeOpen, setReportRangeOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const j = await callPartnerApi("list-clients-with-stats", {
        from: range.from ? format(range.from, "yyyy-MM-dd") : undefined,
        to: range.to ? format(range.to, "yyyy-MM-dd") : undefined,
      });
      setClients(j.clients || []);
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("parceiro")) setForbidden(true);
      else toast.error(e?.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, range.from, range.to]);

  const createClient = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error("Nome, e-mail e senha (min. 8) são obrigatórios");
      return;
    }
    const priceN = unitPrice.trim() ? Number(unitPrice.replace(",", ".")) : 0;
    if (!Number.isFinite(priceN) || priceN < 0) {
      toast.error("Custo unitário inválido");
      return;
    }
    setSaving(true);
    try {
      await callPartnerApi("create-client", { name: name.trim(), email: email.trim(), password, unit_price: priceN });
      toast.success("Cliente cadastrado");
      setCreateOpen(false); setName(""); setEmail(""); setPassword(""); setUnitPrice("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  };

  const loadClientOverview = async (responsibleId: string, r: { from?: Date; to?: Date }) => {
    setDetailLoading(true);
    setDetailSubmissions([]);
    setDetailReports([]);
    try {
      const j = await callPartnerApi("get-client-overview", {
        responsible_id: responsibleId,
        from: r.from ? format(r.from, "yyyy-MM-dd") : undefined,
        to: r.to ? format(r.to, "yyyy-MM-dd") : undefined,
      });
      setDetailSubmissions(j.submissions || []);
      setDetailReports(j.manual_reports || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar cliente");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selected) loadClientOverview(selected.id, reportRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, reportRange.from, reportRange.to]);

  const openClient = (c: ClientStat) => {
    setSelected(c);
    setPriceDraft(c.unit_price ? String(c.unit_price) : "");
    setReportQuery("");
    setReportRange({});
  };

  const savePrice = async () => {
    if (!selected) return;
    const priceN = Number(priceDraft.replace(",", "."));
    if (!Number.isFinite(priceN) || priceN < 0) {
      toast.error("Custo unitário inválido");
      return;
    }
    setSavingPrice(true);
    try {
      await callPartnerApi("update-client", { responsible_id: selected.id, unit_price: priceN });
      toast.success("Custo unitário atualizado");
      setClients((prev) => prev.map((c) => (c.id === selected.id ? { ...c, unit_price: priceN } : c)));
      setSelected((s) => (s ? { ...s, unit_price: priceN } : s));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar custo unitário");
    } finally {
      setSavingPrice(false);
    }
  };

  const deleteClient = async () => {
    if (!selected || deleteConfirmText.trim() !== selected.name) return;
    setDeleting(true);
    try {
      await callPartnerApi("delete-client", { responsible_id: selected.id });
      toast.success("Cliente excluído");
      setClients((prev) => prev.filter((c) => c.id !== selected.id));
      setDeleteOpen(false);
      setDeleteConfirmText("");
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir cliente");
    } finally {
      setDeleting(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
  }, [clients, query]);

  const totals = useMemo(
    () => clients.reduce((acc, c) => ({ sent: acc.sent + c.sent, delivered: acc.delivered + c.delivered }), { sent: 0, delivered: 0 }),
    [clients],
  );
  const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0;

  const topClients = useMemo(
    () => [...clients].filter((c) => c.sent > 0).sort((a, b) => b.sent - a.sent).slice(0, 5),
    [clients],
  );
  const maxTopSent = topClients[0]?.sent || 0;

  const periodLabel = range.from && range.to
    ? `${format(range.from, "dd/MM", { locale: ptBR })} – ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`
    : "Todo o período";

  const filteredDetailSubmissions = useMemo(() => {
    const q = reportQuery.trim().toLowerCase();
    if (!q) return detailSubmissions;
    return detailSubmissions.filter((s) => (s.action_name || "").toLowerCase().includes(q));
  }, [detailSubmissions, reportQuery]);

  const reportPeriodLabel = reportRange.from && reportRange.to
    ? `${format(reportRange.from, "dd/MM", { locale: ptBR })} – ${format(reportRange.to, "dd/MM/yyyy", { locale: ptBR })}`
    : "Todo o período";

  if (!authLoading && !user) return <Navigate to={`/${slug}/login`} replace />;
  if (forbidden) return <Navigate to={`/${slug}/login`} replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <PartnerLogo src={branding?.logo_url} size="sm" rounded="lg" />
          <span className="text-sm sm:text-base font-semibold truncate">{branding?.display_name || "Portal do Parceiro"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0">
          <LogOut className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Sair</span>
        </Button>
      </header>

      <nav className="border-b border-border px-4 sm:px-6 flex gap-1 overflow-x-auto">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = nav === n.key;
          return (
            <button
              key={n.key}
              onClick={() => setNav(n.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {n.label}
            </button>
          );
        })}
      </nav>

      <main className="px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-5xl mx-auto">
        {nav === "dashboard" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Visão geral</h2>
              <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {periodLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 space-y-2" align="end">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">De</Label>
                      <Calendar mode="single" selected={range.from} onSelect={(d) => setRange((r) => ({ ...r, from: d }))} initialFocus />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Até</Label>
                      <Calendar mode="single" selected={range.to} onSelect={(d) => setRange((r) => ({ ...r, to: d }))} />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { setRange({}); setRangeOpen(false); }}>
                    <X className="h-3.5 w-3.5 mr-1" /> Limpar período
                  </Button>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <Card><CardHeader className="p-3 sm:p-6 pb-1.5 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-muted-foreground">Clientes</CardTitle></CardHeader><CardContent className="p-3 sm:p-6 pt-0 text-lg sm:text-2xl font-bold">{clients.length}</CardContent></Card>
              <Card><CardHeader className="p-3 sm:p-6 pb-1.5 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-muted-foreground">Enviadas</CardTitle></CardHeader><CardContent className="p-3 sm:p-6 pt-0 text-lg sm:text-2xl font-bold">{totals.sent}</CardContent></Card>
              <Card><CardHeader className="p-3 sm:p-6 pb-1.5 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-muted-foreground">Entregues</CardTitle></CardHeader><CardContent className="p-3 sm:p-6 pt-0 text-lg sm:text-2xl font-bold">{totals.delivered}</CardContent></Card>
              <Card><CardHeader className="p-3 sm:p-6 pb-1.5 sm:pb-2"><CardTitle className="text-xs sm:text-sm text-muted-foreground">Taxa de entrega</CardTitle></CardHeader><CardContent className="p-3 sm:p-6 pt-0 text-lg sm:text-2xl font-bold">{deliveryRate}%</CardContent></Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Clientes com mais envios</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
                ) : topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum envio registrado no período selecionado.</p>
                ) : (
                  topClients.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{c.sent} enviadas</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${maxTopSent > 0 ? (c.sent / maxTopSent) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {nav === "clients" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Seus clientes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Período: {periodLabel} — altere em Dashboard</p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo cliente</Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
                ) : filteredClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {clients.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado para essa busca."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left py-2 px-4">Cliente</th>
                          <th className="text-left py-2 px-4 hidden sm:table-cell">E-mail</th>
                          <th className="text-right py-2 px-4">Enviadas</th>
                          <th className="text-right py-2 px-4">Entregues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map((c) => (
                          <tr
                            key={c.id}
                            className="border-b border-border/60 cursor-pointer hover:bg-muted/40"
                            onClick={() => openClient(c)}
                          >
                            <td className="py-2 px-4 font-medium">
                              <div className="truncate max-w-[40vw] sm:max-w-none">{c.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[40vw] sm:hidden">{c.email || "—"}</div>
                            </td>
                            <td className="py-2 px-4 text-muted-foreground hidden sm:table-cell">{c.email || "—"}</td>
                            <td className="py-2 px-4 text-right tabular-nums">{c.sent}</td>
                            <td className="py-2 px-4 text-right tabular-nums">{c.delivered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
            <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></div>
            <div className="space-y-1.5">
              <Label>Custo unitário do disparo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">Visível apenas para você — o cliente não vê esse valor.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createClient} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setDeleteOpen(false);
            setDeleteConfirmText("");
            setReportQuery("");
            setReportRange({});
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-5">
              <ClientUsersInline responsibleId={selected.id} clientName={selected.name} />

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custo unitário do disparo (R$)</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    className="h-8"
                  />
                  <Button size="sm" className="h-8" onClick={savePrice} disabled={savingPrice}>
                    {savingPrice && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Salvar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Visível apenas para você — o cliente não vê esse valor.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relatório de disparos</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={reportQuery}
                      onChange={(e) => setReportQuery(e.target.value)}
                      placeholder="Buscar por nome da ação"
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Popover open={reportRangeOpen} onOpenChange={setReportRangeOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs justify-start sm:justify-center shrink-0">
                        <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {reportPeriodLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 space-y-2" align="end">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">De</Label>
                          <Calendar mode="single" selected={reportRange.from} onSelect={(d) => setReportRange((r) => ({ ...r, from: d }))} initialFocus />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Até</Label>
                          <Calendar mode="single" selected={reportRange.to} onSelect={(d) => setReportRange((r) => ({ ...r, to: d }))} />
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => { setReportRange({}); setReportRangeOpen(false); }}>
                        <X className="h-3.5 w-3.5 mr-1" /> Limpar período
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>

                {detailLoading ? (
                  <p className="text-[11px] text-muted-foreground py-2">Carregando…</p>
                ) : filteredDetailSubmissions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {detailSubmissions.length === 0
                      ? "Nenhuma demanda enviada por este cliente neste período."
                      : "Nenhuma demanda encontrada para essa busca."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredDetailSubmissions.map((s) => {
                      const totals = matchManualReport(s.demand_id, detailReports);
                      return (
                        <div key={s.id} className="rounded-md border border-border/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{s.action_name || "Demanda sem nome"}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          {totals ? (
                            <DispatchReportStats sent={totals.sent} delivered={totals.delivered} failures={totals.failures} />
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Relatório ainda não disponível.</p>
                          )}
                        </div>
                      );
                    })}
                    {detailSubmissions.length >= 200 && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Mostrando as 200 mais recentes do período selecionado — restrinja o período para ver outras.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir cliente
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteConfirmText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Excluir {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Esta ação não pode ser desfeita. Ao excluir este cliente:</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex gap-2"><X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> O cadastro do cliente, o acesso de login (e-mail/senha) e todas as solicitações enviadas por ele no portal serão apagados definitivamente.</li>
              <li className="flex gap-2"><ClipboardList className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> Os relatórios de disparos já lançados <strong>não</strong> são apagados — continuam preservados internamente para controle da operação.</li>
            </ul>
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Digite <span className="font-semibold">{selected?.name}</span> para confirmar</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={selected?.name}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={deleteClient}
              disabled={deleting || deleteConfirmText.trim() !== selected?.name}
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
