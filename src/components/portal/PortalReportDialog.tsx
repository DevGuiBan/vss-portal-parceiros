import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardList, RefreshCw } from "lucide-react";
import { usePortal } from "@/hooks/usePortal";
import { matchManualReport } from "@/lib/dispatchReport";
import { DispatchReportStats } from "@/components/portal/DispatchReportStats";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demandId: string | null;
  title?: string;
}

export function PortalReportDialog({ open, onOpenChange, demandId, title }: Props) {
  const { overview, loadOverview } = usePortal(null);
  const totals = matchManualReport(demandId, overview?.manual_reports || []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Relatório de disparo
          </DialogTitle>
        </DialogHeader>

        {title && <p className="text-sm text-muted-foreground -mt-2 truncate">{title}</p>}

        {!totals ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            O relatório desta solicitação ainda não foi lançado pela nossa equipe. Assim que o disparo for concluído e conferido, os números aparecem aqui.
          </div>
        ) : (
          <DispatchReportStats sent={totals.sent} delivered={totals.delivered} failures={totals.failures} />
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={loadOverview}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
