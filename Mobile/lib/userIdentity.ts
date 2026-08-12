export const getUserInitials = (user: unknown): string => {
  if (!user || typeof user !== 'object') return 'U';
  const record = user as { firstName?: unknown; lastName?: unknown };
  const firstName = String(record.firstName || '').trim();
  const lastName = String(record.lastName || '').trim();
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  return initials || 'U';
};
