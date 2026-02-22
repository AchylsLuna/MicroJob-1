declare module '*AuthContext' {
  export function useAuth(): any;
  const _default: any;
  export default _default;
}

declare module '*useAdminData' {
  export type AdminUser = {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role?: string;
    phoneNumber?: string;
    status?: string;
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

  export function useAdminData(): {
    isLoading: boolean;
    loadError: string | null;
    stats: { totalUsers: number; activeUsers: number; totalJobs: number; pendingUsers: number; disabledUsers?: number };
    jobs: AdminJob[];
    users: AdminUser[];
    topCategories: any[];
    walletStats: any;
    recentPayouts: any[];
    recentActivity: any[];
    formatCurrency: (v: any) => string;
    formatSalary: (s: any) => string;
    formatDateFromObjectId: (id: string) => string;
    getJobStatusColor: (status?: string) => string;
    getStatusColor: (status?: string) => string;
    handleApproveUser: (user: AdminUser) => void;
    handleToggleUserStatus: (user: AdminUser) => void;
    categoriesById: Map<string, { name?: string }>;
  };
  const _default: any;
  export default _default;
}

declare module '*dashboardRoutes' {
  export function getDefaultDashboardPath(user: any): string;
  const _default: any;
  export default _default;
}

declare module '*toast' {
  export const toast: any;
}

declare module 'web-vitals' {
  export type ReportHandler = (metric: any) => void;
  export function getCLS(onReport?: ReportHandler): void;
  export function getFID(onReport?: ReportHandler): void;
  export function getFCP(onReport?: ReportHandler): void;
  export function getLCP(onReport?: ReportHandler): void;
  export function getTTFB(onReport?: ReportHandler): void;
}

declare module '*AnalyticsOverview' {
  import * as React from 'react';
  export function AnalyticsOverview(props: any): React.JSX.Element;
}
