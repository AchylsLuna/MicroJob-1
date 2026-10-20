import { httpError, money } from './lifecyclePolicy.js';

const configuredAmount = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || money(value) !== value) throw httpError(503, 'Withdrawal limits are incorrectly configured. Contact support.');
  return value;
};

export function withdrawalPolicy(sourceWallet) {
  const minimum = configuredAmount('WITHDRAWAL_MIN_AMOUNT', 100);
  // Preserve the existing employer ceiling and worker policy unless configured.
  const maximum = configuredAmount(`WITHDRAWAL_${sourceWallet}_MAX_AMOUNT`, sourceWallet === 'EMPLOYER' ? 50000 : 0);
  const reviewThreshold = configuredAmount('WITHDRAWAL_REVIEW_THRESHOLD', 50000);
  if (minimum <= 0 || (maximum > 0 && maximum < minimum)) throw httpError(503, 'Withdrawal limits are incorrectly configured. Contact support.');
  return { minimum, maximum: maximum || null, reviewThreshold };
}

export function validateWithdrawalAmount(amount, sourceWallet) {
  const policy = withdrawalPolicy(sourceWallet);
  if (!Number.isFinite(amount) || amount !== money(amount) || amount < policy.minimum) throw httpError(400, `Enter an amount of at least PHP ${policy.minimum.toFixed(2)} with up to two decimal places.`);
  if (policy.maximum !== null && amount > policy.maximum) throw httpError(400, `The configured withdrawal maximum is PHP ${policy.maximum.toFixed(2)}.`);
  const requiresReview = sourceWallet === 'WORKER' || amount > policy.reviewThreshold;
  const reviewReason = amount > policy.reviewThreshold
    ? `This withdrawal exceeds the configured review threshold of PHP ${policy.reviewThreshold.toFixed(2)} and requires Finance approval before transfer.`
    : requiresReview ? 'Worker withdrawals require Finance approval before transfer.' : null;
  const reviewCodes = amount > policy.reviewThreshold ? ['threshold'] : requiresReview ? ['worker'] : [];
  return { ...policy, requiresReview, reviewReason, reviewCodes, processingMode: requiresReview ? 'manual' : 'automatic' };
}
