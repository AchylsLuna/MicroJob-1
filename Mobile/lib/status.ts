export type ApplicationStatus = 'Shortlisted' | 'To Be Interview' | 'Hired';

const LEGACY_STATUS_MAP: Record<string, ApplicationStatus> = {
  Pending: 'Shortlisted',
  Reviewed: 'Shortlisted',
  Terms: 'To Be Interview',
  Interviewed: 'To Be Interview',
  Accepted: 'Hired',
  Rejected: 'Shortlisted',
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Shortlisted',
  'To Be Interview',
  'Hired',
];

export function normalizeApplicationStatus(value: unknown): ApplicationStatus {
  if (typeof value !== 'string') return 'Shortlisted';
  if (APPLICATION_STATUSES.includes(value as ApplicationStatus)) {
    return value as ApplicationStatus;
  }
  return LEGACY_STATUS_MAP[value] || 'Shortlisted';
}

export function getApplicationStatusColor(status: ApplicationStatus): string {
  switch (status) {
    case 'Shortlisted':
      return '#f59e0b';
    case 'To Be Interview':
      return '#a855f7';
    case 'Hired':
      return '#10b981';
    default:
      return '#6b7280';
  }
}
