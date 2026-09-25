import { useEffect, useState } from "react";
import { Mail, Phone, Edit, Eye, Globe, Linkedin, ExternalLink, Briefcase, RefreshCw, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { getProfile, getMyJobs } from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { toAbsoluteAssetUrl } from "../../lib/assetUrl";
import { isProfileFullyVerified } from "../../lib/profileVerification";
import { formatDate } from "../../lib/formatters";
import { SettingsTabList } from "../../components/settings/SettingsTabList";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { Button, StatTile } from "../../components/ui";

interface EmployerJob {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  status: "Available" | "In Progress" | "Completed" | "Cancelled" | "Closed";
  applicants?: string[];
  createdAt?: string;
}

const JOB_STATUS_STYLE: Record<EmployerJob["status"], string> = {
  Available: "bg-emerald-100 text-emerald-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-violet-100 text-violet-800",
  Cancelled: "bg-red-100 text-red-800",
  Closed: "bg-slate-200 text-slate-700",
};

const initialsOf = (label: string, fallback = "") => {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || fallback;
};

/**
 * Read-only, matching the pattern the worker profile page already
 * established: this page displays, "Edit Profile" defers to Settings, and
 * job management defers to the existing Jobs page -- no CRUD duplicated here.
 */
export function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation("employer");
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const [profileUser, setProfileUser] = useState(user);
  const [jobsPosted, setJobsPosted] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [employerSuccessRate, setEmployerSuccessRate] = useState("0%");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "jobs">("overview");
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");

  useEffect(() => {
    if (user) setProfileUser({ ...user });
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
        updateAuthProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          city: profile.city,
          province: profile.province,
          companyName: profile.companyName,
          linkedin: profile.linkedin,
          website: profile.website,
          about: profile.about,
          totalExperience: profile.totalExperience,
          avatarUrl: profile.avatarUrl,
          jobsPosted: profile.jobsPosted,
          totalApplicants: profile.totalApplicants,
          employerSuccessRate: profile.employerSuccessRate,
        });
        setJobsPosted(profile.jobsPosted ?? 0);
        setTotalApplicants(profile.totalApplicants ?? 0);
        setEmployerSuccessRate(profile.employerSuccessRate || "0%");
      } catch (error) {
        if (isMounted) setProfileError(error instanceof Error ? error.message : t("profile.overviewTab.loadFailed"));
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [profileReloadKey, updateAuthProfile, t]);

  useEffect(() => {
    let isMounted = true;
    const loadJobs = async () => {
      try {
        const response = await getMyJobs();
        if (!isMounted) return;
        setJobs(Array.isArray(response) ? response : []);
        setJobsError("");
      } catch (error) {
        if (isMounted) {
          setJobs([]);
          setJobsError(error instanceof Error ? error.message : t("profile.jobsTab.loadFailed"));
        }
      } finally {
        if (isMounted) setJobsLoading(false);
      }
    };
    loadJobs();
    return () => {
      isMounted = false;
    };
  }, [t]);

  const profileUserId: string | undefined = (profileUser as any)?.id || (profileUser as any)?._id;
  const displayName = profileUser?.companyName?.trim()
    || `${profileUser?.firstName || ""} ${profileUser?.lastName || ""}`.trim()
    || t("profile.fallbackName");
  const location = [profileUser?.city, profileUser?.province].filter(Boolean).join(", ") || t("profile.locationNotSet");
  const initials = initialsOf(displayName, "E");

  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const assetOrigin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  const avatarCandidate = toAbsoluteAssetUrl(profileUser?.avatarUrl);
  const safeAvatarUrl = safeExternalUrl(avatarCandidate, { purpose: "asset", trustedOrigins: [assetOrigin] });
  const safeLinkedinUrl = safeExternalUrl(profileUser?.linkedin || "");
  const safeWebsiteUrl = safeExternalUrl(profileUser?.website || "");

  const handleEditProfile = () => navigate(`${ROUTES.employer.settings}?tab=personal`);

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

      <ProfileHeader
        name={displayName}
        location={location}
        email={profileUser?.email}
        avatarUrl={safeAvatarUrl}
        initials={initials}
        bio={profileUser?.about}
        moreLabel={t("profile.bio.more")}
        lessLabel={t("profile.bio.less")}
        isVerified={isProfileFullyVerified(profileUser?.verification)}
        actions={
          <>
            <Button onClick={handleEditProfile}>
              <Edit className="h-4 w-4" aria-hidden="true" />
              {t("profile.editProfile")}
            </Button>
            {profileUserId ? (
              <Button
                onClick={() => navigate(`${ROUTES.publicProfile(profileUserId)}?viewAs=employer`)}
                className="!bg-white !text-[#1C4D8D] ring-1 ring-[#1C4D8D]/30 hover:!bg-[#1C4D8D]/[0.06]"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {t("profile.publicView")}
              </Button>
            ) : null}
          </>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label={t("profile.statRow.yearsInBusiness")} value={profileUser?.totalExperience || t("profile.overviewTab.notSet")} />
        <StatTile label={t("profile.statRow.jobsPosted")} value={profileLoading ? "—" : jobsPosted} />
        <StatTile label={t("profile.statRow.successRate")} value={profileLoading ? "—" : employerSuccessRate} />
      </div>

      {/* Tabs */}
      <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6">
          <SettingsTabList
            variant="underline"
            ariaLabel={t("profile.tabs.overview")}
            idPrefix="employer-profile"
            options={[
              { id: "overview" as const, label: t("profile.tabs.overview") },
              { id: "jobs" as const, label: t("profile.tabs.jobs") },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="p-6 sm:p-8" id={`employer-profile-panel-${activeTab}`} role="tabpanel" aria-labelledby={`employer-profile-tab-${activeTab}`}>
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h2 className="mb-3 text-[17px] font-bold text-[#0F172A]">{t("profile.overviewTab.companyDescription")}</h2>
                  <p className="text-[14px] leading-6 text-slate-600">
                    {profileUser?.about || t("profile.overviewTab.aboutFallback")}
                  </p>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-[15px] font-bold text-[#0F172A]">{t("profile.overviewTab.contactInfo")}</h2>
                <dl className="divide-y divide-slate-100 border-y border-slate-100">
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="flex shrink-0 items-center gap-2 text-[13px] text-slate-500">
                      <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      {t("profile.overviewTab.email")}
                    </dt>
                    <dd className="min-w-0 text-right text-[14px] font-medium text-[#0F172A]">
                      {profileUser?.email
                        ? <a href={`mailto:${profileUser.email}`} className="break-all hover:text-[#1C4D8D]">{profileUser.email}</a>
                        : <span className="text-slate-400">{t("profile.overviewTab.notSet")}</span>}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="flex shrink-0 items-center gap-2 text-[13px] text-slate-500">
                      <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      {t("profile.overviewTab.phone")}
                    </dt>
                    <dd className="min-w-0 text-right text-[14px] font-medium text-[#0F172A]">
                      {profileUser?.phoneNumber
                        ? <a href={`tel:${profileUser.phoneNumber}`} className="hover:text-[#1C4D8D]">{profileUser.phoneNumber}</a>
                        : <span className="text-slate-400">{t("profile.overviewTab.notSet")}</span>}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="flex shrink-0 items-center gap-2 text-[13px] text-slate-500">
                      <Linkedin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      {t("profile.overviewTab.linkedin")}
                    </dt>
                    <dd className="min-w-0 text-right text-[14px] font-medium text-[#0F172A]">
                      {safeLinkedinUrl
                        ? <a href={safeLinkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#1C4D8D]">{t("profile.overviewTab.openProfile")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                        : <span className="text-slate-400">{t("profile.overviewTab.notSet")}</span>}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="flex shrink-0 items-center gap-2 text-[13px] text-slate-500">
                      <Globe className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      {t("profile.overviewTab.website")}
                    </dt>
                    <dd className="min-w-0 text-right text-[14px] font-medium text-[#0F172A]">
                      {safeWebsiteUrl
                        ? <a href={safeWebsiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#1C4D8D]">{t("profile.overviewTab.visitWebsite")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                        : <span className="text-slate-400">{t("profile.overviewTab.notSet")}</span>}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === "jobs" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#1e293b]">{t("profile.jobsTab.heading")}</h2>
                  {!profileLoading && totalApplicants > 0 ? (
                    <p className="mt-1 text-[13px] text-[#64748b]">
                      {t("profile.jobsTab.totalApplicants", { count: totalApplicants })}
                    </p>
                  ) : null}
                </div>
                <button type="button" onClick={() => navigate(ROUTES.employer.jobs)} className="text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                  {t("profile.jobsTab.manage")}
                </button>
              </div>

              {jobsLoading ? (
                <p className="py-8 text-center text-[14px] text-[#64748b]">{t("profile.jobsTab.loading")}</p>
              ) : jobsError ? (
                <div className="rounded-[16px] border border-[#fed7aa] bg-[#fff7ed] py-8 text-center">
                  <p className="text-[14px] text-[#9a3412]">{jobsError}</p>
                </div>
              ) : jobs.length ? (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <button
                      key={job._id}
                      type="button"
                      onClick={() => navigate(ROUTES.employer.jobs)}
                      className="flex w-full gap-4 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-5 text-left transition hover:border-[#1C4D8D]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-[13px] font-bold text-white">
                        {initialsOf(job.title, "J")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[15px] font-semibold text-[#1E293B]">{job.title}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${JOB_STATUS_STYLE[job.status] || JOB_STATUS_STYLE.Available}`}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-[13px] text-[#475569]">{job.location || t("profile.jobsTab.locationNotSet")}</p>
                        {job.description ? (
                          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#475569]">{job.description}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#64748B]">
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            {job.createdAt ? formatDate(new Date(job.createdAt), { month: "short", year: "numeric" }) : t("profile.jobsTab.dateUnavailable")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {t("profile.jobsTab.applicantCount", { count: job.applicants?.length ?? 0 })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[16px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-12 text-center">
                  <Briefcase className="mx-auto mb-3 h-10 w-10 text-[#94A3B8]" />
                  <p className="text-[14px] text-[#64748b] mb-4">{t("profile.jobsTab.empty")}</p>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.employer.postJob)}
                    className="bg-[#1C4D8D] text-white font-semibold py-2 px-4 rounded-[10px] hover:opacity-90 transition-all text-[13px]"
                  >
                    {t("profile.jobsTab.postJobCta")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
