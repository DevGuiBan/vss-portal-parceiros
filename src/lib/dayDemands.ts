// Demandas do Dia (somente leitura): todas as demandas dos clientes do
// parceiro em um dia, via partner-api `list-day-demands`.
import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { callPartnerApi } from "@/lib/partnerApi";
import { cachedFetch, peek } from "@/lib/queryCache";
import type { ReportTotals } from "@/lib/dispatchReport";

export interface DayDemand {
  id: string;
  date: string;
  responsible_id: string | null;
  client_name: string;
  name: string | null;
  scheduled_time: string;
  volume_text: string;
  status: string;
  source: "portal" | "team";
  order_index: number;
  report: ReportTotals | null;
}

/** Grupos de status usados nos contadores e filtros da tela. */
export type DayGroup = "todo" | "progress" | "ready" | "done" | "other";

export const DAY_GROUPS: { key: DayGroup; label: string }[] = [
  { key: "todo", label: "A fazer" },
  { key: "progress", label: "Em andamento" },
  { key: "ready", label: "Prontas" },
  { key: "done", label: "Disparadas" },
  { key: "other", label: "Canceladas/remarcadas" },
];

export function dayGroup(status: string): DayGroup {
  switch (status) {
    case "pending":
    case "pendente":
      return "todo";
    case "pronto":
      return "ready";
    case "disparado":
      return "done";
    case "cancelado":
    case "remarcado":
      return "other";
    default:
      return "progress";
  }
}

/** "Hoje" no fuso de Brasília (UTC-3), em YYYY-MM-DD. */
export function todayBR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Minutos desde 00:00 do horário BR agora. */
function nowMinutesBR(): number {
  const d = new Date(Date.now() - 3 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function shiftDay(day: string, delta: number): string {
  return format(addDays(parseISO(day), delta), "yyyy-MM-dd");
}

/**
 * Horário em minutos, só quando o texto livre tem formato reconhecível
 * ("14:30", "9h", "09h15"). Caso contrário null (não ordena nem marca atraso).
 */
export function parseTime(text: string): number | null {
  const m = /\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?\b/i.exec(text || "");
  if (!m) return null;
  return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
}

/** Atrasada: horário passou (ou o dia passou) e ainda não foi disparada. */
export function isLate(d: DayDemand, today = todayBR()): boolean {
  const g = dayGroup(d.status);
  if (g === "done" || g === "other") return false;
  if (d.date < today) return true;
  if (d.date > today) return false;
  const t = parseTime(d.scheduled_time);
  return t !== null && t < nowMinutesBR();
}

export function awaitingReport(d: DayDemand): boolean {
  return d.status === "disparado" && !d.report;
}

export function sortDemands(list: DayDemand[]): DayDemand[] {
  return [...list].sort((a, b) => {
    const ta = parseTime(a.scheduled_time) ?? 24 * 60;
    const tb = parseTime(b.scheduled_time) ?? 24 * 60;
    return ta - tb || a.order_index - b.order_index || a.client_name.localeCompare(b.client_name);
  });
}

const TTL = 30_000;
const POLL = 60_000;
const key = (day: string) => `partner:day:${day}`;

async function fetchDay(day: string, force = false) {
  return cachedFetch(key(day), TTL, async () => {
    const j = await callPartnerApi("list-day-demands", { date: day });
    return (j.demands || []) as DayDemand[];
  }, { force });
}

/**
 * Carrega as demandas do dia com cache (trocar de dia e voltar é instantâneo)
 * e atualiza a cada 60 s enquanto a aba do navegador estiver visível.
 */
export function useDayDemands(day: string, enabled = true) {
  const [demands, setDemands] = useState<DayDemand[] | null>(() => peek<DayDemand[]>(key(day)) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const dayRef = useRef(day);
  dayRef.current = day;

  const load = useCallback(async (force = false) => {
    const target = dayRef.current;
    const cached = peek<DayDemand[]>(key(target));
    if (cached) setDemands(cached);
    else setDemands(null);
    setLoading(true);
    try {
      const list = await fetchDay(target, force);
      if (dayRef.current !== target) return;
      setDemands(list);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      if (dayRef.current === target) setError(e?.message || "Erro ao carregar demandas");
    } finally {
      if (dayRef.current === target) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, POLL);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [day, enabled, load]);

  return { demands, loading, error, updatedAt, refresh: () => load(true) };
}
