import { ArrowLeft, Briefcase, MapPin, Star, CheckCircle2, Building2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPublicProfile } from "../../services/api";

type PublicProfileResponse = {
  profile?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    city?: string;
    province?: string;
    address?: string;
    about?: string;
    totalExperience?: string;
    companyName?: string;
    avatarUrl?: string;
    resumeUrl?: string;
    resumeFileName?: string;
    skills?: Array<{ name?: string } | string>;
  };
  rating?: {
    viewAs?: "worker" | "employer";
    hidden?: boolean;
    stars?: number | null;
    percentage?: number | null;
    completedCount?: number | null;
    totalCount?: number | null;
  };
  stats?: {
    worker?: {
      jobsApplied?: number;
      projectsCompleted?: number;
      successRate?: number;
    };
    employer?: {
      jobsPosted?: number;
      totalApplicants?: number;
      hires?: number | null;
      hiresHidden?: boolean;
      successRate?: number | null;
    };
  };
};

const toAbsoluteAssetUrl = (value?: string): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) {
    const apiBase = import.meta.env.VITE_API_BASE || "/api";
    const origin = apiBase.startsWith("http")
      ? apiBase.replace(/\/api\/?$/, "")
      : window.location.origin;
    return `${origin}${value}`;
  }
  return value;
};

export function PublicProfile() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewAs = searchParams.get("viewAs") === "employer" ? "employer" : "worker";

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await getPublicProfile(userId, viewAs);
        if (!isMounted) return;
        setData(response as PublicProfileResponse);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load profile.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, viewAs]);

  const fullName = useMemo(() => {
    const first = data?.profile?.firstName || "";
    const last = data?.profile?.lastName || "";
    return `${first} ${last}`.trim() || "User";
  }, [data?.profile?.firstName, data?.profile?.lastName]);

  const skills = useMemo(() => {
    const raw = data?.profile?.skills || [];
    return raw
      .map((entry) => (typeof entry === "string" ? entry : entry?.name || ""))
      .filter(Boolean);
  }, [data?.profile?.skills]);

  const avatarUrl = toAbsoluteAssetUrl(data?.profile?.avatarUrl);
  const ratingStars = Math.max(0, Math.min(5, Number(data?.rating?.stars || 0)));
  const ratingPercentage = Math.max(0, Math.min(100, Number(data?.rating?.percentage || 0)));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-[14px] text-[#475569] hover:text-[#0F172A]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
        {isLoading ? <p className="text-[#64748B]">Loading profile...</p> : null}
        {error ? <p className="text-[#B91C1C]">{error}</p> : null}

        {!isLoading && !error && data?.profile ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-20 h-20 rounded-2xl object-cover border border-[#E2E8F0]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#DBEAFE] text-[#1E3A8A] font-bold text-2xl flex items-center justify-center">
                  {fullName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-2xl font-bold text-[#0F172A]">{fullName}</h1>
                <p className="text-sm text-[#475569]">{data.profile.email || "No email"}</p>
                {viewAs === "employer" ? (
                  <p className="mt-1 text-sm font-medium text-[#1D4ED8]">Employer Profile</p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-[#0F766E]">Worker Profile</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.rating?.hidden ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 md:col-span-2">
                  <p className="text-xs text-[#64748B] mb-1">Hiring performance</p>
                  <p className="text-sm font-semibold text-[#334155]">Private</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    This employer has chosen not to share hiring totals.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-xs text-[#64748B] mb-1">Rating</p>
                    <div className="flex items-center gap-2 mb-2">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`w-4 h-4 ${idx < Math.round(ratingStars) ? "text-[#F59E0B] fill-[#F59E0B]" : "text-[#CBD5E1]"}`}
                        />
                      ))}
                      <span className="text-sm font-semibold text-[#0F172A]">{ratingStars.toFixed(1)}/5</span>
                    </div>
                    <p className="text-sm text-[#334155]">{ratingPercentage}% success</p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-xs text-[#64748B] mb-1">Completed</p>
                    <p className="text-xl font-bold text-[#0F172A]">{data.rating?.completedCount || 0}</p>
                    <p className="text-sm text-[#334155]">out of {data.rating?.totalCount || 0} records</p>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B] mb-1">Location</p>
                <p className="text-sm font-medium text-[#0F172A] flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#64748B]" />
                  {[data.profile.city, data.profile.province].filter(Boolean).join(", ") || "Not specified"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B] mb-2">About</p>
                <p className="text-sm text-[#334155]">{data.profile.about || "No profile summary provided."}</p>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
                {viewAs === "employer" ? (
                  <>
                    <p className="text-xs text-[#64748B]">Company</p>
                    <p className="text-sm font-medium text-[#0F172A] flex items-center gap-1">
                      <Building2 className="w-4 h-4 text-[#64748B]" />
                      {data.profile.companyName || "Not specified"}
                    </p>
                    <p className="text-xs text-[#64748B] mt-2">Jobs Posted</p>
                    <p className="text-sm text-[#334155]">{data.stats?.employer?.jobsPosted || 0}</p>
                    <p className="text-xs text-[#64748B]">Total Applicants</p>
                    <p className="text-sm text-[#334155]">{data.stats?.employer?.totalApplicants || 0}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#64748B]">Experience</p>
                    <p className="text-sm font-medium text-[#0F172A] flex items-center gap-1">
                      <Briefcase className="w-4 h-4 text-[#64748B]" />
                      {data.profile.totalExperience || "Not specified"}
                    </p>
                    <p className="text-xs text-[#64748B] mt-2">Jobs Applied</p>
                    <p className="text-sm text-[#334155]">{data.stats?.worker?.jobsApplied || 0}</p>
                    <p className="text-xs text-[#64748B]">Completed Jobs</p>
                    <p className="text-sm text-[#334155]">{data.stats?.worker?.projectsCompleted || 0}</p>
                  </>
                )}
              </div>
            </div>

            {skills.length > 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B] mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EEF2FF] text-[#3730A3] text-xs font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
