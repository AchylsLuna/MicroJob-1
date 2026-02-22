import { useMemo, useState } from 'react';

export type AdminUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  status?: string;
  role?: string;
};

export type AdminJob = {
  _id: string;
  title?: string;
  salary?: string;
  status?: string;
  createdAt?: string;
  applicants?: string[];
  jobPoster?: any;
  location?: string;
  category?: string | { _id?: string; name?: string };
};

export function useAdminData() {
  // Minimal stubbed admin data to prevent compile errors.
  const [isLoading] = useState(false);
  const [loadError] = useState<string | null>(null);

  const stats = useMemo(() => ({ totalUsers: 0, activeUsers: 0, totalJobs: 0, pendingUsers: 0 }), []);
  // include disabledUsers for admin security/management views
  const extendedStats = useMemo(() => ({ ...stats, disabledUsers: 0 }), [stats]);
  const jobs: AdminJob[] = [];
  const users: AdminUser[] = [];
  const topCategories: any[] = [];
  const walletStats = { completedCount: 0, completedTotal: 0, pendingCount: 0, pendingTotal: 0, averageCompleted: 0 };
  const recentPayouts: any[] = [];
  const recentActivity: any[] = [];
  const categoriesById = new Map<string, { name?: string }>();

  function getStatusColor(status?: string) {
    if (!status) return "bg-green-100 text-green-800";
    if (status === "disabled") return "bg-red-100 text-red-800";
    if (status === "pending") return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  }

  function handleApproveUser(user: AdminUser | any) {
    // no-op stub: real implementation should call the API and update state
    console.info("approve user", user);
  }

  function handleToggleUserStatus(user: AdminUser | any) {
    // no-op stub: real implementation should call the API and update state
    console.info("toggle user status", user);
  }

  const formatCurrency = (v: any) => (typeof v === 'number' ? `₱${v.toFixed(2)}` : v || '₱0.00');
  const formatSalary = (s: any) => s || '₱0';
  const formatDateFromObjectId = (id: string) => new Date().toLocaleDateString();
  const getJobStatusColor = (status?: string) => {
    if (!status) return 'bg-green-100 text-green-800';
    if (status === 'disabled') return 'bg-red-100 text-red-800';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return {
    isLoading,
    loadError,
    stats: extendedStats,
    jobs,
    users,
    topCategories,
    walletStats,
    recentPayouts,
    recentActivity,
    formatCurrency,
    formatSalary,
    formatDateFromObjectId,
    getJobStatusColor,
    getStatusColor,
    handleApproveUser,
    handleToggleUserStatus,
    categoriesById,
  };
}
