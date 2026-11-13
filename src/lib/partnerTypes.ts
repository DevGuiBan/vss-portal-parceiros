export interface ClientStat {
  id: string;
  name: string;
  email: string | null;
  unit_price: number;
  sent: number;
  delivered: number;
}

export interface ClientSubmission {
  id: string;
  action_name?: string | null;
  created_at: string;
  demand_id?: string | null;
  demand_status?: string | null;
  status?: string | null;
  /** portal = enviada pelo cliente; team = criada pela equipe no app principal. */
  source?: "portal" | "team";
  admin_deleted_at?: string | null;
}

export interface ManualReportRow {
  demand_id: string | null;
  sent: number;
  delivered: number;
  failures: number;
}

/** Faturamento estimado = mensagens ENTREGUES × custo unitário (cobrança só pelas entregues). */
export function estimatedRevenue(c: Pick<ClientStat, "delivered" | "unit_price">) {
  return (Number(c.delivered) || 0) * (Number(c.unit_price) || 0);
}
