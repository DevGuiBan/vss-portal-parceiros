import { useMemo } from "react";
import { ArrowRight, BookmarkPlus, CheckCheck, ChevronRight, Clock, Gauge, Inbox, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryBar, EmptyState, RateBadge, StatCard } from "@/components/common/Metrics";
import { usePortalContext } from "@/contexts/PortalContext";
import { matchManualReport } from "@/lib/dispatchReport";
import { DEMAND_STATUS_META, effectiveStatus, statusMeta } from "@/lib/demandStatus";
import { deliveryRate, fmtInt, fmtPct, rateTone, RATE_TONE_CLASS } from "@/lib/format";
import { cn } from "@/lib/utils";

const FLOW = ["pendente", "conexao_numero", "aprovacao_template", "producao", "pronto", "disparado"];

interface Props {
  onNew: () => void;
  onPresets: () => void;
  onSeeAll: () => void;
}

export function ClientOverview({ onNew, onPresets, onSeeAll }: Props) {
  const { overview, responsible, profile } = usePortalContext();

  const data = useMemo(() => {
    const subs = (overview?.submissions || []).filter((s: any) => !s.admin_deleted_at);
    const reports = overview?.manual_reports || [];
    let sent = 0, delivered = 0, failures = 0;
    for (const r of reports) {
      sent += Number(r.sent) || 0;
      delivered += Number(r.delivered) || 0;
      failures += Number(r.failures) || 0;
    }
    const inProgress = subs.filter((s) => statusMeta(effectiveStatus(s)).group === "progress").length;
    const recent = [...subs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((s) => ({ s, status: effectiveStatus(s), totals: matchManualReport(s.demand_id, reports) }));
    return { total: subs.length, inProgress, sent, delivered, failures, rate: deliveryRate(sent, delivered), recent };
  }, [overview]);

  const name = responsible?.name || profile?.name;
  const tone = RATE_TONE_CLASS[rateTone(data.rate)];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{name ? `Olá, ${name}!` : "Olá!"}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Envie uma nova demanda de disparo e acompanhe aqui o andamento e os resultados de entrega.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button size="lg" onClick={onNew} className="px-5"><Plus /> Nova demanda</Button>
          <Button size="lg" variant="outline" onClick={onPresets} className="px-5 bg-card"><BookmarkPlus /> Usar modelo</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Inbox} label="Solicitações" value={fmtInt(data.total)} hint="Enviadas pelo portal" />
        <StatCard icon={Clock} label="Em andamento" value={fmtInt(data.inProgress)} hint="Sendo preparadas pela equipe" />
        <StatCard icon={Send} label="Mensagens enviadas" value={fmtInt(data.sent)} hint={`${fmtInt(data.delivered)} entregues`} />
        <StatCard icon={Gauge} label="Taxa de entrega" value={fmtPct(data.rate)} valueClassName={tone.text}>
          <DeliveryBar sent={data.sent} delivered={data.delivered} failures={data.failures} className="mt-2 h-1.5" />
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Últimas solicitações</CardTitle>
            {data.total > 0 && (
              <Button variant="ghost" size="sm" onClick={onSeeAll} className="text-muted-foreground">
                Ver todas <ChevronRight />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Você ainda não enviou nenhuma demanda"
                description="Leva poucos minutos: escreva a mensagem, anexe a mídia e a lista de contatos."
                action={<Button onClick={onNew}><Plus /> Criar primeira demanda</Button>}
                className="py-6"
              />
            ) : (
              <ul className="divide-y -my-2">
                {data.recent.map(({ s, status, totals }) => {
                  const m = statusMeta(status);
                  const title = (s.action_name || "").trim() || (s.message_text || "").slice(0, 60) || "(sem nome)";
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={onSeeAll} className="w-full text-left py-3 flex items-center gap-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{title}</span>
                            <span title={m.description} className={cn("shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", m.cls)}>{m.label}</span>
                          </div>
                          {totals ? (
                            <div className="flex items-center gap-2">
                              <DeliveryBar sent={totals.sent} delivered={totals.delivered} failures={totals.failures} className="h-1.5 flex-1" />
                              <span className="text-[11px] text-muted-foreground tabular-nums">{fmtInt(totals.sent)} enviadas</span>
                              <RateBadge sent={totals.sent} delivered={totals.delivered} />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString("pt-BR")} · {m.description}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Como sua demanda avança</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {FLOW.map((key, i) => {
                const m = DEMAND_STATUS_META[key];
                return (
                  <li key={key} className="relative flex gap-3">
                    <span className="relative z-10 h-6 w-6 rounded-full border bg-card text-[11px] font-semibold flex items-center justify-center shrink-0">
                      {key === "disparado" ? <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> : i + 1}
                    </span>
                    <div className="min-w-0 -mt-0.5">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button variant="link" className="px-0 mt-3 h-auto" onClick={onNew}>
              Enviar nova demanda <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
