import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock, MessageSquare, CheckCircle, XCircle, TrendingUp, ArrowRight, Briefcase, ChevronRight } from "lucide-react";
import { getEmployerApplications } from "../../services/api";
import { toast } from "../../lib/toast";

export function EmployerDashboard() {
  const navigate = useNavigate();
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
        const applications = await getEmployerApplications();
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
        toast.error(error?.message || "Failed to load applications.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadApplications();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[20px] text-[#111827]">Overview</h2>
          <p className="text-[#6B7280] text-[14px] mt-1">Manage your job postings and candidate applications</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/employer/post-job")}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold text-[14px] rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
        >
          <ChevronRight className="w-4 h-4" />
          Post New Job
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
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
            <p className="font-bold text-[32px] text-[#111827]">{isLoading ? "—" : stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#FEF3C7] rounded-[10px] p-3">
              <Clock className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div className="flex items-center gap-1 text-[#6B7280] text-[12px] font-medium">
              <span>33%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Pending Review</p>
            <p className="font-bold text-[32px] text-[#111827]">{isLoading ? "—" : stats.pending}</p>
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#DBEAFE] rounded-[10px] p-3">
              <MessageSquare className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <div className="flex items-center gap-1 text-[#6B7280] text-[12px] font-medium">
              <span>50%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">In Progress</p>
            <p className="font-bold text-[32px] text-[#111827]">{isLoading ? "—" : stats.inProgress}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#D1FAE5] rounded-[10px] p-3">
              <CheckCircle className="w-6 h-6 text-[#10B981]" />
            </div>
            <div className="flex items-center gap-1 text-[#10B981] text-[12px] font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>+1</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Accepted</p>
            <p className="font-bold text-[32px] text-[#111827]">{isLoading ? "—" : stats.accepted}</p>
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-[#FEE2E2] rounded-[10px] p-3">
              <XCircle className="w-6 h-6 text-[#EF4444]" />
            </div>
            <div className="flex items-center gap-1 text-[#6B7280] text-[12px] font-medium">
              <span>8%</span>
            </div>
          </div>
          <div>
            <p className="text-[#6B7280] text-[13px] mb-1">Rejected</p>
            <p className="font-bold text-[32px] text-[#111827]">{isLoading ? "—" : stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6">
        <h2 className="font-semibold text-[18px] text-[#111827] mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/dashboard/employer/applications")}
            className="bg-[#4F46E5] text-white px-6 py-3 rounded-[8px] font-medium text-[14px] hover:bg-[#4338CA] transition-colors inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Manage Applications
            <ArrowRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => navigate("/dashboard/employer/jobs")}
            className="bg-white border border-[#D1D5DB] text-[#374151] px-6 py-3 rounded-[8px] font-medium text-[14px] hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
          >
            <Briefcase className="w-4 h-4" />
            View All Jobs
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-6">
        <h2 className="font-semibold text-[18px] text-[#111827] mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3 pb-4 border-b border-[#E5E7EB] last:border-0 last:pb-0">
            <div className="bg-[#D1FAE5] rounded-full p-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] text-[#111827]">
                <span className="font-semibold">Sarah Chen</span> application accepted for Senior Frontend Developer
              </p>
              <p className="text-[12px] text-[#6B7280] mt-1">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pb-4 border-b border-[#E5E7EB] last:border-0 last:pb-0">
            <div className="bg-[#DBEAFE] rounded-full p-2">
              <MessageSquare className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] text-[#111827]">
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
              <p className="text-[14px] text-[#111827]">
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
