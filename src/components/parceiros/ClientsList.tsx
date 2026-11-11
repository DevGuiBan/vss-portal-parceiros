import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, KeyRound, Plus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, type DateRange } from "@/components/common/PeriodFilter";
import { EmptyState, RateBadge } from "@/components/common/Metrics";
import { fmtBRL, fmtInt, fmtUnitPrice, deliveryRate } from "@/lib/format";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { estimatedRevenue, type ClientStat } from "@/lib/partnerTypes";
import { cn } from "@/lib/utils";

export type DetailTab = "summary" | "dispatches" | "access";

type SortKey = "name" | "sent" | "delivered" | "rate" | "revenue";

const PAGE = 50;

const SORT_LABEL: Record<SortKey, string> = {
  name: "Nome",
  sent: "Enviadas",
  delivered: "Entregues",
  rate: "Taxa de entrega",
  revenue: "Valor estimado",
};

interface Props {
  clients: ClientStat[];
  loading: boolean;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  onOpenClient: (c: ClientStat, tab?: DetailTab) => void;
  onCreate: () => void;
}

function sortValue(c: ClientStat, key: SortKey): number | string {
  switch (key) {
    case "name": return normalizeSearch(c.name);
    case "sent": return c.sent;
    case "delivered": return c.delivered;
    case "rate": return deliveryRate(c.sent, c.delivered) ?? -1;
    case "revenue": return estimatedRevenue(c);
  }
}

export function ClientsList({ clients, loading, range, onRangeChange, onOpenClient, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE);

  useEffect(() => { setVisibleCount(PAGE); }, [query, sortKey, sortDir]);

  const rows = useMemo(() => {
    const q = normalizeSearch(query).trim();
    const list = q
      ? clients.filter((c) => normalizeSearch(`${c.name} ${c.email || ""}`).includes(q))
      : [...clients];
    list.sort((a, b) => {
      const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [clients, query, sortKey, sortDir]);

  const totals = useMemo(
    () => rows.reduce((a, c) => ({ sent: a.sent + c.sent, revenue: a.revenue + estimatedRevenue(c) }), { sent: 0, revenue: 0 }),
    [rows],
  );

  const visibleRows = rows.slice(0, visibleCount);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("py-3 px-4 font-medium", className)}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors", sortKey === k && "text-foreground")}
      >
        {children}
        {sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Clique em um cliente para ver o relatório e os acessos.</p>
        </div>
        <Button onClick={onCreate} className="w-full sm:w-auto"><Plus /> Novo cliente</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9 pr-9" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <PeriodFilter value={range} onChange={onRangeChange} size="default" className="sm:w-56" />
        <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setSortDir(v === "name" ? "asc" : "desc"); }}>
          <SelectTrigger className="md:hidden">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>Ordenar por: {SORT_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente cadastrado ainda"
              description="Cadastre um cliente para gerar o acesso dele ao portal."
              action={<Button onClick={onCreate}><Plus /> Cadastrar cliente</Button>}
            />
          ) : (
            <EmptyState icon={Search} title="Nenhum cliente encontrado" description="Tente buscar por outro nome ou e-mail." />
          )}
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {fmtInt(rows.length)} cliente{rows.length === 1 ? "" : "s"} · {fmtInt(totals.sent)} enviadas · {fmtBRL(totals.revenue)} estimado
          </p>

          {/* Desktop */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/40 border-b">
                <tr>
                  <Th k="name" className="text-left">Cliente</Th>
                  <Th k="sent" className="text-right">Enviadas</Th>
                  <Th k="delivered" className="text-right">Entregues</Th>
                  <Th k="rate" className="text-right">Taxa</Th>
                  <th className="py-3 px-4 font-medium text-right">Custo unit.</th>
                  <Th k="revenue" className="text-right">Valor estimado</Th>
                  <th className="py-3 px-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/40 group" onClick={() => onOpenClient(c)}>
                    <td className="py-3 px-4">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email || "—"}</div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{fmtInt(c.sent)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{fmtInt(c.delivered)}</td>
                    <td className="py-3 px-4 text-right"><RateBadge sent={c.sent} delivered={c.delivered} /></td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {c.unit_price ? fmtUnitPrice(c.unit_price) : <span className="text-amber-600 text-xs">Não definido</span>}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium">{fmtBRL(estimatedRevenue(c))}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          title="Acessos e senha"
                          aria-label="Acessos e senha"
                          onClick={(e) => { e.stopPropagation(); onOpenClient(c, "access"); }}
                        >
                          <KeyRound />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {visibleRows.map((c) => (
              <button key={c.id} type="button" onClick={() => onOpenClient(c)} className="w-full text-left">
                <Card className="p-4 active:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email || "—"}</div>
                    </div>
                    <RateBadge sent={c.sent} delivered={c.delivered} className="shrink-0" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="rounded-md bg-muted/50 py-1.5">
                      <div className="text-sm font-semibold tabular-nums">{fmtInt(c.sent)}</div>
                      <div className="text-[10px] text-muted-foreground">Enviadas</div>
                    </div>
                    <div className="rounded-md bg-muted/50 py-1.5">
                      <div className="text-sm font-semibold tabular-nums text-emerald-600">{fmtInt(c.delivered)}</div>
                      <div className="text-[10px] text-muted-foreground">Entregues</div>
                    </div>
                    <div className="rounded-md bg-muted/50 py-1.5">
                      <div className="text-sm font-semibold tabular-nums">{fmtBRL(estimatedRevenue(c))}</div>
                      <div className="text-[10px] text-muted-foreground">Estimado</div>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          {rows.length > visibleCount && (
            <Button variant="outline" className="w-full" onClick={() => setVisibleCount((n) => n + PAGE)}>
              Mostrar mais ({rows.length - visibleCount} restantes)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
