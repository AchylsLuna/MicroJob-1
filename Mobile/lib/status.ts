export type ApplicationStatus =
  | 'Applied'
  | 'Shortlisted'
  | 'Interview Scheduled'
  | 'Interviewed'
  | 'Offer Sent'
  | 'Hired'
  | 'Rejected'
  | 'Withdrawn';

const LEGACY_STATUS_MAP: Record<string, ApplicationStatus> = {
  Pending: 'Applied',
  Reviewed: 'Shortlisted',
  Terms: 'Offer Sent',
  Interviewed: 'Interview Scheduled',
  Accepted: 'Hired',
  'To Be Interview': 'Interview Scheduled',
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Offer Sent',
  'Hired',
  'Rejected',
  'Withdrawn',
];

export function normalizeApplicationStatus(value: unknown): ApplicationStatus {
  if (typeof value !== 'string') return 'Applied';
  if (APPLICATION_STATUSES.includes(value as ApplicationStatus)) {
    return value as ApplicationStatus;
  }
  return LEGACY_STATUS_MAP[value] || 'Applied';
}

export function getApplicationStatusColor(status: ApplicationStatus): string {
  switch (status) {
    case 'Applied':
      return '#1C4D8D';
    case 'Shortlisted':
      return '#f59e0b';
    case 'Interview Scheduled':
      return '#7c3aed';
    case 'Interviewed':
      return '#0f766e';
    case 'Offer Sent':
      return '#ea580c';
    case 'Hired':
      return '#10b981';
    case 'Rejected':
      return '#ef4444';
    case 'Withdrawn':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}
