import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtInt, fmtPct, rateTone, RATE_TONE_CLASS, deliveryRate } from "@/lib/format";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  valueClassName,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  valueClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs sm:text-sm font-medium truncate">{label}</span>
      </div>
      <div className={cn("mt-3 text-xl sm:text-2xl font-bold tabular-nums tracking-tight", valueClassName)}>{value}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground leading-snug">{hint}</div>}
    </Card>
  );
}

/** Badge colorido com a taxa de entrega (verde ≥ 90%, amarelo ≥ 80%, vermelho abaixo). */
export function RateBadge({ sent, delivered, className }: { sent: number; delivered: number; className?: string }) {
  const rate = deliveryRate(sent, delivered);
  const tone = RATE_TONE_CLASS[rateTone(rate)];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums", tone.badge, className)}>
      {fmtPct(rate)}
    </span>
  );
}

/** Barra empilhada: entregues (verde) · falhas (vermelho) · restante (cinza). */
export function DeliveryBar({ sent, delivered, failures = 0, className }: { sent: number; delivered: number; failures?: number; className?: string }) {
  const total = Math.max(sent, delivered + failures, 1);
  const dPct = (delivered / total) * 100;
  const fPct = (failures / total) * 100;
  return (
    <div
      className={cn("h-2 w-full rounded-full bg-muted overflow-hidden flex", className)}
      role="img"
      aria-label={`${fmtInt(delivered)} entregues e ${fmtInt(failures)} falhas de ${fmtInt(sent)} enviadas`}
    >
      <div className="h-full bg-emerald-500" style={{ width: `${dPct}%` }} />
      <div className="h-full bg-red-400" style={{ width: `${fPct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center py-10 px-4", className)}>
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: K; label: string; icon?: LucideIcon; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-lg bg-muted p-1", className)}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("text-[10px] rounded-full px-1.5 tabular-nums", active ? "bg-primary/10 text-primary" : "bg-background/60")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
