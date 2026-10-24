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
import { Loader2, Plus, LogOut, Users, Search, CalendarDays, ClipboardList, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { callPartnerApi } from "@/lib/partnerApi";
import { ClientUsersInline } from "@/components/parceiros/ClientUsersInline";
import { DispatchReportStats } from "@/components/portal/DispatchReportStats";
import { matchManualReport } from "@/lib/dispatchReport";
import { cn } from "@/lib/utils";

interface ClientStat { id: string; name: string; email: string | null; unit_price: number; sent: number; delivered: number }
interface ClientSubmission { id: string; action_name?: string | null; created_at: string; demand_id?: string | null; demand_status?: string | null }
interface ManualReportRow { demand_id: string | null; sent: number; delivered: number; failures: number }

type NavKey = "clients";
const NAV: { key: NavKey; label: string; icon: typeof Users }[] = [
  { key: "clients", label: "Clientes", icon: Users },
];

export default function PartnerDashboard() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { branding } = usePartnerBranding(slug);
  const [nav] = useState<NavKey>("clients");
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

  const openClient = async (c: ClientStat) => {
    setSelected(c);
    setPriceDraft(c.unit_price ? String(c.unit_price) : "");
    setDetailLoading(true);
    setDetailSubmissions([]);
    setDetailReports([]);
    try {
      const j = await callPartnerApi("get-client-overview", { responsible_id: c.id });
      setDetailSubmissions(j.submissions || []);
      setDetailReports(j.manual_reports || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar cliente");
    } finally {
      setDetailLoading(false);
    }
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

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
  }, [clients, query]);

  const totals = useMemo(
    () => filteredClients.reduce((acc, c) => ({ sent: acc.sent + c.sent, delivered: acc.delivered + c.delivered }), { sent: 0, delivered: 0 }),
    [filteredClients],
  );

  const periodLabel = range.from && range.to
    ? `${format(range.from, "dd/MM", { locale: ptBR })} – ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`
    : "Todo o período";

  if (!authLoading && !user) return <Navigate to={`/${slug}/login`} replace />;
  if (forbidden) return <Navigate to={`/${slug}/login`} replace />;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 flex items-center gap-2 border-b border-border">
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover" />}
          <span className="text-sm font-semibold truncate">{branding?.display_name || "Portal do Parceiro"}</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.key}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium",
                  nav === n.key ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {n.label}
              </div>
            );
          })}
        </nav>
        <div className="px-2 py-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1.5" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 space-y-6 max-w-5xl">
        <div className="grid grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clientes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{filteredClients.length}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enviadas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.sent}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entregues</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.delivered}</CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Seus clientes</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo cliente</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
          </div>
          <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-2" align="end">
              <div className="flex gap-2">
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

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
            ) : filteredClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {clients.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado para essa busca."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-4">Cliente</th>
                    <th className="text-left py-2 px-4">E-mail</th>
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
                      <td className="py-2 px-4 font-medium">{c.name}</td>
                      <td className="py-2 px-4 text-muted-foreground">{c.email || "—"}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{c.sent}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{c.delivered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
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

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
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
                {detailLoading ? (
                  <p className="text-[11px] text-muted-foreground py-2">Carregando…</p>
                ) : detailSubmissions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhuma demanda enviada por este cliente ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {detailSubmissions.map((s) => {
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
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
