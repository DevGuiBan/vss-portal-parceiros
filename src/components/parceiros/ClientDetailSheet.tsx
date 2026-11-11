import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, CheckCheck, CircleDollarSign, ClipboardList, Download, Gauge, KeyRound,
  Loader2, MoreHorizontal, Search, Send, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, periodLabel, rangeToApi, type DateRange } from "@/components/common/PeriodFilter";
import { DeliveryBar, EmptyState, RateBadge, SegmentedTabs, StatCard } from "@/components/common/Metrics";
import { ClientUsersInline } from "@/components/parceiros/ClientUsersInline";
import type { DetailTab } from "@/components/parceiros/ClientsList";
import { callPartnerApi } from "@/lib/partnerApi";
import { cachedFetch, invalidate, peek } from "@/lib/queryCache";
import { matchManualReport } from "@/lib/dispatchReport";
import { effectiveStatus, statusMeta, STATUS_ORDER } from "@/lib/demandStatus";
import { deliveryRate, fmtBRL, fmtInt, fmtPct, moneyInputValue, parseMoney, rateTone, RATE_TONE_CLASS } from "@/lib/format";
import type { ClientStat, ClientSubmission, ManualReportRow } from "@/lib/partnerTypes";
import { cn } from "@/lib/utils";

interface Props {
  client: ClientStat | null;
  initialTab: DetailTab;
  initialRange: DateRange;
  slug: string;
  partnerName: string;
  onClose: () => void;
  onPriceUpdated: (id: string, price: number) => void;
  onDeleted: (id: string) => void;
}

type SortKey = "recent" | "oldest" | "sent";

interface ReportTotals {
  sent: number;
  delivered: number;
  failures: number;
  reports: number;
}

interface Overview {
  submissions: ClientSubmission[];
  reports: ManualReportRow[];
  /** Somado no Postgres; null quando a API ainda não suporta (versão antiga). */
  totals: ReportTotals | null;
  nextBefore: string | null;
}

interface ExtraPages {
  submissions: ClientSubmission[];
  reports: ManualReportRow[];
  nextBefore: string | null;
}

interface Row {
  sub: ClientSubmission;
  status: string;
  totals: { sent: number; delivered: number; failures: number } | null;
}

const PAGE = 30;
const EMPTY: Overview = { submissions: [], reports: [], totals: null, nextBefore: null };

function parseOverview(j: any): Overview {
  return {
    submissions: j.submissions || [],
    reports: j.manual_reports || [],
    totals: j.report_totals ?? null,
    nextBefore: j.has_more ? j.next_before ?? null : null,
  };
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((v) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";"))
    .join("\n");
  // BOM para o Excel pt-BR reconhecer acentuação.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function overviewKey(clientId: string, range: DateRange) {
  const p = rangeToApi(range);
  return `partner:overview:${clientId}:${p.from ?? ""}:${p.to ?? ""}`;
}

export function ClientDetailSheet({ client, initialTab, initialRange, slug, partnerName, onClose, onPriceUpdated, onDeleted }: Props) {
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Overview>(EMPTY);
  // Páginas seguintes (solicitações mais antigas), fora do cache.
  const [extra, setExtra] = useState<ExtraPages | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const currentKeyRef = useRef("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE);

  const [priceDraft, setPriceDraft] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Reinicia o estado ao abrir outro cliente.
  useEffect(() => {
    if (!client) return;
    setTab(initialTab);
    setRange(initialRange);
    setQuery("");
    setStatusFilter("all");
    setSortKey("recent");
    setPriceDraft(moneyInputValue(client.unit_price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  useEffect(() => { setVisibleCount(PAGE); }, [query, statusFilter, sortKey, range.from?.getTime(), range.to?.getTime()]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const key = overviewKey(client.id, range);
    currentKeyRef.current = key;
    const cached = peek<Overview>(key);
    setData(cached ?? EMPTY);
    setExtra(null);
    setLoading(!cached);
    cachedFetch(key, 60_000, async () =>
      parseOverview(await callPartnerApi("get-client-overview", { responsible_id: client.id, ...rangeToApi(range) })),
    )
      .then((ov) => { if (!cancelled) setData(ov); })
      .catch((e: any) => !cancelled && toast.error(e?.message || "Erro ao carregar relatório do cliente"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [client?.id, range.from?.getTime(), range.to?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const submissions = useMemo(() => (extra ? [...data.submissions, ...extra.submissions] : data.submissions), [data, extra]);
  const reports = useMemo(() => (extra ? [...data.reports, ...extra.reports] : data.reports), [data, extra]);
  const nextBefore = extra ? extra.nextBefore : data.nextBefore;

  const loadOlder = async () => {
    if (!client || !nextBefore) return;
    const keyAtStart = overviewKey(client.id, range);
    setLoadingMore(true);
    try {
      const page = parseOverview(
        await callPartnerApi("get-client-overview", { responsible_id: client.id, ...rangeToApi(range), before: nextBefore }),
      );
      if (currentKeyRef.current !== keyAtStart) return;
      setExtra((prev) => ({
        submissions: [...(prev?.submissions || []), ...page.submissions],
        reports: [...(prev?.reports || []), ...page.reports],
        nextBefore: page.nextBefore,
      }));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar demandas anteriores");
    } finally {
      setLoadingMore(false);
    }
  };

  const rows: Row[] = useMemo(
    () => submissions.map((sub) => ({ sub, status: effectiveStatus(sub), totals: matchManualReport(sub.demand_id, reports) })),
    [submissions, reports],
  );

  const summary = useMemo(() => {
    // Totais = todos os relatórios do período (a API já filtra por data),
    // para bater com os números da lista/dashboard. Relatórios sem demanda
    // listada (lançamentos avulsos) entram no total e são sinalizados.
    let sent = 0, delivered = 0, failures = 0, withReport = 0, unlinkedReports = 0;
    const totals = data.totals;
    if (totals) {
      // API nova: totais do período somados no banco (não dependem de
      // quantas demandas foram carregadas) e manual_reports só das listadas.
      sent = totals.sent;
      delivered = totals.delivered;
      failures = totals.failures;
      if (!nextBefore) unlinkedReports = Math.max(totals.reports - reports.length, 0);
    } else {
      const listedDemandIds = new Set(rows.map((r) => r.sub.demand_id).filter(Boolean));
      for (const rep of reports) {
        sent += Number(rep.sent) || 0;
        delivered += Number(rep.delivered) || 0;
        failures += Number(rep.failures) || 0;
        if (!rep.demand_id || !listedDemandIds.has(rep.demand_id)) unlinkedReports++;
      }
    }
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.totals) withReport++;
    }
    return { sent, delivered, failures, withReport, unlinkedReports, byStatus, rate: deliveryRate(sent, delivered) };
  }, [rows, reports, data.totals, nextBefore]);

  const statusesPresent = useMemo(
    () => STATUS_ORDER.filter((s) => summary.byStatus[s]).concat(Object.keys(summary.byStatus).filter((s) => !STATUS_ORDER.includes(s))),
    [summary.byStatus],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !(r.sub.action_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortKey === "sent") return (b.totals?.sent ?? -1) - (a.totals?.sent ?? -1);
      const diff = new Date(b.sub.created_at).getTime() - new Date(a.sub.created_at).getTime();
      return sortKey === "recent" ? diff : -diff;
    });
    return list;
  }, [rows, query, statusFilter, sortKey]);

  const unitPrice = client?.unit_price || 0;

  const savePrice = async () => {
    if (!client) return;
    const priceN = parseMoney(priceDraft);
    if (!Number.isFinite(priceN) || priceN < 0) {
      toast.error("Valor inválido. Use, por exemplo, 0,05.");
      return;
    }
    setSavingPrice(true);
    try {
      await callPartnerApi("update-client", { responsible_id: client.id, unit_price: priceN });
      toast.success("Custo unitário atualizado");
      onPriceUpdated(client.id, priceN);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar custo unitário");
    } finally {
      setSavingPrice(false);
    }
  };

  const deleteClient = async () => {
    if (!client || deleteConfirmText.trim() !== client.name) return;
    setDeleting(true);
    try {
      await callPartnerApi("delete-client", { responsible_id: client.id });
      invalidate(`partner:overview:${client.id}:`);
      toast.success("Cliente excluído");
      setDeleteOpen(false);
      setDeleteConfirmText("");
      onDeleted(client.id);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir cliente");
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    if (!client) return;
    const header = ["Ação", "Data", "Origem", "Status", "Enviadas", "Entregues", "Falhas", "Taxa de entrega (%)", "Valor estimado (R$)"];
    const body = filteredRows.map((r) => {
      const t = r.totals;
      const rate = t ? deliveryRate(t.sent, t.delivered) : null;
      return [
        r.sub.action_name || "Demanda sem nome",
        format(new Date(r.sub.created_at), "dd/MM/yyyy"),
        r.sub.source === "team" ? "Equipe" : "Portal",
        statusMeta(r.status).label,
        t ? t.sent : "",
        t ? t.delivered : "",
        t ? t.failures : "",
        rate !== null ? rate.toFixed(1).replace(".", ",") : "",
        t ? (t.sent * unitPrice).toFixed(2).replace(".", ",") : "",
      ];
    });
    const safeName = client.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
    downloadCsv(`relatorio-${safeName}-${format(new Date(), "yyyy-MM-dd")}.csv`, [header, ...body]);
  };

  const tone = RATE_TONE_CLASS[rateTone(summary.rate)];
  const hasFilters = !!query || statusFilter !== "all";

  return (
    <>
      <Sheet open={!!client} onOpenChange={(o) => { if (!o) { setDeleteOpen(false); onClose(); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {client && (
            <div className="flex flex-col min-h-full">
              <div className="sticky top-0 z-10 bg-background border-b px-5 sm:px-6 pt-5 pb-4 space-y-4">
                <div className="flex items-start gap-2 pr-8">
                  <SheetHeader className="text-left flex-1 min-w-0 space-y-0.5">
                    <SheetTitle className="text-xl truncate">{client.name}</SheetTitle>
                    <SheetDescription className="truncate">{client.email || "Sem e-mail cadastrado"}</SheetDescription>
                  </SheetHeader>
                  <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Mais ações">
                        <MoreHorizontal />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-1">
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                        className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" /> Excluir cliente
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <SegmentedTabs<DetailTab>
                    className="flex-1"
                    value={tab}
                    onChange={setTab}
                    tabs={[
                      { key: "summary", label: "Resumo", icon: BarChart3 },
                      { key: "dispatches", label: "Disparos", icon: ClipboardList, count: loading ? undefined : submissions.length },
                      { key: "access", label: "Acessos", icon: KeyRound },
                    ]}
                  />
                  {tab !== "access" && <PeriodFilter value={range} onChange={setRange} className="h-[42px] sm:w-auto" />}
                </div>
              </div>

              <div className="flex-1 px-5 sm:px-6 py-5 space-y-5">
                {tab === "summary" && (
                  <>
                    {loading ? (
                      <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard
                          icon={Send}
                          label="Enviadas"
                          value={fmtInt(summary.sent)}
                          hint={summary.unlinkedReports > 0 ? `Inclui ${summary.unlinkedReports} lançamento(s) avulso(s)` : undefined}
                        />
                        <StatCard icon={CheckCheck} label="Entregues" value={fmtInt(summary.delivered)} valueClassName="text-emerald-600" />
                        <StatCard icon={Gauge} label="Taxa de entrega" value={fmtPct(summary.rate)} valueClassName={tone.text}>
                          <DeliveryBar sent={summary.sent} delivered={summary.delivered} failures={summary.failures} className="mt-2 h-1.5" />
                        </StatCard>
                        <StatCard
                          icon={CircleDollarSign}
                          label="Valor estimado"
                          value={fmtBRL(summary.sent * unitPrice)}
                          hint={unitPrice ? undefined : <span className="text-amber-600">Defina o custo unitário abaixo</span>}
                        />
                      </div>
                    )}

                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Demandas por status</h3>
                      {loading ? (
                        <Skeleton className="h-8" />
                      ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma demanda em {periodLabel(range).toLowerCase()}.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {statusesPresent.map((s) => {
                            const m = statusMeta(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                title={`${m.description} Clique para ver.`}
                                onClick={() => { setStatusFilter(s); setTab("dispatches"); }}
                                className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium hover:opacity-80", m.cls)}
                              >
                                {m.label}
                                <span className="rounded-full bg-background/70 px-1.5 tabular-nums">{summary.byStatus[s]}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <section className="space-y-2 pt-1">
                      <div>
                        <h3 className="text-sm font-semibold">Custo unitário do disparo</h3>
                        <p className="text-xs text-muted-foreground">Usado no valor estimado. O cliente não vê.</p>
                      </div>
                      <div className="flex items-center gap-2 max-w-sm">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input inputMode="decimal" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} placeholder="0,00" className="pl-9" />
                        </div>
                        {parseMoney(priceDraft) !== unitPrice && (
                          <Button onClick={savePrice} disabled={savingPrice}>
                            {savingPrice && <Loader2 className="animate-spin" />}
                            Salvar
                          </Button>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {tab === "dispatches" && (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome da ação" className="pl-9" />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os status</SelectItem>
                          {statusesPresent.map((s) => <SelectItem key={s} value={s}>{statusMeta(s).label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                        <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recent">Mais recentes</SelectItem>
                          <SelectItem value="oldest">Mais antigas</SelectItem>
                          <SelectItem value="sent">Mais enviadas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {loading ? "Carregando…" : hasFilters ? `${filteredRows.length} de ${rows.length}` : `${rows.length} demanda(s)`}
                        {hasFilters && (
                          <button type="button" className="ml-2 text-primary hover:underline" onClick={() => { setQuery(""); setStatusFilter("all"); }}>
                            limpar
                          </button>
                        )}
                      </span>
                      <Button variant="ghost" size="sm" onClick={exportCsv} disabled={loading || filteredRows.length === 0} className="text-muted-foreground">
                        <Download /> CSV
                      </Button>
                    </div>

                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                    ) : filteredRows.length === 0 ? (
                      <div className="rounded-xl border border-dashed">
                        <EmptyState
                          icon={ClipboardList}
                          title={rows.length === 0 ? "Nenhuma demanda no período" : "Nada encontrado"}
                          description={rows.length === 0 ? "Altere o período para ver demandas anteriores." : "Ajuste a busca ou o filtro de status."}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border divide-y overflow-hidden">
                        {filteredRows.slice(0, visibleCount).map(({ sub, status, totals }) => {
                          const m = statusMeta(status);
                          const awaitingReport = !totals && status === "disparado";
                          return (
                            <div key={sub.id} className="p-3.5 sm:px-4 space-y-2 bg-card">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{sub.action_name || "Demanda sem nome"}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    {sub.source === "team" && <span className="text-sky-700"> · Criada pela equipe</span>}
                                    {awaitingReport && <span> · aguardando relatório</span>}
                                  </p>
                                </div>
                                <span title={m.description} className={cn("shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", m.cls)}>
                                  {m.label}
                                </span>
                              </div>
                              {totals && (
                                <div className="flex items-center gap-3">
                                  <DeliveryBar sent={totals.sent} delivered={totals.delivered} failures={totals.failures} className="h-1.5 flex-1" />
                                  <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                    {fmtInt(totals.delivered)}/{fmtInt(totals.sent)}
                                  </span>
                                  <RateBadge sent={totals.sent} delivered={totals.delivered} />
                                  {unitPrice > 0 && (
                                    <span className="hidden sm:inline text-xs tabular-nums font-medium w-20 text-right">{fmtBRL(totals.sent * unitPrice)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!loading && filteredRows.length > visibleCount && (
                      <Button variant="outline" className="w-full" onClick={() => setVisibleCount((n) => n + PAGE)}>
                        Mostrar mais ({filteredRows.length - visibleCount} restantes)
                      </Button>
                    )}
                    {!loading && filteredRows.length <= visibleCount && nextBefore && (
                      <Button variant="ghost" className="w-full text-muted-foreground" onClick={loadOlder} disabled={loadingMore}>
                        {loadingMore && <Loader2 className="animate-spin" />}
                        Carregar demandas anteriores
                      </Button>
                    )}
                    {!loading && !data.totals && submissions.length >= 200 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Mostrando as mais recentes do período. Reduza o período para ver as anteriores.
                      </p>
                    )}
                  </>
                )}

                {tab === "access" && (
                  <ClientUsersInline responsibleId={client.id} clientName={client.name} slug={slug} partnerName={partnerName} />
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteConfirmText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Excluir {client?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Esta ação não pode ser desfeita. Ao excluir este cliente:</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex gap-2"><X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> O cadastro do cliente, o acesso de login (e-mail/senha) e todas as solicitações enviadas por ele no portal serão apagados definitivamente.</li>
              <li className="flex gap-2"><ClipboardList className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> Os relatórios de disparos já lançados <strong>não</strong> são apagados. Eles continuam guardados internamente para controle da operação.</li>
            </ul>
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Digite <span className="font-semibold">{client?.name}</span> para confirmar</Label>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={client?.name} autoFocus />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteClient} disabled={deleting || deleteConfirmText.trim() !== client?.name}>
              {deleting && <Loader2 className="animate-spin" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
