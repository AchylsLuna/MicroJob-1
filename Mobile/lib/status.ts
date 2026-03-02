export type ApplicationStatus = 'Pending' | 'Shortlisted' | 'Terms' | 'Hired';

const LEGACY_STATUS_MAP: Record<string, ApplicationStatus> = {
  Reviewed: 'Shortlisted',
  Accepted: 'Hired',
  Rejected: 'Pending',
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Pending',
  'Shortlisted',
  'Terms',
  'Hired',
];

export function normalizeApplicationStatus(value: unknown): ApplicationStatus {
  if (typeof value !== 'string') return 'Pending';
  if (APPLICATION_STATUSES.includes(value as ApplicationStatus)) {
    return value as ApplicationStatus;
  }
  return LEGACY_STATUS_MAP[value] || 'Pending';
}

export function getApplicationStatusColor(status: ApplicationStatus): string {
  switch (status) {
    case 'Pending':
      return '#3b82f6';
    case 'Shortlisted':
      return '#f59e0b';
    case 'Terms':
      return '#a855f7';
    case 'Hired':
      return '#10b981';
    default:
      return '#6b7280';
  }
}
