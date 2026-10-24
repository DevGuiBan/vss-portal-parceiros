interface Props {
  sent: number;
  delivered: number;
  failures: number;
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-xl font-semibold ${color ?? ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function DispatchReportStats({ sent, delivered, failures }: Props) {
  const rate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "0,0";
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Enviados" value={sent.toLocaleString("pt-BR")} />
      <Stat label="Entregues" value={delivered.toLocaleString("pt-BR")} color="text-emerald-500" />
      <Stat label="Falhas" value={failures.toLocaleString("pt-BR")} color="text-destructive" />
      <Stat label="Taxa de entrega" value={`${rate}%`} color="text-sky-500" />
    </div>
  );
}
