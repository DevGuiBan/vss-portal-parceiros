interface ManualReportLike {
  demand_id?: string | null;
  sent: number;
  delivered: number;
  failures?: number;
}

/**
 * Soma os manual_reports (lançados pelos operadores no app principal, via
 * daily_demands) vinculados ao demand_id de uma solicitação do portal.
 */
export function matchManualReport(demandId: string | null | undefined, reports: ManualReportLike[]) {
  if (!demandId) return null;
  const matches = reports.filter((r) => r.demand_id === demandId);
  if (matches.length === 0) return null;
  return matches.reduce(
    (acc, r) => ({
      sent: acc.sent + (Number(r.sent) || 0),
      delivered: acc.delivered + (Number(r.delivered) || 0),
      failures: acc.failures + (Number(r.failures) || 0),
    }),
    { sent: 0, delivered: 0, failures: 0 },
  );
}
