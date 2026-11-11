import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDollarSign, Gauge, Plus, Send, Trophy, Users, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodFilter, type DateRange } from "@/components/common/PeriodFilter";
import { EmptyState, RateBadge, StatCard } from "@/components/common/Metrics";
import { fmtBRL, fmtInt, fmtPct, deliveryRate, rateTone, RATE_TONE_CLASS } from "@/lib/format";
import { estimatedRevenue, type ClientStat } from "@/lib/partnerTypes";
import { cn } from "@/lib/utils";

interface Props {
  clients: ClientStat[];
  loading: boolean;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  onOpenClient: (c: ClientStat) => void;
  onCreate: () => void;
  onGoToClients: () => void;
}

interface AlertGroup {
  key: string;
  label: string;
  tone: "bad" | "warn";
  clients: { client: ClientStat; detail?: string }[];
}

const MAX_CHIPS = 6;

export function PartnerOverview({ clients, loading, range, onRangeChange, onOpenClient, onCreate, onGoToClients }: Props) {
  const stats = useMemo(() => {
    let sent = 0, delivered = 0, revenue = 0, active = 0, unpricedWithSends = 0;
    for (const c of clients) {
      sent += c.sent;
      delivered += c.delivered;
      revenue += estimatedRevenue(c);
      if (c.sent > 0) active++;
      if (c.sent > 0 && !c.unit_price) unpricedWithSends++;
    }
    return { sent, delivered, revenue, active, unpricedWithSends, rate: deliveryRate(sent, delivered) };
  }, [clients]);

  const ranking = useMemo(
    () => [...clients].filter((c) => c.sent > 0).sort((a, b) => b.sent - a.sent).slice(0, 5),
    [clients],
  );
  const maxSent = ranking[0]?.sent || 0;

  // Só alertas acionáveis, agrupados por tipo. "Sem envios no período"
  // não é problema por si só e poluía a lista com todos os clientes.
  const alertGroups = useMemo(() => {
    const low: AlertGroup = { key: "low", label: "Taxa de entrega abaixo de 80%", tone: "bad", clients: [] };
    const noPrice: AlertGroup = { key: "price", label: "Custo unitário não definido", tone: "warn", clients: [] };
    for (const c of clients) {
      const rate = deliveryRate(c.sent, c.delivered);
      if (rate !== null && rateTone(rate) === "bad") low.clients.push({ client: c, detail: fmtPct(rate) });
      if (!c.unit_price) noPrice.clients.push({ client: c });
    }
    low.clients.sort((x, y) => (deliveryRate(x.client.sent, x.client.delivered) ?? 0) - (deliveryRate(y.client.sent, y.client.delivered) ?? 0));
    return [low, noPrice].filter((g) => g.clients.length > 0);
  }, [clients]);

  const tone = RATE_TONE_CLASS[rateTone(stats.rate)];

  if (!loading && clients.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="Comece cadastrando seu primeiro cliente"
          description="Ao cadastrar, você recebe uma mensagem pronta com link, e-mail e senha para enviar ao cliente. Os disparos dele aparecem aqui automaticamente."
          action={<Button onClick={onCreate}><Plus /> Cadastrar cliente</Button>}
          className="py-16"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Resultado dos disparos de todos os seus clientes no período.</p>
        </div>
        <PeriodFilter value={range} onChange={onRangeChange} className="w-full sm:w-auto" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className={cn("h-[118px] rounded-xl", i === 4 && "col-span-2 lg:col-span-1")} />)
        ) : (
          <>
            <StatCard icon={Users} label="Clientes" value={fmtInt(clients.length)} hint={`${fmtInt(stats.active)} com envios no período`} />
            <StatCard icon={Send} label="Enviadas" value={fmtInt(stats.sent)} />
            <StatCard icon={CheckCheck} label="Entregues" value={fmtInt(stats.delivered)} valueClassName="text-emerald-600" />
            <StatCard icon={Gauge} label="Taxa de entrega" value={fmtPct(stats.rate)} valueClassName={tone.text}>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", tone.bg)} style={{ width: `${Math.min(stats.rate ?? 0, 100)}%` }} />
              </div>
            </StatCard>
            <StatCard
              icon={CircleDollarSign}
              label="Faturamento est."
              value={fmtBRL(stats.revenue)}
              className="col-span-2 lg:col-span-1"
              hint={
                stats.unpricedWithSends > 0 ? (
                  <span className="text-amber-600">{stats.unpricedWithSends} cliente(s) com envios sem custo</span>
                ) : undefined
              }
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Clientes com mais envios</CardTitle>
            <Button variant="ghost" size="sm" onClick={onGoToClients} className="text-muted-foreground">
              Ver todos <ChevronRight />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum envio registrado no período selecionado.</p>
            ) : (
              ranking.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenClient(c)}
                  className="w-full text-left rounded-lg px-2 py-2.5 -mx-2 hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm tabular-nums">{fmtInt(c.sent)}</span>
                          <RateBadge sent={c.sent} delivered={c.delivered} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${maxSent > 0 ? (c.sent / maxSent) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-20 text-right">{fmtBRL(estimatedRevenue(c))}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Precisa de atenção</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : alertGroups.length === 0 ? (
              <div className="flex flex-col items-center text-center py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                Tudo certo por aqui.
              </div>
            ) : (
              <div className="space-y-4">
                {alertGroups.map((g) => (
                  <div key={g.key} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", g.tone === "bad" ? "bg-red-500" : "bg-amber-500")} />
                      <span className="font-medium flex-1">{g.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{g.clients.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      {g.clients.slice(0, MAX_CHIPS).map(({ client, detail }) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => onOpenClient(client)}
                          className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted transition-colors max-w-[180px]"
                        >
                          <span className="truncate">{client.name}</span>
                          {detail && <span className="text-red-600 tabular-nums shrink-0">{detail}</span>}
                        </button>
                      ))}
                      {g.clients.length > MAX_CHIPS && (
                        <button type="button" onClick={onGoToClients} className="text-xs text-primary hover:underline px-1">
                          +{g.clients.length - MAX_CHIPS} ver todos
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
