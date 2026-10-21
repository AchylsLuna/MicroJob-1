import { financialReportTerminology } from '../lib/financialReportTerminology.js';
import Cancellation from '../models/Cancellation.js';
import Transaction from '../models/Transaction.js';
import { hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';

export const csvCell = (value) => {
  let text = value == null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export async function exportLifecycleReport(req, res) {
  try {
    const type = req.params.type;
    if (!['cancellations', 'financial-history'].includes(type)) return res.sendStatus(404);
    if (type === 'financial-history' && !hasPermission(resolveStaffRole(req.user), 'finance.transactions.view')) return res.sendStatus(403);
    const filter = {};
    if (req.query.from || req.query.to) {
      const from = req.query.from ? new Date(`${req.query.from}T00:00:00+08:00`) : null;
      const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999+08:00`) : null;
      if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime())) || (from && to && from > to)) return res.status(400).json({ message: 'Invalid report date range.' });
      filter[type === 'cancellations' ? 'occurredAt' : 'createdAt'] = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }
    const records = type === 'cancellations' ? await Cancellation.find(filter).sort({ createdAt: -1 }).lean() : await Transaction.find(filter).populate('payoutRequest', 'sourceWallet processingMode status providerTransferId providerRailReference providerFee transferReference events').sort({ createdAt: -1 }).lean();
    const relatedTransactions = type === 'cancellations' ? await Transaction.find({ jobReference: { $in: records.map((item) => item.job) } }).select('_id jobReference relatedEntityType relatedEntityId reference').lean() : [];
    const rows = records.map((item) => type === 'cancellations' ? { id: String(item._id), jobId: String(item.job), applicationId: item.application ? String(item.application) : '', scope: item.scope, linkedTransactions: JSON.stringify(relatedTransactions.filter((tx) => String(tx.jobReference) === String(item.job) && (item.scope === 'job' || tx.relatedEntityId === String(item.application) || tx.relatedEntityId === String(item.offer) || tx.reference === `offer-extra-refund:${item.offer}`)).map((tx) => ({ id: String(tx._id), reference: tx.reference }))), actor: item.actor ? String(item.actor) : 'Not recorded', reason: item.reason || 'Not recorded', status: item.status, workerPayment: item.workerPayment, cancelledAt: item.occurredAt?.toISOString() || '', resolvedAt: item.resolvedAt?.toISOString() || '', events: JSON.stringify(item.events || []) } : { id: String(item._id), jobId: item.jobReference ? String(item.jobReference) : '', applicationId: item.relatedEntityType === 'job_application' ? item.relatedEntityId : '', ...financialReportTerminology(item), transactionTypeCode: item.type, balanceTarget: item.balanceTarget || '', type: item.type === 'PAYOUT' ? item.payoutRequest ? 'Withdrawal' : 'Job payment' : item.type, status: item.status || '', amount: item.amount, fundingSources: JSON.stringify(item.meta?.fundingSources || {}), actor: item.actor ? String(item.actor) : 'Not recorded', sender: item.sender ? String(item.sender) : '', receiver: item.receiver ? String(item.receiver) : '', reason: item.meta?.reason || item.label || 'Not recorded', linkedTransaction: item.linkedTransaction ? String(item.linkedTransaction) : '', processingMode: item.payoutRequest?.processingMode || '', reference: item.reference || '', providerRailReference: item.payoutRequest?.providerRailReference || '', providerFee: item.payoutRequest?.providerFee || 0, providerReference: item.payoutRequest?.providerTransferId || item.payoutRequest?.transferReference || item.providerReference || '', events: JSON.stringify(item.payoutRequest?.events || []), createdAt: item.createdAt.toISOString() });
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      const columns = Object.keys(rows[0] || (type === 'cancellations' ? { id: '', reason: '', cancelledAt: '' } : { id: '', amount: '', createdAt: '' }));
      return res.send([columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\r\n'));
    }
    return res.json({ rows, timezone: 'Asia/Manila' });
  } catch { return res.status(500).json({ message: 'Unable to export this report.' }); }
}
