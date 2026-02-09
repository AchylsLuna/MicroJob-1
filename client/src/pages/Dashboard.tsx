import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useAuth } from "../hooks/useAuth";
import { jobsAPI } from "../services/jobs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PROFILE_STORAGE_KEY = "profile_settings";

type ProfileSettings = {
  personal?: {
    firstName?: string;
    lastName?: string;
    city?: string;
    province?: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
    facebook?: string;
    profilePhotoName?: string;
  };
  experience?: {
    jobPosition?: string;
    companyName?: string;
    startDate?: string;
    endDate?: string;
    logoName?: string;
  };
  resume?: {
    fileName?: string;
  };
};


const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const authUser = useAuth();
  const [userName, setUserName] = useState("Jonas Dick");
  const [userEmail, setUserEmail] = useState("you@example.com");
  const [activeVacancyTab, setActiveVacancyTab] = useState("Application Sent");
  const [showNotifications, setShowNotifications] = useState(false);
  const [applications, setApplications] = useState<Array<{ status: string; createdAt?: string; job?: { _id: string; title: string; location?: string; salary?: string; jobType?: string } }>>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [jobs, setJobs] = useState<Array<{ _id: string; title: string; location?: string; salary?: string; jobType?: string; category?: { name?: string }; jobPoster?: { _id?: string; id?: string } }>>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [isProfileVerified, setIsProfileVerified] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("auth_user");
    console.log("Dashboard - Auth user from localStorage:", stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log("Dashboard - Parsed auth_user:", parsed);
        console.log("Dashboard - User role:", parsed?.role);
        if (parsed?.firstName && parsed?.lastName) setUserName(`${parsed.firstName} ${parsed.lastName}`);
        if (parsed?.email) setUserEmail(parsed.email);
      } catch (err) {
        console.warn("Failed to parse auth_user", err);
      }
    }
  }, []);

  useEffect(() => {
    console.log("Dashboard - authUser from useAuth hook:", authUser);
  }, [authUser]);

  useEffect(() => {
    const computeProfileStatus = (settings: ProfileSettings | null) => {
      const personal = settings?.personal || {};
      const experience = settings?.experience || {};
      const resume = settings?.resume || {};

      const hasPersonal = Boolean(
        personal.firstName?.trim() &&
        personal.lastName?.trim() &&
        personal.city?.trim() &&
        personal.province?.trim() &&
        personal.address?.trim() &&
        personal.phoneNumber?.trim() &&
        personal.email?.trim() &&
        personal.facebook?.trim()
      );
      const hasPhoto = Boolean(personal.profilePhotoName);
      const hasExperience = Boolean(
        experience.jobPosition?.trim() &&
        experience.companyName?.trim() &&
        experience.startDate?.trim() &&
        experience.endDate?.trim()
      );
      const hasResume = Boolean(resume.fileName);

      const total = 4;
      const completed = [hasPersonal, hasPhoto, hasExperience, hasResume].filter(Boolean).length;
      const completionPercent = Math.round((completed / total) * 100);

      setProfileCompletion(completionPercent);
      setIsProfileVerified(completed === total);
    };

    const loadProfileSettings = () => {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!stored) {
        computeProfileStatus(null);
        return;
      }
      try {
        computeProfileStatus(JSON.parse(stored));
      } catch (err) {
        console.warn("Failed to parse profile settings", err);
        computeProfileStatus(null);
      }
    };

    loadProfileSettings();
    window.addEventListener("storage", loadProfileSettings);
    window.addEventListener("profile_settings_updated", loadProfileSettings);

    return () => {
      window.removeEventListener("storage", loadProfileSettings);
      window.removeEventListener("profile_settings_updated", loadProfileSettings);
    };
  }, []);

  useEffect(() => {
    const fetchApplications = async () => {
      setAppsLoading(true);
      try {
        const response = await jobsAPI.getUserApplications();
        setApplications(response.data || []);
      } catch (err) {
        console.warn("Failed to load applications for dashboard", err);
      } finally {
        setAppsLoading(false);
      }
    };

    const fetchJobs = async () => {
      setJobsLoading(true);
      try {
        const response = await jobsAPI.getJobs({ excludeOwn: true });
        setJobs(response.data || []);
      } catch (err) {
        console.warn("Failed to load jobs for dashboard", err);
      } finally {
        setJobsLoading(false);
      }
    };

    if (authUser?.role === "work" || authUser?.role === "both") {
      fetchApplications();
      fetchJobs();
    }
  }, [authUser?.role]);

  const statusCounts = useMemo(() => {
    return applications.reduce(
      (acc, app) => {
        const key = app.status || "Pending";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [applications]);

  if (authUser?.role === "hire") {
    return <Navigate to="/employer/applications" replace />;
  }

  const appliedJobIds = useMemo(
    () => new Set(applications.map((app) => app.job?._id).filter(Boolean) as string[]),
    [applications]
  );

  const filteredJobs = jobs.filter((job) => {
    if (appliedJobIds.has(job._id)) return false;
    return true;
  });

  const recommendedJobs = filteredJobs.slice(0, 3);
  const featuredJobs = filteredJobs.slice(0, 4);

  const recentActivities = applications.slice(0, 4).map((app, index) => {
    const status = app.status || "Pending";
    const iconMap: Record<string, string> = {
      Pending: "⏳",
      Reviewed: "👀",
      Accepted: "✅",
      Rejected: "❌",
    };
    return {
      id: `${app.job?._id || "app"}-${index}`,
      type: status.toLowerCase(),
      title: `Application ${status.toLowerCase()} for ${app.job?.title || "a job"}`,
      time: app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "Just now",
      icon: iconMap[status] || "📌",
    };
  });

  const analyticsLabels = ["Pending", "Reviewed", "Accepted", "Rejected"];
  const analyticsValues = [
    statusCounts.Pending || 0,
    statusCounts.Reviewed || 0,
    statusCounts.Accepted || 0,
    statusCounts.Rejected || 0,
  ];

  const notifications = useMemo(() => {
    const allowed = new Set(["accepted", "rejected", "reviewed"]);
    return applications
      .filter((app) => allowed.has((app.status || "").toLowerCase()))
      .slice(0, 6)
      .map((app, index) => {
        const status = app.status || "Reviewed";
        return {
          id: `${app.job?._id || "app"}-${index}`,
          title: `Application ${status}`,
          description: `Your application for ${app.job?.title || "a job"} was ${status.toLowerCase()}.`,
          time: app.createdAt ? new Date(app.createdAt).toLocaleString() : "Just now",
          isNew: true,
        };
      });
  }, [applications]);

  return (
    <div className="p-8 pb-20">
          {/* Header with Search and Icons */}
          <div className="flex items-center justify-between gap-6 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Search by skills, name, or expertise..."
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-4 top-2.5 text-gray-400">🔍</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative hover:opacity-80 transition"
                >
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold absolute -top-1 -right-1">
                    {notifications.length}
                  </div>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
                    <path d="M9 17a3 3 0 0 0 6 0" />
                  </svg>
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <h3 className="font-bold text-gray-900">Notifications ({notifications.length})</h3>
                      <button className="text-blue-600 text-sm font-semibold hover:text-blue-700">
                        Mark all as read
                      </button>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="px-6 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition cursor-pointer"
                        >
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-900 text-sm">{notif.title}</h4>
                                {notif.isNew && (
                                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                )}
                              </div>
                              <p className="text-gray-600 text-xs mb-2">{notif.description}</p>
                              <p className="text-gray-500 text-xs">{notif.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200 text-center">
                      <button className="text-blue-600 font-semibold text-sm hover:text-blue-700">
                        View All Notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-yellow-400 rounded-full px-3 py-1">
                <span className="text-white font-semibold text-sm">JD</span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-2">Pending</p>
                  <p className="text-4xl font-bold">{statusCounts.Pending || 0}</p>
                </div>
                <div className="text-2xl">🕒</div>
              </div>
              <p className="text-xs text-blue-100 mt-3">{appsLoading ? "Loading..." : "Applications"}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-200 text-sm mb-2">Reviewed</p>
                  <p className="text-4xl font-bold">{statusCounts.Reviewed || 0}</p>
                </div>
                <div className="text-2xl">👀</div>
              </div>
              <p className="text-xs text-blue-200 mt-3">{appsLoading ? "Loading..." : "Applications"}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-2">Accepted</p>
                  <p className="text-4xl font-bold">{statusCounts.Accepted || 0}</p>
                </div>
                <div className="text-2xl">✅</div>
              </div>
              <p className="text-xs text-blue-100 mt-3">{appsLoading ? "Loading..." : "Applications"}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-200 text-sm mb-2">Rejected</p>
                  <p className="text-4xl font-bold">{statusCounts.Rejected || 0}</p>
                </div>
                <div className="text-2xl">❌</div>
              </div>
              <p className="text-xs text-blue-200 mt-3">{appsLoading ? "Loading..." : "Applications"}</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Verified Section */}
              <div className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                  <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${
                    isProfileVerified ? "border-green-500" : "border-gray-300"
                  }`}>
                    <span className={`text-4xl font-bold ${
                      isProfileVerified ? "text-green-600" : "text-gray-600"
                    }`}>
                      {profileCompletion}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">%</p>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
                  <span className={isProfileVerified ? "text-green-500" : "text-gray-400"}>✓</span>
                  {isProfileVerified ? "Profile Verified" : "Profile Incomplete"}
                </h3>
                <p className="text-gray-600 text-xs">
                  {isProfileVerified
                    ? "All requirements completed"
                    : "Complete your profile in Settings"}
                </p>
              </div>

              {/* Recent Activities */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Recent Activities</h3>
                  <a href="#" className="text-blue-600 text-sm font-semibold">View all</a>
                </div>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 pb-4 border-b border-gray-200 last:border-b-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        activity.type === "accepted" ? "bg-green-100" :
                        activity.type === "reviewed" ? "bg-blue-100" :
                        activity.type === "rejected" ? "bg-red-100" :
                        "bg-gray-100"
                      }`}>
                        <span className="text-lg">{activity.icon}</span>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-700 font-semibold text-xs">{activity.title}</p>
                        <p className="text-gray-500 text-xs mt-1">● {activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="lg:col-span-3 space-y-8">
              {/* Vacancy Stats Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-900 text-lg">Vacancy Stats</h3>
                  <select className="text-sm bg-gray-100 border border-gray-300 rounded-lg px-3 py-1">
                    <option>This Month</option>
                  </select>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                  {["Application Sent", "Interviews", "Rejected", "This Month"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveVacancyTab(tab)}
                      className={`px-4 py-2 font-semibold text-sm transition ${
                        activeVacancyTab === tab
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Chart Placeholder - Line Chart */}
                <div className="h-96 relative mb-6">
                  <Line
                    data={{
                      labels: analyticsLabels,
                      datasets: [
                        {
                          label: "Applications",
                          data: analyticsValues,
                          borderColor: "#3b82f6",
                          backgroundColor: "rgba(59, 130, 246, 0.1)",
                          borderWidth: 3,
                          fill: true,
                          tension: 0.35,
                          pointRadius: 5,
                          pointBackgroundColor: "#3b82f6",
                          pointBorderColor: "#ffffff",
                          pointBorderWidth: 2,
                          pointHoverRadius: 7,
                        }
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                          position: "bottom",
                          labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                              size: 13,
                              weight: "bold",
                            },
                            color: "#6b7280",
                          },
                        },
                        tooltip: {
                          backgroundColor: "#ffffff",
                          titleColor: "#111827",
                          bodyColor: "#111827",
                          borderColor: "#e5e7eb",
                          borderWidth: 1,
                          padding: 12,
                          displayColors: true,
                          usePointStyle: true,
                          boxPadding: 10,
                          titleFont: {
                            size: 14,
                            weight: "bold",
                          },
                          bodyFont: {
                            size: 12,
                            weight: "bold",
                          },
                          callbacks: {
                            title: (context: any) => `${context[0].label}`,
                            label: (context: any) => `${context.dataset.label} : ${context.parsed.y}`,
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            display: true,
                            color: "#f3f4f6",
                          },
                          ticks: {
                            color: "#9ca3af",
                            font: {
                              size: 12,
                            },
                          },
                        },
                        y: {
                          grid: {
                            display: true,
                            color: "#f3f4f6",
                          },
                          ticks: {
                            color: "#9ca3af",
                            font: {
                              size: 12,
                            },
                          },
                        },
                      },
                      interaction: {
                        intersect: false,
                        mode: "index",
                      },
                    }}
                  />
                </div>

                {/* Stats Summary */}
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div>
                    <span className="font-semibold text-blue-600">{statusCounts.Pending || 0}</span>
                    <span className="text-gray-600 ml-1">Pending</span>
                  </div>
                  <div>
                    <span className="font-semibold text-blue-600">{statusCounts.Reviewed || 0}</span>
                    <span className="text-gray-600 ml-1">Reviewed</span>
                  </div>
                  <div>
                    <span className="font-semibold text-blue-600">{statusCounts.Accepted || 0}</span>
                    <span className="text-gray-600 ml-1">Accepted</span>
                  </div>
                  <div>
                    <span className="font-semibold text-blue-600">{statusCounts.Rejected || 0}</span>
                    <span className="text-gray-600 ml-1">Rejected</span>
                  </div>
                </div>
              </div>

              {/* Recommended Jobs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-lg">Recommended Jobs</h3>
                  <a href="#" className="text-blue-600 text-sm font-semibold">View All ↗</a>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {recommendedJobs.map((job) => (
                    <div key={job._id} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/job-details/${job._id}`)}>
                      <div className="flex gap-4">
                        <div className={`w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                          {job.title.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-gray-900">{job.title}</h4>
                            <span className="text-xs text-gray-500">⏱️ Recently</span>
                          </div>
                          <p className="text-gray-600 text-sm mb-1">📍 {job.location || "N/A"}</p>
                          <p className="text-gray-900 font-semibold text-sm mb-2">{job.salary || ""}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <span className="text-xs text-gray-600">{job.category?.name || "General"}</span>
                            </div>
                            <button className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${
                              job.jobType === "Remote" ? "bg-blue-600" :
                              job.jobType === "Part-time" ? "bg-yellow-600" :
                              "bg-green-600"
                            }`}>
                              {job.jobType || "Fulltime"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!jobsLoading && recommendedJobs.length === 0 && (
                    <div className="bg-white rounded-xl p-6 shadow-sm text-sm text-gray-600">
                      No recommendations yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Featured Jobs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-lg">Featured Jobs</h3>
                  <a href="#" className="text-blue-600 text-sm font-semibold">Explore All ↗</a>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {featuredJobs.map((job) => (
                    <div key={job._id} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/job-details/${job._id}`)}>
                      <div className="w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center font-bold text-white">
                        {job.title.charAt(0)}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm mb-2 text-center">{job.title}</h4>
                      <p className="text-green-600 text-xs font-semibold mb-2 text-center">{job.salary || ""}</p>
                      <p className="text-gray-600 text-xs text-center mb-2">📍 {job.location || "N/A"}</p>
                      <p className="text-gray-600 text-xs text-center">📂 {job.category?.name || "General"}</p>
                    </div>
                  ))}
                  {!jobsLoading && featuredJobs.length === 0 && (
                    <div className="bg-white rounded-xl p-6 shadow-sm text-sm text-gray-600">
                      No featured jobs yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
    </div>
  );
};

export default Dashboard;
