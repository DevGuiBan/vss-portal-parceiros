import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { usePortal } from "@/hooks/usePortal";
import type { PortalLiveDispatch } from "@/contexts/PortalContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  submissionId: string | null;
  title?: string;
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-xl font-semibold ${color ?? ""}`}>{value.toLocaleString("pt-BR")}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function PortalLiveDispatchDialog({ open, onOpenChange, submissionId, title }: Props) {
  const { loadLiveDispatch } = usePortal(null);
  const [data, setData] = useState<PortalLiveDispatch | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      setData(await loadLiveDispatch(submissionId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [submissionId, loadLiveDispatch]);

  useEffect(() => {
    if (!open || !submissionId) return;
    refresh();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 90000);
    return () => window.clearInterval(id);
  }, [open, submissionId, refresh]);

  const t = data?.totals ?? { sent: 0, delivered: 0, seen: 0, failed: 0, total: 0 };
  const done = t.delivered + t.failed;
  const pct = t.total > 0 ? Math.min(100, Math.round((done / t.total) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Acompanhamento do disparo
          </DialogTitle>
        </DialogHeader>

        {title && <p className="text-sm text-muted-foreground -mt-2 truncate">{title}</p>}

        {!data && loading && (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}

        {data && !data.available && (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            O disparo desta solicitação ainda não foi iniciado. Assim que começar, os números aparecem aqui em tempo real.
          </div>
        )}

        {data?.available && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={data.running ? "border-primary/40 text-primary" : "border-emerald-500/40 text-emerald-600"}>
                {data.running ? "Em andamento" : "Disparo finalizado"}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {data.running ? "Atualiza automaticamente a cada 10s" : "Contagem final"}
              </span>
            </div>

            {!data.running && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-foreground">
                    Disparo concluído{data.finishedAt ? ` em ${new Date(data.finishedAt).toLocaleString("pt-BR")}` : ""}
                  </div>
                  <div className="text-muted-foreground">
                    O envio de todas as mensagens foi encerrado. Pequenas confirmações de entrega e leitura ainda podem chegar do WhatsApp nas horas seguintes.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Enviados" value={t.sent} />
              <Stat label="Entregues" value={t.delivered} color="text-emerald-500" />
              <Stat label="Vistos" value={t.seen} color="text-sky-500" />
              <Stat label="Falhas" value={t.failed} color="text-destructive" />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 text-muted-foreground">
                <span>{done.toLocaleString("pt-BR")} / {t.total.toLocaleString("pt-BR")}</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>

          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
