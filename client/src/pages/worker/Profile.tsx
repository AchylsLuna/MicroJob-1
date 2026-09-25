import { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  Award,
  Download,
  Edit,
  Eye,
  Calendar,
  FileText,
  Linkedin,
  Globe,
  DollarSign,
  Briefcase,
  Images,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuth } from "../../contexts/AuthContext";
import {
  getProfile,
  getVerificationStatus,
  getUserApplications,
  type Certificate,
  type Internship,
  type WorkExperience,
} from "../../services/api";
import { ROUTES } from "../../utils/routes";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { toAbsoluteAssetUrl } from "../../lib/assetUrl";
import { isProfileFullyVerified } from "../../lib/profileVerification";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { SettingsTabList } from "../../components/settings/SettingsTabList";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { Button, StatTile } from "../../components/ui";

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

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  status: "complete" | "pending" | "in-review" | "rejected";
}

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
  const [activeTab, setActiveTab] = useState<"experience" | "biography" | "skills" | "accepted" | "portfolio">("experience");
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const [profileUser, setProfileUser] = useState(user);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [totalExperience, setTotalExperience] = useState("Not set");
  const [projectsCompleted, setProjectsCompleted] = useState(0);
  const [jobsApplied, setJobsApplied] = useState(0);
  const [successRate, setSuccessRate] = useState("0%");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([]);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [profileError, setProfileError] = useState("");
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
  const [verificationCompletionPercent, setVerificationCompletionPercent] = useState(0);
  const [isVerificationLoading, setIsVerificationLoading] = useState(true);
  const [acceptedWorks, setAcceptedWorks] = useState<AcceptedWork[]>([]);
  const [acceptedWorksLoading, setAcceptedWorksLoading] = useState(true);
  const [acceptedWorksError, setAcceptedWorksError] = useState("");
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const assetOrigin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  const resumeCandidate = toAbsoluteAssetUrl(resumeUrl);
  const safeResumeUrl = safeExternalUrl(resumeCandidate, { purpose: "asset", trustedOrigins: [assetOrigin] });
  const avatarCandidate = toAbsoluteAssetUrl(profileUser?.avatarUrl);
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
      setInternships(user.internships || []);
      setCertificates(user.certificates || []);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
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
        setInternships(Array.isArray(profile.internships) ? profile.internships : []);
        setCertificates(Array.isArray(profile.certificates) ? profile.certificates : []);
      } catch (error) {
        if (isMounted) setProfileError(error instanceof Error ? error.message : "Failed to load profile.");
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [profileReloadKey, updateAuthProfile]);

  useEffect(() => {
    let isMounted = true;
    const loadVerificationStatus = async () => {
      setIsVerificationLoading(true);
      try {
        const response = await getVerificationStatus();
        if (!isMounted) return;
        setVerificationSteps(response?.steps || []);
        setVerificationCompletionPercent(response?.completionPercent ?? 0);
      } catch {
        if (isMounted) {
          setVerificationSteps([]);
          setVerificationCompletionPercent(0);
        }
      } finally {
        if (isMounted) setIsVerificationLoading(false);
      }
    };
    void loadVerificationStatus();
    return () => {
      isMounted = false;
    };
  }, [profileReloadKey]);

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
            const companyLogo = initialsOf(company, "E");
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

  const profileUserId: string | undefined = (profileUser as any)?.id || (profileUser as any)?._id;
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
  const profileCompletionPercent = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100,
  );
  const completedVerificationSteps = verificationSteps.filter((step) => step.status === "complete").length;
  const remainingVerificationSteps = verificationSteps.filter((step) => step.status !== "complete");
  const hasFullyVerifiedProfile = isVerificationLoading
    ? isProfileFullyVerified(profileUser?.verification)
    : verificationSteps.length === 4 && verificationSteps.every((step) => step.status === "complete");
  const verificationSettingsUrl = `${ROUTES.worker.settings}?tab=verification`;
  const verificationLinkFor = (step: VerificationStep) => {
    if (step.id === "email") return ROUTES.emailVerification;
    if (step.id === "phone" && !profileUser?.phoneNumber) return `${ROUTES.worker.settings}?tab=personal`;
    return verificationSettingsUrl;
  };
  const verificationActionFor = (step: VerificationStep) => {
    if (step.status === "in-review") return "View verification";
    if (step.status === "rejected") return "Try again";
    if (step.id === "email") return "Verify email";
    if (step.id === "phone") return profileUser?.phoneNumber ? "Verify phone" : "Add phone number";
    if (step.id === "identity") return "Verify ID";
    return "Upload document";
  };

  const formatExperienceDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : formatDate(date, { month: "short", year: "numeric" });
  };

  const portfolioItems = workExperiences.flatMap((experience) =>
    (experience.media || []).map((media) => ({
      id: media._id || media.url,
      url: toAbsoluteAssetUrl(media.url),
      alt: media.originalName || experience.title,
      title: experience.title,
      company: experience.company,
    })),
  ).filter((item): item is typeof item & { url: string } => Boolean(item.url));

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
      <ProfileHeader
        name={profileData.name}
        title={profileData.title}
        location={profileData.location}
        email={profileData.email}
        avatarUrl={safeAvatarUrl}
        initials={initials}
        bio={profileData.about}
        moreLabel={t("profile.bio.more")}
        lessLabel={t("profile.bio.less")}
        isVerified={hasFullyVerifiedProfile}
        actions={
          <>
            <Button onClick={handleEditProfile}>
              <Edit className="h-4 w-4" aria-hidden="true" />
              {t("profile.editProfile")}
            </Button>
            {profileUserId ? (
              <Button
                onClick={() => navigate(`${ROUTES.publicProfile(profileUserId)}?viewAs=worker`)}
                className="!bg-white !text-[#1C4D8D] ring-1 ring-[#1C4D8D]/30 hover:!bg-[#1C4D8D]/[0.06]"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {t("profile.publicView")}
              </Button>
            ) : null}
          </>
        }
      />

      {/* Stat row -- every value here is schema-backed. Certificates and
          internships are counts of real entries, not self-reported numbers. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t("profile.overviewTab.totalExperience")} value={totalExperience} />
        <StatTile label={t("profile.statRow.certificates")} value={certificates.length} />
        <StatTile label={t("profile.statRow.internships")} value={internships.length} />
        <StatTile label={t("profile.overviewTab.successRate")} value={successRate} />
      </div>

      <section className="rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] p-5" aria-labelledby="worker-profile-completeness-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="worker-profile-completeness-title" className="text-[15px] font-semibold text-[#1E3A8A]">{t("profile.completeness.title")}</h2>
            <p className="mt-1 text-[13px] text-[#475569]">
              {profileCompletionPercent === 100 ? t("profile.completeness.ready") : t("profile.completeness.incomplete")}
            </p>
          </div>
          <span className="text-[22px] font-bold text-[#1C4D8D]">{profileCompletionPercent}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={t("profile.completeness.ariaLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletionPercent}>
          <div className="h-full rounded-full bg-[#1C4D8D] transition-all" style={{ width: `${profileCompletionPercent}%` }} />
        </div>
      </section>

      <section className="rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] p-5" aria-labelledby="worker-identity-verification-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="worker-identity-verification-title" className="text-[15px] font-semibold text-[#1E3A8A]">{t("profile.identityVerification.title")}</h2>
            <p className="mt-1 text-[13px] text-[#475569]">
              {hasFullyVerifiedProfile ? t("profile.identityVerification.verifiedDescription") : t("profile.identityVerification.description")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isVerificationLoading ? <RefreshCw className="h-4 w-4 animate-spin text-[#1C4D8D]" aria-label={t("profile.identityVerification.refreshingAria")} /> : null}
            <span className="text-[22px] font-bold text-[#1C4D8D]">{isVerificationLoading ? "—" : `${verificationCompletionPercent}%`}</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={t("profile.identityVerification.ariaLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={verificationCompletionPercent} aria-valuetext={t("profile.identityVerification.progressText", { completed: completedVerificationSteps, total: verificationSteps.length })}>
          <div className="h-full rounded-full bg-[#1C4D8D] transition-all" style={{ width: `${verificationCompletionPercent}%` }} />
        </div>
        {!isVerificationLoading && remainingVerificationSteps.length > 0 ? (
          <div className="mt-4 border-t border-[#BFDBFE] pt-4">
            <p className="text-[13px] font-semibold text-[#1E3A8A]">{t("profile.identityVerification.requirementsTitle")}</p>
            <ul className="mt-2 space-y-2">
              {remainingVerificationSteps.map((step) => (
                <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <div>
                    <p className="font-medium text-slate-800">{step.title}</p>
                    <p className="text-slate-600">{step.description}</p>
                  </div>
                  <Link
                    to={verificationLinkFor(step)}
                    className="shrink-0 font-semibold text-[#1C4D8D] underline underline-offset-2 hover:text-[#163F73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
                  >
                    {verificationActionFor(step)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Tabs */}
      <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6">
          <SettingsTabList
            variant="underline"
            ariaLabel={t("profile.tabs.experience")}
            idPrefix="worker-profile"
            options={[
              { id: "experience" as const, label: t("profile.tabs.experience") },
              { id: "biography" as const, label: t("profile.tabs.biography") },
              { id: "skills" as const, label: t("profile.tabs.skills") },
              { id: "portfolio" as const, label: t("profile.tabs.portfolio") },
              { id: "accepted" as const, label: t("profile.tabs.accepted") },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="p-6 sm:p-8" id={`worker-profile-panel-${activeTab}`} role="tabpanel" aria-labelledby={`worker-profile-tab-${activeTab}`}>
          {/* Biography Tab — about, contact, and CV. The Skills list and Quick
              Stats blocks that used to live here were removed: both duplicated
              content already shown in the Skills tab and the stat row above. */}
          {activeTab === "biography" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - About & Contact */}
                <div className="lg:col-span-2 space-y-8">
                  {/* About Section */}
                  <div>
                    <h2 className="mb-3 text-[17px] font-bold text-[#0F172A]">{t("profile.overviewTab.aboutMe")}</h2>
                    <p className="text-[14px] leading-6 text-slate-600">{profileData.about}</p>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h2 className="mb-3 text-[17px] font-bold text-[#0F172A]">{t("profile.overviewTab.contactInfo")}</h2>
                    {/* A plain divided list rather than four bordered cards with
                        colored icon chips -- same four facts, a quarter of the
                        visual weight. */}
                    <dl className="divide-y divide-slate-100 border-y border-slate-100">
                      <div className="flex items-baseline justify-between gap-4 py-2.5">
                        <dt className="flex shrink-0 items-center gap-2 text-[13px] text-slate-500">
                          <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {t("profile.overviewTab.email")}
                        </dt>
                        <dd className="min-w-0 text-right text-[14px] font-medium text-[#0F172A]">
                          {profileUser?.email
                            ? <a href={`mailto:${profileUser.email}`} className="break-all hover:text-[#1C4D8D]">{profileData.email}</a>
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
                            ? <a href={`tel:${profileUser.phoneNumber}`} className="hover:text-[#1C4D8D]">{profileData.phone}</a>
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

                  {/* The old "Quick Stats" card lived here and repeated Total
                      Experience / Jobs Completed / Success Rate verbatim from
                      the stat row above it. Removed rather than restyled --
                      one source for a number beats two that can disagree. */}
                  <div className="rounded-[14px] border border-slate-200 p-5">
                    <h3 className="mb-3 text-[15px] font-bold text-[#0F172A]">{t("profile.overviewTab.jobsApplied")}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[24px] font-bold text-[#1C4D8D]">{jobsApplied}</span>
                      <span className="text-[13px] text-slate-500">
                        {t("profile.overviewTab.jobsCompletedInline", { count: projectsCompleted })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Experience Tab -- work history, internships, and certificates.
              Work history used to share the "Skills" tab with the skills grid,
              which buried it under a label that didn't describe it. */}
          {activeTab === "experience" && (
            <div className="space-y-10">
              <section>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-[17px] font-bold text-[#0F172A]">
                    {t("profile.skillsTab.workHistory")}
                    <span className="ml-2 text-[13px] font-medium text-slate-400">
                      {t("profile.skillsTab.entry", { count: workExperiences.length })}
                    </span>
                  </h2>
                  <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)} className="min-h-11 shrink-0 text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                    {t("profile.addMore")}
                  </button>
                </div>
                {workExperiences.length ? (
                  <div className="space-y-3">
                    {workExperiences.map((item, index) => (
                      <div key={item._id || item.id || `${item.title}-${index}`} className="flex gap-4 rounded-[14px] border border-slate-200 p-5">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1C4D8D] text-[13px] font-bold text-white">
                          {initialsOf(item.company, "?")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#0F172A]">{item.title}</p>
                          <p className="text-[13px] text-slate-600">{[item.company, item.location].filter(Boolean).join(" · ")}</p>
                          <p className="mt-1 text-[12px] text-slate-400">{formatExperienceDate(item.startDate)} – {item.current ? t("profile.skillsTab.present") : formatExperienceDate(item.endDate)}</p>
                          {item.description ? <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-slate-600">{item.description}</p> : null}
                          {item.media?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.media.map((media) => {
                                const mediaUrl = toAbsoluteAssetUrl(media.url);
                                if (!mediaUrl) return null;
                                return (
                                  <a
                                    key={media._id || media.url}
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                                  >
                                    <img src={mediaUrl} alt={media.originalName || item.title} className="h-full w-full object-cover" />
                                  </a>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-dashed border-slate-300 py-8 text-center">
                    <Briefcase className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
                    <p className="text-[13px] text-slate-500">{t("profile.skillsTab.noWorkHistory")}</p>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-[17px] font-bold text-[#0F172A]">
                    {t("profile.internships.heading")}
                    <span className="ml-2 text-[13px] font-medium text-slate-400">
                      {t("profile.skillsTab.entry", { count: internships.length })}
                    </span>
                  </h2>
                  <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)} className="min-h-11 shrink-0 text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                    {t("profile.addMore")}
                  </button>
                </div>
                {internships.length ? (
                  <div className="space-y-3">
                    {internships.map((item, index) => (
                      <div key={item._id || item.id || `${item.title}-${index}`} className="flex gap-4 rounded-[14px] border border-slate-200 p-5">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#4988C4] text-[13px] font-bold text-white">
                          {initialsOf(item.company, "?")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#0F172A]">{item.title}</p>
                          <p className="text-[13px] text-slate-600">{[item.company, item.location].filter(Boolean).join(" · ")}</p>
                          <p className="mt-1 text-[12px] text-slate-400">{formatExperienceDate(item.startDate)} – {item.current ? t("profile.skillsTab.present") : formatExperienceDate(item.endDate)}</p>
                          {item.description ? <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-slate-600">{item.description}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-dashed border-slate-300 py-8 text-center">
                    <p className="text-[13px] text-slate-500">{t("profile.internships.empty")}</p>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-[17px] font-bold text-[#0F172A]">
                    {t("profile.certificates.heading")}
                    <span className="ml-2 text-[13px] font-medium text-slate-400">
                      {t("profile.skillsTab.entry", { count: certificates.length })}
                    </span>
                  </h2>
                  <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)} className="min-h-11 shrink-0 text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                    {t("profile.addMore")}
                  </button>
                </div>
                {certificates.length ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {certificates.map((item, index) => {
                      const safeCredentialUrl = safeExternalUrl(item.credentialUrl || "", { purpose: "external" });
                      return (
                        <div key={item._id || item.id || `${item.name}-${index}`} className="rounded-[14px] border border-slate-200 p-5">
                          <p className="text-[15px] font-semibold text-[#0F172A]">{item.name}</p>
                          <p className="text-[13px] text-slate-600">{item.issuer}</p>
                          <p className="mt-1 text-[12px] text-slate-400">
                            {formatExperienceDate(item.issueDate)}
                            {item.expiryDate
                              ? ` – ${formatExperienceDate(item.expiryDate)}`
                              : ` · ${t("profile.certificates.noExpiry")}`}
                          </p>
                          {item.credentialId ? (
                            <p className="mt-2 text-[12px] text-slate-500">
                              {t("profile.certificates.credentialId", { id: item.credentialId })}
                            </p>
                          ) : null}
                          {safeCredentialUrl ? (
                            <a
                              href={safeCredentialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-[#1C4D8D] hover:underline"
                            >
                              {t("profile.certificates.verify")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-dashed border-slate-300 py-8 text-center">
                    <p className="text-[13px] text-slate-500">{t("profile.certificates.empty")}</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === "skills" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[17px] font-bold text-[#0F172A]">
                  {t("profile.skillsTab.skillsHeading")}
                  <span className="ml-2 text-[13px] font-medium text-slate-400">
                    {t("profile.skillsTab.skill", { count: skills.length })}
                  </span>
                </h2>
                <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)} className="min-h-11 shrink-0 text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                  {t("profile.skillsTab.manage")}
                </button>
              </div>
              {skills.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {skills.map((skill) => (
                    <div key={skill.id} className="rounded-[14px] border border-slate-200 p-5">
                      <h3 className="text-[15px] font-semibold text-[#0F172A]">{skill.name}</h3>
                      <p className="mt-1 text-[13px] leading-6 text-slate-600">
                        {skill.description?.trim() || t("profile.overviewTab.noDescriptionAdded")}
                      </p>
                      {skill.endorsements ? (
                        <span className="mt-2 flex items-center gap-1 text-[12px] text-slate-400">
                          <Award className="h-3 w-3" aria-hidden="true" />
                          {t("profile.skillsTab.endorsements", { count: skill.endorsements })}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-slate-300 py-12 text-center">
                  <Award className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
                  <p className="text-[14px] text-slate-500">{t("profile.skillsTab.noSkillsTitle")}</p>
                  <p className="mt-1 text-[12px] text-slate-400">{t("profile.skillsTab.noSkillsHint")}</p>
                </div>
              )}
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === "portfolio" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-semibold text-[#1e293b]">{t("profile.portfolioTab.heading")}</h2>
                <button type="button" onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)} className="text-[13px] font-semibold text-[#1C4D8D] hover:underline">
                  {t("profile.skillsTab.manage")}
                </button>
              </div>
              {portfolioItems.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {portfolioItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
                    >
                      <div className="aspect-square overflow-hidden bg-[#F1F5F9]">
                        <img src={item.url} alt={item.alt} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[12px] font-semibold text-[#1E293B]">{item.title}</p>
                        <p className="truncate text-[11px] text-[#64748B]">{item.company}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-[16px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-12 text-center">
                  <Images className="mx-auto mb-3 h-10 w-10 text-[#94A3B8]" />
                  <p className="text-[14px] text-[#64748b] mb-3">{t("profile.portfolioTab.empty")}</p>
                  <p className="mb-4 text-[12px] text-[#94a3b8]">{t("profile.portfolioTab.emptyHint")}</p>
                  <button
                    type="button"
                    onClick={() => navigate(`${ROUTES.worker.settings}?tab=experience`)}
                    className="bg-[#1C4D8D] text-white font-semibold py-2 px-4 rounded-[10px] hover:opacity-90 transition-all text-[13px]"
                  >
                    {t("profile.portfolioTab.manage")}
                  </button>
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
