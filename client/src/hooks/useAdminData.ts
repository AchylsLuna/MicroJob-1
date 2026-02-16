import { useEffect, useMemo, useState } from "react";
import { toast } from "../lib/toast";
import { deleteUser, getCategories, getJobs, getUserList, updateUserStatus } from "../services/api";

export type AdminUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string | null;
  role?: "hire" | "work" | "both" | "admin" | "superadmin";
  status?: "active" | "pending" | "disabled";
};

export type AdminJob = {
  _id: string;
  title: string;
  status?: "Available" | "In Progress" | "Completed" | "Cancelled";
  salary?: string;
  location?: string;
  createdAt?: string;
  applicants?: string[];
  category?: { _id: string; name: string } | string | null;
  jobPoster?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
};

export type AdminCategory = {
  _id: string;
  name: string;
};

export function useAdminData() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [userList, jobList, categoryList] = await Promise.all([
          getUserList(),
          getJobs(),
          getCategories(),
        ]);
        if (!isActive) return;
        setUsers(Array.isArray(userList) ? userList : []);
        setJobs(Array.isArray(jobList) ? jobList : []);
        setCategories(Array.isArray(categoryList) ? categoryList : []);
      } catch (error: any) {
        if (!isActive) return;
        const message = error?.message || "Failed to load admin data.";
        setLoadError(message);
        toast.error(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  const jobsByUser = useMemo(() => {
    const map = new Map<string, number>();
    jobs.forEach((job) => {
      const posterId = typeof job.jobPoster === "string" ? job.jobPoster : job.jobPoster?._id;
      if (!posterId) return;
      map.set(posterId, (map.get(posterId) || 0) + 1);
    });
    return map;
  }, [jobs]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, AdminCategory>();
    categories.forEach((category) => {
      map.set(category._id, category);
    });
    return map;
  }, [categories]);

  const jobsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    jobs.forEach((job) => {
      const categoryId = typeof job.category === "string" ? job.category : job.category?._id;
      if (!categoryId) return;
      map.set(categoryId, (map.get(categoryId) || 0) + 1);
    });
    return map;
  }, [jobs]);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "active").length,
      pendingUsers: users.filter((u) => u.status === "pending").length,
      disabledUsers: users.filter((u) => u.status === "disabled").length,
      totalJobs: jobs.length,
      availableJobs: jobs.filter((j) => j.status === "Available").length,
      totalCategories: categories.length,
    }),
    [users, jobs, categories],
  );

  const topCategories = useMemo(() => {
    return categories
      .map((category) => ({
        id: category._id,
        name: category.name,
        count: jobsByCategory.get(category._id) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [categories, jobsByCategory]);

  const parseSalary = (value?: string) => {
    if (!value) return 0;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const amount = Number.parseFloat(cleaned);
    return Number.isFinite(amount) ? amount : 0;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

  const formatSalary = (salary?: string) => {
    const amount = parseSalary(salary);
    if (amount > 0) return formatCurrency(amount);
    return salary || "—";
  };

  const walletStats = useMemo(() => {
    const completedJobs = jobs.filter((job) => job.status === "Completed");
    const inProgressJobs = jobs.filter((job) => job.status === "In Progress");
    const completedTotal = completedJobs.reduce((sum, job) => sum + parseSalary(job.salary), 0);
    const pendingTotal = inProgressJobs.reduce((sum, job) => sum + parseSalary(job.salary), 0);
    return {
      completedCount: completedJobs.length,
      pendingCount: inProgressJobs.length,
      completedTotal,
      pendingTotal,
      averageCompleted: completedJobs.length ? Math.round(completedTotal / completedJobs.length) : 0,
    };
  }, [jobs]);

  const recentPayouts = useMemo(() => {
    return [...jobs]
      .filter((job) => job.status === "Completed")
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [jobs]);

  const recentActivity = useMemo(() => {
    const activities: Array<{ id: string; title: string; subtitle: string; date: Date; type: "user" | "job" }> = [];
    const sortedUsers = [...users].sort((a, b) => {
      const aTime = parseInt(a._id.slice(0, 8), 16) * 1000;
      const bTime = parseInt(b._id.slice(0, 8), 16) * 1000;
      return bTime - aTime;
    });
    sortedUsers.slice(0, 6).forEach((u) => {
      const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
      const date = new Date(parseInt(u._id.slice(0, 8), 16) * 1000);
      activities.push({
        id: `user-${u._id}`,
        title: "New user registered",
        subtitle: name,
        date,
        type: "user",
      });
    });

    const sortedJobs = [...jobs].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    sortedJobs.slice(0, 6).forEach((job) => {
      const date = job.createdAt ? new Date(job.createdAt) : new Date();
      activities.push({
        id: `job-${job._id}`,
        title: "New job posted",
        subtitle: job.title,
        date,
        type: "job",
      });
    });

    return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  }, [users, jobs]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-[#D1FAE5] text-[#065F46]";
      case "disabled":
        return "bg-[#FEE2E2] text-[#991B1B]";
      case "pending":
        return "bg-[#FEF3C7] text-[#92400E]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case "admin":
      case "superadmin":
        return "bg-[#E9D5FF] text-[#6B21A8]";
      case "hire":
        return "bg-[#DBEAFE] text-[#1E40AF]";
      case "both":
        return "bg-[#FDE68A] text-[#92400E]";
      default:
        return "bg-[#D1FAE5] text-[#065F46]";
    }
  };

  const getJobStatusColor = (status?: string) => {
    switch (status) {
      case "Available":
        return "bg-[#D1FAE5] text-[#065F46]";
      case "In Progress":
        return "bg-[#DBEAFE] text-[#1E40AF]";
      case "Completed":
        return "bg-[#E9D5FF] text-[#6B21A8]";
      case "Cancelled":
        return "bg-[#FEE2E2] text-[#991B1B]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const formatDateFromObjectId = (id?: string) => {
    if (!id || id.length < 8) return "—";
    const timestamp = parseInt(id.slice(0, 8), 16) * 1000;
    return new Date(timestamp).toLocaleDateString();
  };

  const getUserDisplayName = (u: AdminUser) =>
    `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;

  const handleApproveUser = async (u: AdminUser) => {
    try {
      await updateUserStatus(u._id, "active");
      setUsers((prev) => prev.map((item) => (item._id === u._id ? { ...item, status: "active" } : item)));
      toast.success(`User ${getUserDisplayName(u)} approved`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve user");
    }
  };

  const handleToggleUserStatus = async (u: AdminUser) => {
    const nextStatus = u.status === "disabled" ? "active" : "disabled";
    try {
      await updateUserStatus(u._id, nextStatus);
      setUsers((prev) => prev.map((item) => (item._id === u._id ? { ...item, status: nextStatus } : item)));
      toast.success(`User ${getUserDisplayName(u)} ${nextStatus === "disabled" ? "disabled" : "activated"}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update user status");
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    const label = getUserDisplayName(u);
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteUser(u._id);
      setUsers((prev) => prev.filter((item) => item._id !== u._id));
      toast.success(`User ${label} deleted`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete user");
    }
  };

  return {
    users,
    jobs,
    categories,
    isLoading,
    loadError,
    stats,
    topCategories,
    recentActivity,
    walletStats,
    recentPayouts,
    jobsByUser,
    categoriesById,
    getStatusColor,
    getRoleColor,
    getJobStatusColor,
    formatDateFromObjectId,
    formatCurrency,
    formatSalary,
    handleApproveUser,
    handleToggleUserStatus,
    handleDeleteUser,
  };
}
