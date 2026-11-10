import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, CheckCheck, CircleDollarSign, ClipboardList, Download, Gauge, KeyRound,
  Loader2, Search, Send, Trash2, X, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, periodLabel, rangeToApi, type DateRange } from "@/components/common/PeriodFilter";
import { DeliveryBar, EmptyState, RateBadge, SegmentedTabs, StatCard } from "@/components/common/Metrics";
import { ClientUsersInline } from "@/components/parceiros/ClientUsersInline";
import type { DetailTab } from "@/components/parceiros/ClientsList";
import { callPartnerApi } from "@/lib/partnerApi";
import { matchManualReport } from "@/lib/dispatchReport";
import { effectiveStatus, statusMeta, STATUS_ORDER } from "@/lib/demandStatus";
import { deliveryRate, fmtBRL, fmtInt, fmtPct, fmtUnitPrice, moneyInputValue, parseMoney, rateTone, RATE_TONE_CLASS } from "@/lib/format";
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

interface Row {
  sub: ClientSubmission;
  status: string;
  totals: { sent: number; delivered: number; failures: number } | null;
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

export function ClientDetailSheet({ client, initialTab, initialRange, slug, partnerName, onClose, onPriceUpdated, onDeleted }: Props) {
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [reports, setReports] = useState<ManualReportRow[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const [priceDraft, setPriceDraft] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

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

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setLoading(true);
    callPartnerApi("get-client-overview", { responsible_id: client.id, ...rangeToApi(range) })
      .then((j) => {
        if (cancelled) return;
        setSubmissions(j.submissions || []);
        setReports(j.manual_reports || []);
      })
      .catch((e: any) => !cancelled && toast.error(e?.message || "Erro ao carregar relatório do cliente"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [client?.id, range.from?.getTime(), range.to?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = useMemo(
    () => submissions.map((sub) => ({ sub, status: effectiveStatus(sub), totals: matchManualReport(sub.demand_id, reports) })),
    [submissions, reports],
  );

  const summary = useMemo(() => {
    let sent = 0, delivered = 0, failures = 0, withReport = 0;
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.totals) {
        withReport++;
        sent += r.totals.sent;
        delivered += r.totals.delivered;
        failures += r.totals.failures;
      }
    }
    return { sent, delivered, failures, withReport, byStatus, rate: deliveryRate(sent, delivered) };
  }, [rows]);

  const statusesPresent = useMemo(
    () => STATUS_ORDER.filter((s) => summary.byStatus[s]).concat(Object.keys(summary.byStatus).filter((s) => !STATUS_ORDER.includes(s))),
    [summary.byStatus],
  );

  const visibleRows = useMemo(() => {
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
    const header = ["Ação", "Data", "Status", "Enviadas", "Entregues", "Falhas", "Taxa de entrega (%)", "Valor estimado (R$)"];
    const body = visibleRows.map((r) => {
      const t = r.totals;
      const rate = t ? deliveryRate(t.sent, t.delivered) : null;
      return [
        r.sub.action_name || "Demanda sem nome",
        format(new Date(r.sub.created_at), "dd/MM/yyyy"),
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

  return (
    <>
      <Sheet open={!!client} onOpenChange={(o) => { if (!o) { setDeleteOpen(false); onClose(); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {client && (
            <div className="flex flex-col min-h-full">
              <div className="sticky top-0 z-10 bg-background border-b px-5 sm:px-6 pt-5 pb-4 space-y-4">
                <SheetHeader className="text-left pr-8">
                  <SheetTitle className="text-xl">{client.name}</SheetTitle>
                  <SheetDescription>{client.email || "Sem e-mail cadastrado"}</SheetDescription>
                </SheetHeader>
                <SegmentedTabs<DetailTab>
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { key: "summary", label: "Resumo", icon: BarChart3 },
                    { key: "dispatches", label: "Disparos", icon: ClipboardList, count: loading ? undefined : submissions.length },
                    { key: "access", label: "Acessos", icon: KeyRound },
                  ]}
                />
              </div>

              <div className="flex-1 px-5 sm:px-6 py-5 space-y-5">
                {tab !== "access" && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Período do relatório</p>
                    <PeriodFilter value={range} onChange={setRange} />
                  </div>
                )}

                {tab === "summary" && (
                  <>
                    {loading ? (
                      <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard icon={Send} label="Enviadas" value={fmtInt(summary.sent)} hint={`${summary.withReport} de ${rows.length} demanda(s) com relatório`} />
                        <StatCard icon={CheckCheck} label="Entregues" value={fmtInt(summary.delivered)} valueClassName="text-emerald-600" hint={`${fmtInt(summary.failures)} falha(s)`} />
                        <StatCard icon={Gauge} label="Taxa de entrega" value={fmtPct(summary.rate)} valueClassName={tone.text}>
                          <DeliveryBar sent={summary.sent} delivered={summary.delivered} failures={summary.failures} className="mt-2 h-1.5" />
                        </StatCard>
                        <StatCard
                          icon={CircleDollarSign}
                          label="Valor estimado"
                          value={fmtBRL(summary.sent * unitPrice)}
                          hint={unitPrice ? `${fmtInt(summary.sent)} × ${fmtUnitPrice(unitPrice)}` : <span className="text-amber-600">Defina o custo unitário abaixo</span>}
                        />
                      </div>
                    )}

                    <section className="rounded-xl border p-4 space-y-3">
                      <h3 className="text-sm font-semibold">Demandas por status</h3>
                      {loading ? (
                        <Skeleton className="h-8" />
                      ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma demanda enviada em {periodLabel(range).toLowerCase()}.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {statusesPresent.map((s) => {
                            const m = statusMeta(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                title={m.description}
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

                    <section className="rounded-xl border p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">Custo unitário do disparo</h3>
                        <p className="text-xs text-muted-foreground">Usado no valor estimado. Só você vê, o cliente não.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input inputMode="decimal" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} placeholder="0,00" className="pl-9" />
                        </div>
                        <Button onClick={savePrice} disabled={savingPrice || parseMoney(priceDraft) === unitPrice}>
                          {savingPrice && <Loader2 className="animate-spin" />}
                          Salvar
                        </Button>
                      </div>
                    </section>

                    <section className="rounded-xl border border-destructive/30 p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-destructive">Excluir cliente</h3>
                        <p className="text-xs text-muted-foreground">Remove o cadastro, os acessos e as solicitações deste cliente.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 /> Excluir cliente
                      </Button>
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

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {loading ? "Carregando…" : `${visibleRows.length} de ${rows.length} demanda(s)`}
                        {(query || statusFilter !== "all") && (
                          <button type="button" className="ml-2 text-primary hover:underline" onClick={() => { setQuery(""); setStatusFilter("all"); }}>
                            limpar filtros
                          </button>
                        )}
                      </p>
                      <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || visibleRows.length === 0}>
                        <Download /> Exportar CSV
                      </Button>
                    </div>

                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
                    ) : visibleRows.length === 0 ? (
                      <div className="rounded-xl border border-dashed">
                        <EmptyState
                          icon={ClipboardList}
                          title={rows.length === 0 ? "Nenhuma demanda no período" : "Nada encontrado"}
                          description={rows.length === 0 ? "Altere o período para ver demandas anteriores." : "Ajuste a busca ou o filtro de status."}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visibleRows.map(({ sub, status, totals }) => {
                          const m = statusMeta(status);
                          return (
                            <div key={sub.id} className="rounded-xl border bg-card p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{sub.action_name || "Demanda sem nome"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Enviada em {format(new Date(sub.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                                <span title={m.description} className={cn("shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", m.cls)}>
                                  {m.label}
                                </span>
                              </div>
                              {totals ? (
                                <>
                                  <DeliveryBar sent={totals.sent} delivered={totals.delivered} failures={totals.failures} />
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2 text-xs">
                                    <div><div className="text-muted-foreground">Enviadas</div><div className="font-semibold tabular-nums text-sm">{fmtInt(totals.sent)}</div></div>
                                    <div><div className="text-muted-foreground flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Entregues</div><div className="font-semibold tabular-nums text-sm">{fmtInt(totals.delivered)}</div></div>
                                    <div><div className="text-muted-foreground flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Falhas</div><div className="font-semibold tabular-nums text-sm">{fmtInt(totals.failures)}</div></div>
                                    <div><div className="text-muted-foreground">Taxa</div><RateBadge sent={totals.sent} delivered={totals.delivered} className="mt-0.5" /></div>
                                    <div><div className="text-muted-foreground">Valor est.</div><div className="font-semibold tabular-nums text-sm">{fmtBRL(totals.sent * unitPrice)}</div></div>
                                  </div>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  {status === "cancelado" ? <XCircle className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                                  {status === "cancelado" ? "Demanda cancelada, sem relatório." : "Relatório ainda não lançado pela equipe."}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {submissions.length >= 200 && (
                          <p className="text-xs text-muted-foreground italic text-center pt-1">
                            Mostrando as 200 mais recentes do período. Reduza o período para ver as demais.
                          </p>
                        )}
                      </div>
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
