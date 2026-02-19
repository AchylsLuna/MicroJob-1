import React from 'react';
import { useAuth } from '../hooks/useAuth';
import WorkerNotifications from './worker/Notifications';
import EmployerNotifications from './employer/Notifications';

// Router component that picks the notifications page based on role
export default function NotificationsRouter() {
  const auth = useAuth();
  const role = auth?.role || 'work';
  if (role === 'hire') return <EmployerNotifications />;
  return <WorkerNotifications />;
}
