export const APPLICATION_STATUSES = [
  'Applied',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Offer Sent',
  'Hired',
  'Rejected',
  'Withdrawn',
];

export const LEGACY_APPLICATION_STATUS_MAP = {
  Pending: 'Applied',
  Reviewed: 'Shortlisted',
  Terms: 'Offer Sent',
  Accepted: 'Hired',
  Interviewed: 'Interview Scheduled',
  Shortlisted: 'Shortlisted',
  Rejected: 'Rejected',
  Hired: 'Hired',
  Withdrawn: 'Withdrawn',
  Applied: 'Applied',
  'Interview Scheduled': 'Interview Scheduled',
  'Offer Sent': 'Offer Sent',
};

export const APPLICATION_STATUS_LABELS = {
  Applied: 'Applied',
  Shortlisted: 'Shortlisted',
  'Interview Scheduled': 'Interview Scheduled',
  Interviewed: 'Interviewed',
  'Offer Sent': 'Offer Sent',
  Hired: 'Hired',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
};

export const ACTIVE_APPLICATION_STATUSES = APPLICATION_STATUSES.filter(
  (status) => !['Rejected', 'Withdrawn', 'Hired'].includes(status)
);

export function toCanonicalApplicationStatus(status) {
  if (!status || typeof status !== 'string') return null;
  if (APPLICATION_STATUSES.includes(status)) return status;
  return LEGACY_APPLICATION_STATUS_MAP[status] || null;
}

export function isCanonicalApplicationStatus(status) {
  return APPLICATION_STATUSES.includes(status);
}

export function isTerminalApplicationStatus(status) {
  return ['Hired', 'Rejected', 'Withdrawn'].includes(status);
}

export function getApplicationTimelineLabel(status) {
  return APPLICATION_STATUS_LABELS[toCanonicalApplicationStatus(status) || status] || 'Updated';
}
