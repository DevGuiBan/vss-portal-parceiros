import { DeliveryBar } from "@/components/common/Metrics";
import { deliveryRate, fmtInt, fmtPct, rateTone, RATE_TONE_CLASS } from "@/lib/format";

interface Props {
  sent: number;
  delivered: number;
  failures: number;
}

function Stat({ label, value, color, dot }: { label: string; value: number | string; color?: string; dot?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className={`text-xl font-semibold tabular-nums ${color ?? ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </div>
    </div>
  );
}

export function DispatchReportStats({ sent, delivered, failures }: Props) {
  const rate = deliveryRate(sent, delivered);
  return (
    <div className="space-y-3">
      <DeliveryBar sent={sent} delivered={delivered} failures={failures} className="h-2.5" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Enviados" value={fmtInt(sent)} />
        <Stat label="Entregues" value={fmtInt(delivered)} color="text-emerald-600" dot="bg-emerald-500" />
        <Stat label="Falhas" value={fmtInt(failures)} color="text-red-600" dot="bg-red-400" />
        <Stat label="Taxa de entrega" value={fmtPct(rate)} color={RATE_TONE_CLASS[rateTone(rate)].text} />
      </div>
    </div>
  );
}
