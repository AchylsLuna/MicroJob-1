type TransactionDescriptionInput = {
  type?: string;
  label?: string | null;
  jobReference?: { _id?: string; title?: string } | string | null;
};

export function getTransactionDescription(transaction: TransactionDescriptionInput) {
  const label = (transaction.label || '').replace(/\s*\(Job\s+[a-f\d]{24}\)/gi, '').trim();
  const job = transaction.jobReference;
  let key: string | null = null;
  if (/^Non-refundable posting fee$/i.test(label)) key = 'postingFee';
  else if (/^Non-refundable highlight fee$/i.test(label)) key = 'highlightFee';
  else if (/^Escrow adjustment on job update$/i.test(label)) key = 'reservationAdjustment';
  else if (/^Escrow$/i.test(label) || (!label && transaction.type === 'ESCROW')) key = 'fundsReserved';
  return {
    label,
    key,
    jobTitle: job && typeof job === 'object' ? job.title?.trim() || '' : '',
    jobId: job && typeof job === 'object' ? job._id || '' : '',
  };
}
