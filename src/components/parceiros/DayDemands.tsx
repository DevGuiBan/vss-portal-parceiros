import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, FileClock, Inbox, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState, SegmentedTabs } from "@/components/common/Metrics";
import { statusMeta, STATUS_ORDER } from "@/lib/demandStatus";
import { deliveryRate, fmtInt, fmtPct, rateTone, RATE_TONE_CLASS } from "@/lib/format";
import {
  awaitingReport,
  DAY_GROUPS,
  dayGroup,
  isLate,
  shiftDay,
  sortDemands,
  todayBR,
  useDayDemands,
  type DayDemand,
  type DayGroup,
} from "@/lib/dayDemands";
import { cn } from "@/lib/utils";

type Filter = "all" | DayGroup | "late" | "awaiting";
type GroupBy = "client" | "status" | "time";

interface Props {
  day: string;
  onDayChange: (day: string) => void;
  onOpenClient: (responsibleId: string, day: string) => void;
}

export function DayDemands({ day, onDayChange, onOpenClient }: Props) {
  const { demands, loading, error, refresh } = useDayDemands(day);
  const [filter, setFilter] = useState<Filter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("client");
  const [query, setQuery] = useState("");
  const [calOpen, setCalOpen] = useState(false);

  const today = todayBR();
  const list = demands || [];

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: list.length, todo: 0, progress: 0, ready: 0, done: 0, other: 0, late: 0, awaiting: 0 };
    for (const d of list) {
      c[dayGroup(d.status)]++;
      if (isLate(d, today)) c.late++;
      if (awaitingReport(d)) c.awaiting++;
    }
    return c;
  }, [list, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortDemands(
      list.filter((d) => {
        if (filter === "late" && !isLate(d, today)) return false;
        if (filter === "awaiting" && !awaitingReport(d)) return false;
        if (filter !== "all" && filter !== "late" && filter !== "awaiting" && dayGroup(d.status) !== filter) return false;
        if (q && !`${d.client_name} ${d.name || ""}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
  }, [list, filter, query, today]);

  const groups = useMemo(() => {
    if (groupBy === "time") return [{ key: "all", label: "", responsibleId: null as string | null, items: visible }];
    const map = new Map<string, { key: string; label: string; responsibleId: string | null; items: DayDemand[] }>();
    for (const d of visible) {
      const k = groupBy === "client" ? d.responsible_id || "-" : d.status;
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          label: groupBy === "client" ? d.client_name || "Cliente" : statusMeta(d.status).label,
          responsibleId: groupBy === "client" ? d.responsible_id : null,
          items: [],
        });
      }
      map.get(k)!.items.push(d);
    }
    const arr = [...map.values()];
    if (groupBy === "client") arr.sort((a, b) => a.label.localeCompare(b.label));
    else arr.sort((a, b) => STATUS_ORDER.indexOf(a.key) - STATUS_ORDER.indexOf(b.key));
    return arr;
  }, [visible, groupBy]);

  const dateObj = parseISO(day);
  const relative = day === today ? "Hoje" : day === shiftDay(today, -1) ? "Ontem" : day === shiftDay(today, 1) ? "Amanhã" : null;
  const dateLabel = format(dateObj, "EEEE, d 'de' MMMM", { locale: ptBR });
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));
  const firstLoad = demands === null && loading;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Demandas do Dia</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {relative ? `${relative} · ${dateLabel}` : dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-r-none" onClick={() => onDayChange(shiftDay(day, -1))} aria-label="Dia anterior">
              <ChevronLeft />
            </Button>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-9 rounded-none border-x px-3 font-medium tabular-nums">
                  <CalendarDays className="text-muted-foreground" />
                  {format(dateObj, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  selected={dateObj}
                  defaultMonth={dateObj}
                  onSelect={(d) => {
                    if (d) onDayChange(format(d, "yyyy-MM-dd"));
                    setCalOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-l-none" onClick={() => onDayChange(shiftDay(day, 1))} aria-label="Próximo dia">
              <ChevronRight />
            </Button>
          </div>
          {day !== today && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => onDayChange(today)}>Hoje</Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 ml-auto lg:ml-0" onClick={refresh} disabled={loading} title="Atualizar" aria-label="Atualizar">
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Contadores = filtros */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {firstLoad
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)
          : ([{ key: "all", label: "Total" }, ...DAY_GROUPS] as { key: Filter; label: string }[]).map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => (g.key === "all" ? setFilter("all") : toggle(g.key))}
                aria-pressed={filter === g.key}
                className={cn(
                  "rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40",
                  filter === g.key && "border-primary ring-1 ring-primary bg-primary/5",
                )}
              >
                <div className="text-lg sm:text-xl font-bold tabular-nums leading-tight">{fmtInt(counts[g.key])}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground truncate">{g.label}</div>
              </button>
            ))}
      </div>

      {/* Destaques: só aparecem quando existem */}
      {(counts.late > 0 || counts.awaiting > 0) && (
        <div className="flex flex-wrap gap-2">
          {counts.late > 0 && (
            <button
              type="button"
              onClick={() => toggle("late")}
              aria-pressed={filter === "late"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === "late" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> {counts.late} {counts.late === 1 ? "atrasada" : "atrasadas"}
            </button>
          )}
          {counts.awaiting > 0 && (
            <button
              type="button"
              onClick={() => toggle("awaiting")}
              aria-pressed={filter === "awaiting"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === "awaiting" ? "bg-foreground text-background border-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <FileClock className="h-3.5 w-3.5" /> {counts.awaiting} aguardando relatório
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="relative sm:max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente ou ação" className="pl-9 pr-8" />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <SegmentedTabs<GroupBy>
          tabs={[
            { key: "client", label: "Por cliente" },
            { key: "status", label: "Por status" },
            { key: "time", label: "Por horário" },
          ]}
          value={groupBy}
          onChange={setGroupBy}
          className="sm:w-auto"
        />
      </div>

      {error && !demands ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as demandas"
            description={error}
            action={<Button variant="outline" onClick={refresh}><RefreshCw /> Tentar de novo</Button>}
          />
        </Card>
      ) : firstLoad ? (
        <Card className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={relative ? `Nenhuma demanda para ${relative.toLowerCase()}` : "Nenhuma demanda neste dia"}
            description="As demandas enviadas pelos seus clientes ou criadas pela equipe para este dia aparecem aqui."
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Nada encontrado com esse filtro"
            action={<Button variant="outline" onClick={() => { setFilter("all"); setQuery(""); }}>Limpar filtros</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key} className="overflow-hidden">
              {groupBy !== "time" && (
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-muted/40">
                  <div className="flex items-center gap-2 min-w-0">
                    {groupBy === "status" ? (
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", statusMeta(g.key).cls)}>{g.label}</span>
                    ) : (
                      <span className="text-sm font-semibold truncate">{g.label}</span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">{g.items.length}</span>
                  </div>
                  {g.responsibleId && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => onOpenClient(g.responsibleId!, day)}>
                      Abrir cliente <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
              <ul className="divide-y">
                {g.items.map((d) => (
                  <DemandRow
                    key={d.id}
                    d={d}
                    late={isLate(d, today)}
                    showClient={groupBy !== "client"}
                    showStatus={groupBy !== "status"}
                    onClick={d.responsible_id ? () => onOpenClient(d.responsible_id!, day) : undefined}
                  />
                ))}
              </ul>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center">
            Atualiza sozinho a cada minuto. O andamento é feito pela equipe; aqui é só acompanhamento.
          </p>
        </div>
      )}
    </div>
  );
}

function DemandRow({ d, late, showClient, showStatus, onClick }: { d: DayDemand; late: boolean; showClient: boolean; showStatus: boolean; onClick?: () => void }) {
  const m = statusMeta(d.status);
  const rate = d.report ? deliveryRate(d.report.sent, d.report.delivered) : null;
  const time = d.scheduled_time.trim();
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="w-full text-left px-4 py-3 flex items-start sm:items-center gap-3 hover:bg-muted/40 transition-colors disabled:cursor-default"
      >
        <span className={cn("w-14 shrink-0 text-sm tabular-nums font-medium pt-0.5 sm:pt-0", late ? "text-destructive" : "text-muted-foreground")}>
          {time ? time.slice(0, 8) : "—"}
        </span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="text-sm font-medium truncate">{d.name || "(sem nome)"}</div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5">
            {showClient && <span className="font-medium text-foreground/80">{d.client_name}</span>}
            {showClient && (d.volume_text || d.source === "team") && <span>·</span>}
            {d.volume_text && <span>{d.volume_text}</span>}
            {d.volume_text && d.source === "team" && <span>·</span>}
            {d.source === "team" && <span>Criada pela equipe</span>}
          </div>
          {/* No celular o resultado fica embaixo do nome */}
          <div className="sm:hidden pt-1 flex flex-wrap items-center gap-1.5">
            {showStatus && <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", m.cls)}>{m.label}</span>}
            <RowResult d={d} late={late} rate={rate} />
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <RowResult d={d} late={late} rate={rate} />
          {showStatus && (
            <span title={m.description} className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium w-[150px] justify-center truncate", m.cls)}>
              {m.label}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function RowResult({ d, late, rate }: { d: DayDemand; late: boolean; rate: number | null }) {
  if (d.report) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">
        {fmtInt(d.report.sent)} enviadas · <span className={RATE_TONE_CLASS[rateTone(rate)].text}>{fmtPct(rate)}</span>
      </span>
    );
  }
  if (late) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <Clock className="h-3.5 w-3.5" /> Atrasada
      </span>
    );
  }
  if (d.status === "disparado") return <span className="text-xs text-muted-foreground">Aguardando relatório</span>;
  return null;
}
