export function getDefaultDashboardPath(user: any) {
  const role = user?.role || 'work';
  if (role === 'hire') return '/dashboard/employer';
  if (role === 'admin' || role === 'superadmin') return '/admin';
  return '/dashboard/worker';
}
