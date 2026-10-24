interface DispatchReportLike {
  dispatch_id: string;
  quantity_sent: number;
  delivered: number;
  failures: number;
}

/** Soma os dispatch_reports vinculados ao dispatch_id de uma demanda. */
export function matchDispatchReport(dispatchId: string | null | undefined, reports: DispatchReportLike[]) {
  if (!dispatchId) return null;
  const matches = reports.filter((r) => r.dispatch_id === dispatchId);
  if (matches.length === 0) return null;
  return matches.reduce(
    (acc, r) => ({
      sent: acc.sent + (Number(r.quantity_sent) || 0),
      delivered: acc.delivered + (Number(r.delivered) || 0),
      failures: acc.failures + (Number(r.failures) || 0),
    }),
    { sent: 0, delivered: 0, failures: 0 },
  );
}
