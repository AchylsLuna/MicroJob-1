import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Award,
  Download,
  Edit,
  Calendar,
  FileText,
  Linkedin,
  Globe,
  DollarSign,
  Briefcase,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuth } from "../../contexts/AuthContext";
import { getProfile, getUserApplications, type WorkExperience } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { formatCurrency, formatDate } from "../../lib/formatters";

interface Skill {
  id: string;
  name: string;
  description?: string;
  endorsements?: number;
}

interface AcceptedWork {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  completedDate: string;
  salary: string;
  description: string;
  skills: string[];
  status: "Completed" | "In Progress";
}

const formatAcceptedDate = (t: TFunction, value?: string) => {
  if (!value) return t("profile.dateUnavailable");
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t("profile.dateUnavailable")
    : formatDate(date, { month: "short", year: "numeric" });
};

export function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation("worker");
  const [activeTab, setActiveTab] = useState<"overview" | "skills" | "accepted">("overview");
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const [profileUser, setProfileUser] = useState(user);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [totalExperience, setTotalExperience] = useState("Not set");
  const [projectsCompleted, setProjectsCompleted] = useState(0);
  const [jobsApplied, setJobsApplied] = useState(0);
  const [successRate, setSuccessRate] = useState("0%");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [acceptedWorks, setAcceptedWorks] = useState<AcceptedWork[]>([]);
  const [acceptedWorksLoading, setAcceptedWorksLoading] = useState(true);
  const [acceptedWorksError, setAcceptedWorksError] = useState("");
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const assetOrigin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  const resumeCandidate = resumeUrl?.startsWith("/") ? `${assetOrigin}${resumeUrl}` : resumeUrl;
  const safeResumeUrl = safeExternalUrl(resumeCandidate, { purpose: "asset", trustedOrigins: [assetOrigin] });
  const avatarCandidate = profileUser?.avatarUrl?.startsWith("/")
    ? `${assetOrigin}${profileUser.avatarUrl}`
    : profileUser?.avatarUrl;
  const safeAvatarUrl = safeExternalUrl(avatarCandidate, { purpose: "asset", trustedOrigins: [assetOrigin] });

  useEffect(() => {
    if (user) {
      setProfileUser({ ...user });
      if (user.skills && Array.isArray(user.skills)) {
        const mappedSkills = user.skills.map(skill => ({
          ...skill,
          id: skill.id || skill._id || '',
        })) as Skill[];
        setSkills(mappedSkills);
      }
      setTotalExperience(user.totalExperience || "Not set");
      if (user.projectsCompleted !== undefined) setProjectsCompleted(user.projectsCompleted);
      if (user.jobsApplied !== undefined) setJobsApplied(user.jobsApplied);
      if (user.successRate) setSuccessRate(user.successRate);
      setResumeUrl(user.resumeUrl || null);
      setWorkExperiences(user.workExperience || []);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const response = await getProfile();
        const profile = (response as any)?.user ?? response;
        if (!profile || !isMounted) return;
        setProfileUser(profile);
        setProfileError("");
        if (profile.skills && Array.isArray(profile.skills)) {
          const mappedSkills = profile.skills.map((skill: any) => ({
            ...skill,
            id: skill.id || skill._id || '',
          })) as Skill[];
          setSkills(mappedSkills);
        }
        updateAuthProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          city: profile.city,
          linkedin: profile.linkedin,
          website: profile.website,
          jobPosition: profile.jobPosition,
          about: profile.about,
          totalExperience: profile.totalExperience,
          projectsCompleted: profile.projectsCompleted,
          jobsApplied: profile.jobsApplied,
          successRate: profile.successRate,
          avatarUrl: profile.avatarUrl,
          workExperience: profile.workExperience || [],
        });
        setTotalExperience(profile.totalExperience || "Not set");
        if (profile.projectsCompleted !== undefined) setProjectsCompleted(profile.projectsCompleted);
        if (profile.jobsApplied !== undefined) setJobsApplied(profile.jobsApplied);
        if (profile.successRate) setSuccessRate(profile.successRate);
        setResumeUrl(profile.resumeUrl || null);
        setWorkExperiences(Array.isArray(profile.workExperience) ? profile.workExperience : []);
      } catch (error) {
        if (isMounted) setProfileError(error instanceof Error ? error.message : "Failed to load profile.");
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [profileReloadKey, updateAuthProfile]);

  useEffect(() => {
    let isMounted = true;
    const loadAcceptedWorks = async () => {
      try {
        const applications = await getUserApplications("Hired");
        if (!isMounted) return;
        const mapped = (Array.isArray(applications) ? applications : [])
          .filter((application: any) => application?.status === "Hired" && application?.job)
          .map((application: any) => {
            const job = application.job;
            const employer = job.jobPoster || {};
            const company = employer.companyName
              || `${employer.firstName || ""} ${employer.lastName || ""}`.trim()
              || t("profile.acceptedTab.employerFallback");
            const companyLogo = company
              .split(/\s+/)
              .filter(Boolean)
              .map((part: string) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "E";
            return {
              id: application._id,
              title: job.title || t("profile.acceptedTab.untitledJob"),
              company,
              companyLogo,
              completedDate: formatAcceptedDate(t, application.updatedAt || job.updatedAt),
              salary: Number.isFinite(Number(job.salary))
                ? formatCurrency(Number(job.salary), { maximumFractionDigits: 0 })
                : t("profile.acceptedTab.salaryUnavailable"),
              description: job.description || t("profile.acceptedTab.noDescription"),
              skills: Array.isArray(job.skills) ? job.skills : [],
              status: job.status === "Completed" ? "Completed" : "In Progress",
            } satisfies AcceptedWork;
          });
        setAcceptedWorks(mapped);
        setAcceptedWorksError("");
      } catch (error) {
        if (isMounted) {
          setAcceptedWorks([]);
          setAcceptedWorksError(error instanceof Error ? error.message : t("profile.acceptedTab.loadFailed"));
        }
      } finally {
        if (isMounted) setAcceptedWorksLoading(false);
      }
    };
    loadAcceptedWorks();
    return () => {
      isMounted = false;
    };
  }, [t]);

  const displayName = profileUser ? `${profileUser.firstName || ""} ${profileUser.lastName || ""}`.trim() : "";
  const location = profileUser?.city || t("profile.locationNotSet");
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const profileData = {
    name: displayName || "User",
    title: profileUser?.jobPosition || "",
    avatar: null,
    email: profileUser?.email || t("profile.overviewTab.notSet"),
    phone: profileUser?.phoneNumber || t("profile.overviewTab.notSet"),
    location,
    linkedin: profileUser?.linkedin || "",
    website: profileUser?.website || "",
    about: profileUser?.about || t("profile.overviewTab.aboutFallback"),
  };

  const handleEditProfile = () => {
    navigate(`${ROUTES.worker.settings}?tab=personal`);
  };

  const safeLinkedinUrl = safeExternalUrl(profileData.linkedin);
  const safeWebsiteUrl = safeExternalUrl(profileData.website);
  const completionChecks = [
    Boolean(profileUser?.firstName && profileUser?.lastName),
    Boolean(profileUser?.avatarUrl),
    Boolean(profileUser?.phoneNumber),
    Boolean(profileUser?.city),
    Boolean(profileUser?.about),
    Boolean(profileUser?.jobPosition),
    skills.length > 0,
    workExperiences.length > 0 || totalExperience !== "Not set",
    Boolean(resumeUrl),
  ];
  const profileCompletion = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  const formatExperienceDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : formatDate(date, { month: "short", year: "numeric" });
  };

  const acceptedStatusLabel = (status: AcceptedWork["status"]) =>
    status === "Completed" ? t("profile.acceptedTab.status.completed") : t("profile.acceptedTab.status.inProgress");

  return (
    <div className="ui-page">
      {profileError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[14px] text-[#991B1B]">
          <span>{profileError}</span>
          <button type="button" onClick={() => setProfileReloadKey((value) => value + 1)} className="flex items-center gap-2 font-semibold">
            <RefreshCw className="h-4 w-4" /> {t("profile.retry")}
          </button>
        </div>
      )}
      {/* Header Card */}
      <div className="bg-white rounded-[20px] border border-[#e2e8f0] shadow-sm overflow-hidden">
        {/* Cover Photo */}
        <div className="h-[100px] bg-[#1C4D8D]"></div>

        {/* Profile Info */}
        <div className="px-8 pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between -mt-16">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-6">
              {/* Avatar */}
              {safeAvatarUrl ? (
                <img
                  src={safeAvatarUrl}
                  alt={displayName}
                  className="w-32 h-32 rounded-[20px] border-4 border-white shadow-lg object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-[20px] bg-[#F59E0B] border-4 border-white shadow-lg flex items-center justify-center">
                  <span className="text-white font-bold text-[48px]">{initials}</span>
                </div>
              )}

              {/* Name and Title */}
              <div className="pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-[28px] font-bold text-[#1e293b]">
                    {profileData.name}
                  </h1>
                </div>
                <p className="text-[16px] text-[#64748b] mb-2">{profileData.title}</p>
                <div className="flex flex-wrap items-center gap-4 text-[14px] text-[#64748b]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {profileData.location}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {profileData.email}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleEditProfile}
              className="bg-[#1C4D8D] text-white font-semibold px-6 py-3 rounded-[12px] hover:opacity-90 transition-all flex items-center gap-2 mb-2"
            >
              <Edit className="w-4 h-4" />
              {t("profile.editProfile")}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#BFDBFE] bg-[#EFF6FF] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-[#1E3A8A]">{t("profile.completeness.title")}</p>
            <p className="mt-1 text-[13px] text-[#475569]">
              {profileCompletion === 100 ? t("profile.completeness.ready") : t("profile.completeness.incomplete")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profileLoading ? <RefreshCw className="h-4 w-4 animate-spin text-[#1C4D8D]" aria-label={t("profile.completeness.refreshingAria")} /> : null}
            <span className="text-[22px] font-bold text-[#1C4D8D]">{profileCompletion}%</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={t("profile.completeness.ariaLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletion}>
          <div className="h-full rounded-full bg-[#1C4D8D] transition-all" style={{ width: `${profileCompletion}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-[16px] border border-[#e2e8f0] shadow-sm">
        <div className="flex border-b border-[#e2e8f0]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-6 py-4 text-[15px] font-medium transition-all ${
              activeTab === "overview"
                ? "text-[#1C4D8D] border-b-2 border-[#1C4D8D]"
                : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <User className="w-4 h-4" />
            {t("profile.tabs.overview")}
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`flex items-center gap-2 px-6 py-4 text-[15px] font-medium transition-all ${
              activeTab === "skills"
                ? "text-[#1C4D8D] border-b-2 border-[#1C4D8D]"
                : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <Award className="w-4 h-4" />
            {t("profile.tabs.skills")}
          </button>
          <button
            onClick={() => setActiveTab("accepted")}
            className={`flex items-center gap-2 px-6 py-4 text-[15px] font-medium transition-all ${
              activeTab === "accepted"
                ? "text-[#1C4D8D] border-b-2 border-[#1C4D8D]"
                : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <Award className="w-4 h-4" />
            {t("profile.tabs.accepted")}
          </button>
        </div>

        <div className="p-8">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - About & Contact */}
                <div className="lg:col-span-2 space-y-6">
                  {/* About Section */}
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#1e293b] mb-4">{t("profile.overviewTab.aboutMe")}</h2>
                    <p className="text-[14px] text-[#475569] leading-relaxed">{profileData.about}</p>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#1e293b] mb-4">{t("profile.overviewTab.contactInfo")}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#1C4D8D]/10 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-[#1C4D8D]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">{t("profile.overviewTab.email")}</p>
                          {profileUser?.email ? <a href={`mailto:${profileUser.email}`} className="text-[14px] font-medium text-[#1e293b] hover:text-[#1C4D8D] break-all">{profileData.email}</a> : <p className="text-[14px] text-[#64748B]">{t("profile.overviewTab.notSet")}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#dcfce7] flex items-center justify-center">
                          <Phone className="w-5 h-5 text-[#16a34a]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">{t("profile.overviewTab.phone")}</p>
                          {profileUser?.phoneNumber ? <a href={`tel:${profileUser.phoneNumber}`} className="text-[14px] font-medium text-[#1e293b] hover:text-[#1C4D8D]">{profileData.phone}</a> : <p className="text-[14px] text-[#64748B]">{t("profile.overviewTab.notSet")}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#1C4D8D]/10 flex items-center justify-center">
                          <Linkedin className="w-5 h-5 text-[#0a66c2]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">{t("profile.overviewTab.linkedin")}</p>
                          {safeLinkedinUrl ? <a href={safeLinkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[14px] font-medium text-[#1e293b] hover:text-[#0A66C2]">{t("profile.overviewTab.openProfile")} <ExternalLink className="h-3.5 w-3.5" /></a> : <p className="text-[14px] text-[#64748B]">{t("profile.overviewTab.notSet")}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#f3e8ff] flex items-center justify-center">
                          <Globe className="w-5 h-5 text-[#9333ea]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">{t("profile.overviewTab.website")}</p>
                          {safeWebsiteUrl ? <a href={safeWebsiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[14px] font-medium text-[#1e293b] hover:text-[#9333EA]">{t("profile.overviewTab.visitWebsite")} <ExternalLink className="h-3.5 w-3.5" /></a> : <p className="text-[14px] text-[#64748B]">{t("profile.overviewTab.notSet")}</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#1e293b] mb-4">{t("profile.overviewTab.skills")}</h2>
                    <div className="space-y-3">
                      {skills.length > 0 ? (
                        skills.map((skill) => (
                          <div
                            key={skill.id}
                            className="rounded-[12px] border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.08] px-4 py-3"
                          >
                            <p className="text-[14px] font-semibold text-[#1C4D8D]">{skill.name}</p>
                            <p className="mt-1 text-[13px] text-[#475569]">
                              {skill.description?.trim() || t("profile.overviewTab.noDescriptionAdded")}
                            </p>
                          </div>
                        ))
                      ) : (
                        <span className="text-[13px] text-[#94a3b8]">{t("profile.overviewTab.noSkillsShort")}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - CV/Resume */}
                <div className="space-y-6">
                  {/* CV/Resume Card */}
                  <div className="bg-[#1C4D8D]/[0.08] border border-[#1C4D8D]/20 rounded-[16px] p-6">
                    <h3 className="text-[18px] font-semibold text-[#1e293b] mb-4">{t("profile.overviewTab.cvResume")}</h3>
                    {safeResumeUrl ? (
                      <div className="space-y-4">
                        <div className="bg-white rounded-[12px] p-4 border border-[#1C4D8D]/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-[10px] bg-[#1C4D8D] flex items-center justify-center">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-[14px] font-semibold text-[#1e293b]">{t("profile.overviewTab.resumeName", { name: profileData.name })}</h4>
                              <p className="text-[12px] text-[#64748b]">{t("profile.overviewTab.resumeUploaded")}</p>
                            </div>
                          </div>
                          <a
                            href={safeResumeUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-[#1C4D8D] text-white font-semibold py-2.5 px-4 rounded-[10px] hover:opacity-90 transition-all flex items-center justify-center gap-2 block text-center no-underline"
                          >
                            <Download className="w-4 h-4" />
                            {t("profile.overviewTab.downloadResume")}
                          </a>
                        </div>
                        <p className="text-[12px] text-[#475569] text-center">
                          {t("profile.overviewTab.viewResumeHint")}
                        </p>
                        <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=resume`)} className="w-full text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                          {t("profile.overviewTab.replaceResume")}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileText className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
                        <p className="text-[14px] text-[#64748b] mb-3">{t("profile.overviewTab.noResumeUploaded")}</p>
                        <button
                          onClick={() => navigate(`${ROUTES.worker.settings}?tab=resume`)}
                          className="bg-[#1C4D8D] text-white font-semibold py-2 px-4 rounded-[10px] hover:opacity-90 transition-all text-[13px]"
                        >
                          {t("profile.overviewTab.uploadResume")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-6">
                    <h3 className="text-[18px] font-semibold text-[#1e293b] mb-4">{t("profile.overviewTab.quickStats")}</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">{t("profile.overviewTab.totalExperience")}</span>
                        <span className="text-[16px] font-bold text-[#1e293b]">{totalExperience}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">{t("profile.overviewTab.jobsCompleted")}</span>
                        <span className="text-[16px] font-bold text-[#10b981]">{projectsCompleted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">{t("profile.overviewTab.jobsApplied")}</span>
                        <span className="text-[16px] font-bold text-[#1C4D8D]">{jobsApplied}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">{t("profile.overviewTab.successRate")}</span>
                        <span className="text-[16px] font-bold text-[#10b981]">{successRate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Skills & Experience Tab */}
          {activeTab === "skills" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[20px] font-semibold text-[#1e293b]">{t("profile.skillsTab.heading")}</h2>
                <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)} className="text-[13px] font-semibold text-[#1C4D8D] hover:underline">{t("profile.skillsTab.manage")}</button>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#1E293B]">{t("profile.skillsTab.workHistory")}</h3>
                  <span className="text-[12px] text-[#64748B]">{t("profile.skillsTab.entry", { count: workExperiences.length })}</span>
                </div>
                {workExperiences.length ? (
                  <div className="space-y-3">
                    {workExperiences.map((item, index) => (
                      <div key={item._id || item.id || `${item.title}-${index}`} className="flex gap-4 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#DBEAFE]">
                          <Briefcase className="h-5 w-5 text-[#1C4D8D]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#1E293B]">{item.title}</p>
                          <p className="text-[13px] text-[#475569]">{[item.company, item.location].filter(Boolean).join(" · ")}</p>
                          <p className="mt-1 text-[12px] text-[#64748B]">{formatExperienceDate(item.startDate)} – {item.current ? t("profile.skillsTab.present") : formatExperienceDate(item.endDate)}</p>
                          {item.description ? <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-[#475569]">{item.description}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-8 text-center">
                    <Briefcase className="mx-auto mb-2 h-8 w-8 text-[#94A3B8]" />
                    <p className="text-[13px] text-[#64748B]">{t("profile.skillsTab.noWorkHistory")}</p>
                  </div>
                )}
              </div>

              {/* Skills List */}
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#1E293B]">{t("profile.skillsTab.skillsHeading")}</h3>
                <span className="text-[12px] text-[#64748B]">{t("profile.skillsTab.skill", { count: skills.length })}</span>
              </div>
              {skills.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="bg-white border border-[#e2e8f0] rounded-[16px] p-5 hover:shadow-md transition-all"
                    >
                      <div>
                        <h3 className="text-[16px] font-bold text-[#1e293b] mb-1">{skill.name}</h3>
                        <p className="text-[13px] text-[#64748b] mt-2">
                          {skill.description?.trim() || t("profile.overviewTab.noDescriptionAdded")}
                        </p>
                        {skill.endorsements ? (
                          <span className="text-[12px] text-[#64748b] flex items-center gap-1 mt-2">
                            <Award className="w-3 h-3" />
                            {t("profile.skillsTab.endorsements", { count: skill.endorsements })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-[#f8fafc] rounded-[16px] border border-[#e2e8f0]">
                  <Award className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
                  <p className="text-[14px] text-[#64748b] mb-4">{t("profile.skillsTab.noSkillsTitle")}</p>
                  <p className="text-[12px] text-[#94a3b8]">{t("profile.skillsTab.noSkillsHint")}</p>
                </div>
              )}
            </div>
          )}

          {/* Accepted Work Tab */}
          {activeTab === "accepted" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[20px] font-semibold text-[#1e293b]">{t("profile.acceptedTab.heading")}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!acceptedWorksLoading && !acceptedWorksError && acceptedWorks.map((work) => (
                  <div key={work.id} className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-[12px] bg-[#1C4D8D] flex items-center justify-center text-white font-bold text-[16px] shadow-md flex-shrink-0">
                          {work.companyLogo}
                        </div>
                        <div>
                          <h3 className="text-[16px] font-bold text-[#1e293b] mb-1">{work.title}</h3>
                          <p className="text-[13px] text-[#64748b]">{work.company}</p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-[8px] text-[12px] font-semibold ${
                          work.status === "Completed"
                            ? "bg-[#dcfce7] text-[#16a34a]"
                            : "bg-[#fef3c7] text-[#92400e]"
                        }`}
                      >
                        {acceptedStatusLabel(work.status)}
                      </span>
                    </div>

                    <p className="text-[13px] text-[#475569] mb-4">{work.description}</p>

                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-4 h-4 text-[#10b981]" />
                      <span className="text-[16px] font-bold text-[#10b981]">{work.salary}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {work.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2.5 py-1 bg-[#f1f5f9] text-[#475569] rounded-[6px] text-[11px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-[#64748b] pt-3 border-t border-[#e2e8f0]">
                      <Calendar className="w-3.5 h-3.5" />
                      {work.completedDate}
                    </div>
                  </div>
                ))}
                {acceptedWorksLoading && (
                  <div className="col-span-1 md:col-span-2 text-center py-12 text-[14px] text-[#64748b]">
                    {t("profile.acceptedTab.loading")}
                  </div>
                )}
                {!acceptedWorksLoading && acceptedWorksError && (
                  <div className="col-span-1 md:col-span-2 text-center py-12 bg-[#fff7ed] rounded-[16px] border border-[#fed7aa]">
                    <p className="text-[14px] text-[#9a3412]">{acceptedWorksError}</p>
                  </div>
                )}
                {!acceptedWorksLoading && !acceptedWorksError && acceptedWorks.length === 0 && (
                  <div className="col-span-1 md:col-span-2 text-center py-12 bg-[#f8fafc] rounded-[16px] border border-[#e2e8f0]">
                    <Award className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
                    <p className="text-[14px] text-[#64748b] mb-2">{t("profile.acceptedTab.noneTitle")}</p>
                    <p className="text-[12px] text-[#94a3b8]">{t("profile.acceptedTab.noneHint")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
