import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: Date;
  to?: Date;
}

interface Preset {
  key: string;
  label: string;
  get: () => DateRange;
}

const PRESETS: Preset[] = [
  { key: "7d", label: "Últimos 7 dias", get: () => ({ from: startOfDay(subDays(new Date(), 6)), to: startOfDay(new Date()) }) },
  { key: "30d", label: "Últimos 30 dias", get: () => ({ from: startOfDay(subDays(new Date(), 29)), to: startOfDay(new Date()) }) },
  { key: "month", label: "Este mês", get: () => ({ from: startOfMonth(new Date()), to: startOfDay(endOfMonth(new Date())) }) },
  {
    key: "lastMonth",
    label: "Mês passado",
    get: () => {
      const d = subMonths(new Date(), 1);
      return { from: startOfMonth(d), to: startOfDay(endOfMonth(d)) };
    },
  },
  { key: "all", label: "Todo o período", get: () => ({}) },
];

function sameRange(a: DateRange, b: DateRange) {
  const eq = (x?: Date, y?: Date) => (!x && !y) || (!!x && !!y && isSameDay(x, y));
  return eq(a.from, b.from) && eq(a.to, b.to);
}

function activePreset(r: DateRange) {
  return PRESETS.find((p) => sameRange(p.get(), r));
}

export function periodLabel(r: DateRange) {
  const preset = activePreset(r);
  if (preset) return preset.label;
  if (r.from && r.to) {
    if (isSameDay(r.from, r.to)) return format(r.from, "dd/MM/yyyy", { locale: ptBR });
    return `${format(r.from, "dd/MM", { locale: ptBR })} – ${format(r.to, "dd/MM/yyyy", { locale: ptBR })}`;
  }
  if (r.from) return `Desde ${format(r.from, "dd/MM/yyyy", { locale: ptBR })}`;
  return "Todo o período";
}

export function rangeToApi(r: DateRange) {
  return {
    from: r.from ? format(r.from, "yyyy-MM-dd") : undefined,
    to: r.to ? format(r.to, "yyyy-MM-dd") : undefined,
  };
}

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
  align?: "start" | "end";
  size?: "sm" | "default";
}

export function PeriodFilter({ value, onChange, className, align = "end", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const current = activePreset(value);

  useEffect(() => { if (open) setDraft(value); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (r: DateRange) => {
    onChange(r);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size} className={cn("justify-between gap-2 font-normal", className)}>
          <span className="flex items-center gap-2 min-w-0">
            <CalendarDays className="text-muted-foreground" />
            <span className="truncate">{periodLabel(value)}</span>
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align={align}>
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-2 border-b sm:border-b-0 sm:border-r overflow-x-auto sm:w-44 shrink-0">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => apply(p.get())}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-left whitespace-nowrap hover:bg-muted transition-colors",
                  current?.key === p.key && "bg-primary/10 text-primary font-medium",
                )}
              >
                {p.label}
                {current?.key === p.key && <Check className="h-3.5 w-3.5 hidden sm:block" />}
              </button>
            ))}
          </div>
          <div className="p-1">
            <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">Período personalizado</p>
            <Calendar
              mode="range"
              locale={ptBR}
              selected={{ from: draft.from, to: draft.to }}
              onSelect={(r) => setDraft({ from: r?.from, to: r?.to })}
              defaultMonth={draft.from}
              initialFocus
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-2">
              <span className="text-xs text-muted-foreground">
                {draft.from ? periodLabel({ from: draft.from, to: draft.to ?? draft.from }) : "Escolha o início e o fim"}
              </span>
              <Button size="sm" disabled={!draft.from} onClick={() => apply({ from: draft.from, to: draft.to ?? draft.from })}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
