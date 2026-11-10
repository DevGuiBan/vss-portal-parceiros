// Status das demandas (daily_demands) exibidos para parceiro e cliente.

export interface StatusMeta {
  label: string;
  cls: string;
  description: string;
  group: "progress" | "done" | "cancelled";
}

export const DEMAND_STATUS_META: Record<string, StatusMeta> = {
  pending: {
    label: "Recebida",
    cls: "bg-warning/15 text-amber-700 border-warning/30",
    description: "Recebemos a solicitação e ela está aguardando a equipe iniciar.",
    group: "progress",
  },
  pendente: {
    label: "A Fazer",
    cls: "bg-warning/15 text-amber-700 border-warning/30",
    description: "Na fila da equipe para começar.",
    group: "progress",
  },
  conexao_numero: {
    label: "Conexão de Número",
    cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
    description: "Estamos conectando o número que fará os envios.",
    group: "progress",
  },
  aprovacao_template: {
    label: "Template em Aprovação",
    cls: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    description: "A mensagem foi enviada para aprovação do WhatsApp.",
    group: "progress",
  },
  producao: {
    label: "Em Produção",
    cls: "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30",
    description: "A demanda está sendo preparada para o disparo.",
    group: "progress",
  },
  pronto: {
    label: "Pronto",
    cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    description: "Tudo pronto, aguardando o horário do disparo.",
    group: "progress",
  },
  disparado: {
    label: "Disparado",
    cls: "bg-success/15 text-emerald-700 border-success/30",
    description: "Mensagens enviadas. O relatório aparece assim que for conferido.",
    group: "done",
  },
  remarcado: {
    label: "Remarcado",
    cls: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    description: "O disparo foi reagendado para outra data.",
    group: "progress",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
    description: "Esta demanda foi cancelada.",
    group: "cancelled",
  },
};

/** Ordem dos status no fluxo, usada em legendas e filtros. */
export const STATUS_ORDER = ["pending", "pendente", "conexao_numero", "aprovacao_template", "producao", "pronto", "remarcado", "disparado", "cancelado"];

const FALLBACK: StatusMeta = {
  label: "Processado",
  cls: "bg-primary/15 text-primary border-primary/30",
  description: "Solicitação processada pela equipe.",
  group: "progress",
};

/** Status efetivo: o da demanda (quando já vinculada) ou o da solicitação. */
export function effectiveStatus(s: { demand_status?: string | null; status?: string | null }) {
  return s.demand_status || (s.status === "pending" ? "pending" : s.status || "pending");
}

export function statusMeta(key: string | null | undefined): StatusMeta {
  return (key && DEMAND_STATUS_META[key]) || FALLBACK;
}
