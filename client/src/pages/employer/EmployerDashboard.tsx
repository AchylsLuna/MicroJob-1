import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock, MessageSquare, CheckCircle, XCircle, TrendingUp, ArrowRight, Briefcase, ChevronRight } from "lucide-react";
import { jobsAPI } from "../../services/jobs";
import { useToast } from "../../contexts/ToastContext";

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    accepted: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      setIsLoading(true);
      try {
        const res = await jobsAPI.getEmployerApplications();
        const applications = res?.data || [];
        if (!isMounted) return;
        const total = Array.isArray(applications) ? applications.length : 0;
        const pending = Array.isArray(applications)
          ? applications.filter((app: any) => app.status === "Pending").length
          : 0;
        const inProgress = Array.isArray(applications)
          ? applications.filter((app: any) => app.status === "Reviewed").length
          : 0;
        const accepted = Array.isArray(applications)
          ? applications.filter((app: any) => app.status === "Accepted").length
          : 0;
        const rejected = Array.isArray(applications)
          ? applications.filter((app: any) => app.status === "Rejected").length
          : 0;

        setStats({ total, pending, inProgress, accepted, rejected });
      } catch (error: any) {
        if (!isMounted) return;
        toast.showToast?.(error?.message || "Failed to load applications.", 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadApplications();
    return () => { isMounted = false; };
  }, [toast]);

  return (
    <div className="max-w-[1341px] mx-auto space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[18px] text-[#111827]">Overview</h2>
          <p className="text-[#6B7280] text-[13px] mt-1">Manage your job postings and candidate applications</p>
        </div>
        <button
          onClick={() => navigate("/employer/post-job")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-md hover:bg-blue-700 transition"
        >
          <ChevronRight className="w-4 h-4" />
          Post New Job
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#EEF2FF] rounded-[10px] p-3">
              <Users className="w-6 h-6 text-[#4F46E5]" />
            </div>
            <div className="flex items-center gap-1 text-[#10B981] text-[12px] font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>+12%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Total Applications</p>
            <p className="font-bold text-[24px] text-[#111827]">{isLoading ? "—" : stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#FEF3C7] rounded-[10px] p-2">
              <Clock className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div className="flex items-center gap-1 text-[#6B7280] text-[12px] font-medium">
              <span>33%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Pending Review</p>
            <p className="font-bold text-[24px] text-[#111827]">{isLoading ? "—" : stats.pending}</p>
          </div>
        </div>

        <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#DBEAFE] rounded-[10px] p-2">
              <MessageSquare className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <div className="flex items-center gap-1 text-[#6B7280] text-[12px] font-medium">
              <span>50%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">In Progress</p>
            <p className="font-bold text-[24px] text-[#111827]">{isLoading ? "—" : stats.inProgress}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#D1FAE5] rounded-[10px] p-2">
              <CheckCircle className="w-6 h-6 text-[#10B981]" />
            </div>
            <div className="flex items-center gap-1 text-[#10B981] text-[12px] font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>+1</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Accepted</p>
            <p className="font-bold text-[24px] text-[#111827]">{isLoading ? "—" : stats.accepted}</p>
          </div>
        </div>

        <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#FEE2E2] rounded-[10px] p-2">
              <XCircle className="w-6 h-6 text-[#EF4444]" />
            </div>
            <div className="flex items-center gap-1 text-[#6B7280] text-[12px] font-medium">
              <span>8%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Rejected</p>
            <p className="font-bold text-[24px] text-[#111827]">{isLoading ? "—" : stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4">
        <h2 className="font-semibold text-[16px] text-[#111827] mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/employer/applications")}
            className="bg-[#4F46E5] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-[#4338CA] transition inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Manage Applications
            <ArrowRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => navigate("/employer/job-posts")}
            className="bg-white border border-[#D1D5DB] text-[#374151] px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-50 transition inline-flex items-center gap-2"
          >
            <Briefcase className="w-4 h-4" />
            View All Jobs
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-4">
        <h2 className="font-semibold text-[16px] text-[#111827] mb-3">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0">
            <div className="bg-[#D1FAE5] rounded-full p-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-[#111827]">
                <span className="font-semibold">Sarah Chen</span> application accepted for Senior Frontend Developer
              </p>
              <p className="text-[12px] text-[#6B7280] mt-1">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0">
            <div className="bg-[#DBEAFE] rounded-full p-2">
              <MessageSquare className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-[#111827]">
                New application from <span className="font-semibold">Michael Rodriguez</span>
              </p>
              <p className="text-[12px] text-[#6B7280] mt-1">5 hours ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-[#FEF3C7] rounded-full p-2">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-[#111827]">
                <span className="font-semibold">4 applications</span> pending your review
              </p>
              <p className="text-[12px] text-[#6B7280] mt-1">1 day ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
