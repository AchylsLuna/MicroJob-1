import { useEffect, useState } from "react";
import { Eye, EyeOff, Upload, Trash2, CheckCircle2, Clock, Circle } from "lucide-react";
import { toast } from "../lib/toast";
import { useSearchParams } from "react-router-dom";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  requestPasswordChangeOtp,
  confirmPasswordChangeWithOtp,
  getSessions,
  revokeSession,
  revokeAllSessions,
  cleanupInactiveSessions,
  getVerificationStatus,
  requestPhoneVerificationOtp,
  confirmPhoneVerificationOtp,
  uploadIdentityDocument,
  uploadAddressDocument,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { DeleteAccountCard } from "./settings/DeleteAccountCard";
import { EmployerPaymentMethodsSection } from "./settings/EmployerPaymentMethodsSection";
import { EmployerPrivacyCard } from "./settings/EmployerPrivacyCard";
import { MfaSettingsCard } from "./settings/MfaSettingsCard";
import { WorkerResumeSection } from "./settings/WorkerResumeSection";

const toAbsoluteAssetUrl = (value?: string | null): string | null => {
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

type TabType = "account" | "privacy" | "payments";
type AccountTab = "personal" | "experience" | "resume";

const accountTabConfig: { id: AccountTab; label: string }[] = [
  { id: "personal", label: "Personal Information" },
  { id: "experience", label: "Experience" },
  { id: "resume", label: "CV/Resume" },
];

const mainTabConfig: { id: TabType; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "privacy", label: "Security & Privacy" },
  { id: "payments", label: "Payments" },
];

const mapTabParam = (value: string | null): TabType | null => {
  if (!value) return null;
  if (value === "account") return "account";
  if (value === "privacy") return "privacy";
  if (value === "payments" || value === "payment-methods") return "payments";
  if (["personal", "experience", "resume", "cv"].includes(value)) return "account";
  if (["security", "verification"].includes(value)) return "privacy";
  return null;
};

const mapAccountTab = (value: string | null): AccountTab | null => {
  if (!value) return null;
  if (value === "personal") return "personal";
  if (value === "experience") return "experience";
  if (value === "resume") return "resume";
  if (value === "cv") return "resume";
  return null;
};

type VerificationStatus = "complete" | "pending" | "in-review";

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  status: VerificationStatus;
}

const verificationStatusStyles: Record<VerificationStatus, string> = {
  complete: "bg-[#DCFCE7] text-[#166534]",
  "in-review": "bg-[#FEF3C7] text-[#92400E]",
  pending: "bg-[#E2E8F0] text-[#475569]",
};

const verificationStatusLabels: Record<VerificationStatus, string> = {
  complete: "Completed",
  "in-review": "In Review",
  pending: "Pending",
};

const addressSuggestions = [
  "Near City Hall",
  "Near Public Market",
  "Near Barangay Hall",
  "Near Transport Terminal",
  "Near School Zone",
  "Near Business District",
];

interface ProvinceOption {
  code: string;
  name: string;
}

interface CityOption {
  code: string;
  name: string;
  provinceCode?: string;
}

interface BarangayOption {
  code: string;
  name: string;
}

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";

interface SkillItem {
  id: string;
  name: string;
  description?: string;
  endorsements?: number;
}

interface SessionInfo {
  id: string;
  current: boolean;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
}

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = mapTabParam(searchParams.get("tab")) ?? "account";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const initialAccountTab = mapAccountTab(searchParams.get("tab")) ?? "personal";
  const [accountTab, setAccountTab] = useState<AccountTab>(initialAccountTab);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hideHiredCandidates, setHideHiredCandidates] = useState(true);
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const roleValue = String((user as any)?.role || "").toLowerCase();
  const accountTypeValue = String((user as any)?.accountType || "").toLowerCase();
  const isAdminRole = roleValue === "admin" || roleValue === "superadmin";
  const isEmployerRole =
    accountTypeValue === "employer" || roleValue === "hire" || roleValue === "employer";
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "Jonas",
    lastName: "Dela Cruz",
    companyName: "",
    city: "Manila",
    province: "",
    barangay: "",
    addressType: "home",
    address: "",
    phone: "+63 912 345 6789",
    email: "jonas.delacruz@email.com",
    about: "",
    photo: null as File | null,
  });

  const [skills, setSkills] = useState<SkillItem[]>([]);

  const [experienceStats, setExperienceStats] = useState({
    totalExperience: "",
    projectsCompleted: 0,
    jobsApplied: 0,
    successRate: "",
  });

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDescription, setNewSkillDescription] = useState("");
  const [skillSelectionMode, setSkillSelectionMode] = useState<"predefined" | "custom">("predefined");
  const [selectedPredefinedSkill, setSelectedPredefinedSkill] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingSkillDescription, setEditingSkillDescription] = useState("");

  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpRequested, setPasswordOtpRequested] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const resolvedAvatarUrl = toAbsoluteAssetUrl(avatarUrl);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const [verificationStepsData, setVerificationStepsData] = useState<VerificationStep[]>([]);
  const [verificationCompletionPercent, setVerificationCompletionPercent] = useState(0);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [phoneCodeRequested, setPhoneCodeRequested] = useState(false);
  const [isSendingPhoneCode, setIsSendingPhoneCode] = useState(false);
  const [isConfirmingPhoneCode, setIsConfirmingPhoneCode] = useState(false);
  const [phoneCodeHint, setPhoneCodeHint] = useState<string | null>(null);

  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [barangayOptions, setBarangayOptions] = useState<BarangayOption[]>([]);
  const [isLoadingLocationData, setIsLoadingLocationData] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);

  const completedSteps = verificationStepsData.filter((step) => step.status === "complete").length;

  const selectedProvince = provinceOptions.find(
    (item) => item.name.toLowerCase() === personalInfo.province.trim().toLowerCase(),
  );

  const selectedCity = cityOptions.find(
    (item) => item.name.toLowerCase() === personalInfo.city.trim().toLowerCase(),
  );

  const filteredCityOptions = selectedProvince?.code
    ? cityOptions.filter((item) => item.provinceCode === selectedProvince.code)
    : cityOptions;

  const visibleMainTabs = isEmployerRole
    ? mainTabConfig
    : mainTabConfig.filter((tab) => tab.id !== "payments");

  const visibleAccountTabs = (isAdminRole || isEmployerRole
    ? accountTabConfig.filter((tab) => tab.id === "personal")
    : accountTabConfig
  ).map((tab) =>
    isEmployerRole && tab.id === "personal"
      ? { ...tab, label: "Business Information" }
      : tab
  );

  useEffect(() => {
    if (!visibleMainTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("account");
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "account");
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams, visibleMainTabs]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const mappedTab = mapTabParam(tabParam);
    if (!mappedTab) {
      if (tabParam) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", "account");
        setSearchParams(nextParams, { replace: true });
      }
      return;
    }
    if (mappedTab !== activeTab) {
      setActiveTab(mappedTab);
    }
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeTab !== "account") return;
    const tabParam = searchParams.get("tab");
    const mappedAccountTab = mapAccountTab(tabParam);
    const isVisible = (tab: AccountTab) => visibleAccountTabs.some((item) => item.id === tab);

    if (mappedAccountTab) {
      if (!isVisible(mappedAccountTab)) {
        setAccountTab("personal");
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", "personal");
        setSearchParams(nextParams, { replace: true });
        return;
      }
      if (mappedAccountTab !== accountTab) {
        setAccountTab(mappedAccountTab);
      }
      return;
    }
    if ((tabParam === "account" || !isVisible(accountTab)) && accountTab !== "personal") {
      setAccountTab("personal");
    }
  }, [activeTab, accountTab, searchParams, visibleAccountTabs, setSearchParams]);

  const handleAccountTabChange = (tab: AccountTab) => {
    setAccountTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleMainTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === "account") {
      nextParams.set("tab", accountTab);
    } else {
      nextParams.set("tab", tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const reloadVerificationStatus = async () => {
    const response = await getVerificationStatus();
    const steps = response?.steps || [];
    setVerificationStepsData(steps);
    setVerificationCompletionPercent(response?.completionPercent || 0);

    const phoneStep = steps.find((step: VerificationStep) => step.id === "phone");
    if (phoneStep?.status === "complete") {
      setPhoneCodeRequested(false);
      setPhoneVerificationCode("");
      setPhoneCodeHint(null);
    }
  };

  // Load sessions when privacy tab is active
  useEffect(() => {
    if (activeTab !== "privacy") return;
    const loadSessions = async () => {
      setIsLoadingSessions(true);
      try {
        // Clean up inactive sessions first
        try {
          await cleanupInactiveSessions();
        } catch (cleanupErr) {
          console.warn("Cleanup sessions warning:", cleanupErr);
          // Continue even if cleanup fails
        }
        
        const response = await getSessions();
        const sessionsData = response?.sessions || [];

        const mapped = sessionsData.map((s: any) => ({
          id: s._id,
          current: s.isCurrent === true,
          device: s.userAgent || "Unknown device",
          location: "Unknown",
          ip: s.ip || "Unknown",
          lastActive: s.createdAt ? new Date(s.createdAt).toLocaleString() : "Unknown",
        }));
        setSessions(mapped);
      } catch (error: any) {
        console.error("Failed to load sessions:", error);
        toast.error("Failed to load active sessions");
      } finally {
        setIsLoadingSessions(false);
      }
    };
    loadSessions();
  }, [activeTab]);

  // Load verification status when privacy tab is active
  useEffect(() => {
    if (activeTab !== "privacy" || isAdminRole) return;
    const loadVerification = async () => {
      setIsLoadingVerification(true);
      try {
        await reloadVerificationStatus();
      } catch (error: any) {
        console.error("Failed to load verification status:", error);
        toast.error("Failed to load verification status");
      } finally {
        setIsLoadingVerification(false);
      }
    };
    loadVerification();
  }, [activeTab, isAdminRole]);

  const handlePersonalInfoChange = (field: string, value: string) => {
    if (field === "province") {
      setPersonalInfo((prev) => ({
        ...prev,
        province: value,
        city: "",
        barangay: "",
      }));
      return;
    }

    if (field === "city") {
      setPersonalInfo((prev) => ({
        ...prev,
        city: value,
        barangay: "",
      }));
      return;
    }

    setPersonalInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadAvatar(file);
      const newAvatarUrl = toAbsoluteAssetUrl(response?.data?.avatarUrl || null);
      setAvatarUrl(newAvatarUrl);
      updateAuthProfile({ avatarUrl: newAvatarUrl ?? undefined });
      toast.success("Profile photo uploaded successfully!");
      // Trigger sidebar update
      window.dispatchEvent(new Event('auth_user_updated'));
    } catch (error: any) {
      toast.error(error.message || "Failed to upload profile photo");
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await deleteAvatar();
      setAvatarUrl(null);
      updateAuthProfile({ avatarUrl: undefined });
      toast.success("Profile photo removed successfully!");
      // Trigger sidebar update
      window.dispatchEvent(new Event('auth_user_updated'));
    } catch (error: any) {
      toast.error(error.message || "Failed to remove profile photo");
    }
  };

  useEffect(() => {
    if (!user) return;
    setPersonalInfo((prev) => ({
      ...prev,
      firstName: user.firstName || prev.firstName,
      lastName: user.lastName || prev.lastName,
      companyName: (user as any).companyName || prev.companyName,
      email: user.email || prev.email,
      phone: user.phoneNumber || prev.phone,
      city: user.city || prev.city,
      province: (user as any).province || prev.province,
      barangay: (user as any).barangay || prev.barangay,
      addressType: (user as any).addressType || prev.addressType,
      address: (user as any).address || prev.address,
      about: user.about || prev.about,
    }));
    setExperienceStats({
      totalExperience: user.totalExperience || "",
      projectsCompleted: user.projectsCompleted || 0,
      jobsApplied: user.jobsApplied || 0,
      successRate: user.successRate || "",
    });
    if (user.skills && Array.isArray(user.skills)) {
      const mappedSkills = user.skills.map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || '',
      })) as SkillItem[];
      setSkills(mappedSkills);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadLocationData = async () => {
      setIsLoadingLocationData(true);
      try {
        const [provinceResponse, cityResponse] = await Promise.all([
          fetch(`${PSGC_BASE_URL}/provinces/`),
          fetch(`${PSGC_BASE_URL}/cities-municipalities/`),
        ]);

        if (!provinceResponse.ok || !cityResponse.ok) {
          throw new Error("Failed to load Philippine address data");
        }

        const [provinceJson, cityJson] = await Promise.all([provinceResponse.json(), cityResponse.json()]);

        if (!isMounted) return;

        const normalizedProvinces: ProvinceOption[] = (provinceJson || [])
          .map((item: any) => ({
            code: String(item.code || ""),
            name: String(item.name || "").trim(),
          }))
          .filter((item: ProvinceOption) => item.code && item.name)
          .sort((a: ProvinceOption, b: ProvinceOption) => a.name.localeCompare(b.name));

        const normalizedCities: CityOption[] = (cityJson || [])
          .map((item: any) => ({
            code: String(item.code || ""),
            name: String(item.name || "").trim(),
            provinceCode: item.provinceCode ? String(item.provinceCode) : undefined,
          }))
          .filter((item: CityOption) => item.code && item.name)
          .sort((a: CityOption, b: CityOption) => a.name.localeCompare(b.name));

        setProvinceOptions(normalizedProvinces);
        setCityOptions(normalizedCities);
      } catch (error) {
        console.error("Failed to load Philippine location data:", error);
      } finally {
        if (isMounted) {
          setIsLoadingLocationData(false);
        }
      }
    };

    loadLocationData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadBarangays = async () => {
      if (!selectedCity?.code) {
        setBarangayOptions([]);
        return;
      }

      setIsLoadingBarangays(true);
      try {
        const response = await fetch(`${PSGC_BASE_URL}/cities-municipalities/${selectedCity.code}/barangays/`);
        if (!response.ok) {
          throw new Error("Failed to load barangays");
        }

        const json = await response.json();
        if (!isMounted) return;

        const normalized: BarangayOption[] = (json || [])
          .map((item: any) => ({
            code: String(item.code || ""),
            name: String(item.name || "").trim(),
          }))
          .filter((item: BarangayOption) => item.code && item.name)
          .sort((a: BarangayOption, b: BarangayOption) => a.name.localeCompare(b.name));

        setBarangayOptions(normalized);
      } catch (error) {
        console.error("Failed to load barangays:", error);
        if (isMounted) {
          setBarangayOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingBarangays(false);
        }
      }
    };

    loadBarangays();

    return () => {
      isMounted = false;
    };
  }, [selectedCity?.code]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const response = await getProfile();
        const profile = (response as any)?.user ?? response;
        if (!isMounted || !profile) return;
        setPersonalInfo((prev) => ({
          ...prev,
          firstName: profile.firstName || prev.firstName,
          lastName: profile.lastName || prev.lastName,
          companyName: profile.companyName || prev.companyName,
          email: profile.email || prev.email,
          phone: profile.phoneNumber || prev.phone,
          city: profile.city || prev.city,
          province: profile.province || prev.province,
          barangay: profile.barangay || prev.barangay,
          addressType: profile.addressType || prev.addressType,
          address: profile.address || prev.address,
          about: profile.about || prev.about,
        }));
        if (profile.skills && Array.isArray(profile.skills)) {
          const mappedSkills = profile.skills.map((skill: any) => ({
            ...skill,
            id: skill.id || skill._id || '',
          })) as SkillItem[];
          setSkills(mappedSkills);
        }
        setExperienceStats({
          totalExperience: profile.totalExperience || "",
          projectsCompleted: profile.projectsCompleted || 0,
          jobsApplied: profile.jobsApplied || 0,
          successRate: profile.successRate || "",
        });
        if (profile.resumeUrl) {
          setResumeUrl(profile.resumeUrl);
        }
        if (profile.avatarUrl) {
          setAvatarUrl(toAbsoluteAssetUrl(profile.avatarUrl));
        }
        if (typeof profile.hideHiredCandidates === "boolean") {
          setHideHiredCandidates(profile.hideHiredCandidates);
        }
        const normalizedAvatarUrl: string | undefined = toAbsoluteAssetUrl(profile.avatarUrl) || undefined;
        updateAuthProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          city: profile.city,
          about: profile.about,
          totalExperience: profile.totalExperience,
          projectsCompleted: profile.projectsCompleted,
          jobsApplied: profile.jobsApplied,
          successRate: profile.successRate,
          avatarUrl: normalizedAvatarUrl,
        });
      } catch (error: any) {
        const message = error?.message || "Failed to load profile.";
        toast.error(message);
      } finally {
        if (isMounted) setIsProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [updateAuthProfile]);

  const handleSavePersonalInfo = async () => {
    setIsProfileSaving(true);
    try {
      const profilePayload: Record<string, string> = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        companyName: personalInfo.companyName,
        city: personalInfo.city,
        province: personalInfo.province,
        barangay: personalInfo.barangay,
        addressType: personalInfo.addressType,
        address: personalInfo.address,
      };
      if (!isAdminRole) {
        profilePayload.phoneNumber = personalInfo.phone;
        profilePayload.about = personalInfo.about;
        profilePayload.totalExperience = experienceStats.totalExperience;
      }
      const response = await updateProfile({
        ...profilePayload,
        // Note: projectsCompleted, jobsApplied, and successRate are auto-calculated by backend
      });
      const updated = (response as any)?.user ?? response;
      
      // Update local state with auto-calculated values from backend
      setExperienceStats({
        totalExperience: updated.totalExperience || experienceStats.totalExperience,
        projectsCompleted: updated.projectsCompleted || 0,
        jobsApplied: updated.jobsApplied || 0,
        successRate: updated.successRate || '0%',
      });
      
      updateAuthProfile({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phoneNumber: updated.phoneNumber,
        city: updated.city,
        about: updated.about || personalInfo.about,
        totalExperience: updated.totalExperience || experienceStats.totalExperience,
        projectsCompleted: updated.projectsCompleted || 0,
        jobsApplied: updated.jobsApplied || 0,
        successRate: updated.successRate || '0%',
        avatarUrl: updated.avatarUrl,
      });
      toast.success("Personal information saved successfully!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save personal information.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleAddSkill = async () => {
    const skillName = skillSelectionMode === "predefined" ? selectedPredefinedSkill : newSkillName.trim();
    const skillDescription = newSkillDescription.trim();
    
    if (!skillName) {
      toast.error("Please select or enter a skill name");
      return;
    }
    try {
      const response = await fetch("/api/auth/profile/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: skillName,
          description: skillDescription,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to add skill");
      }
      const mappedSkills = (data.data?.skills || []).map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || "",
      })) as SkillItem[];
      setSkills(mappedSkills);
      updateAuthProfile({ skills: mappedSkills });
      setNewSkillName("");
      setNewSkillDescription("");
      setSelectedPredefinedSkill("");
      setSkillSelectionMode("predefined");
      toast.success(data?.message || `${skillName} saved to your skills!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add skill");
    }
  };

  const handleEditSkillDescription = async (id: string) => {
    try {
      const response = await fetch(`/api/auth/profile/skills/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          description: editingSkillDescription,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Failed to update skill description");
      const mappedSkills = (data.data?.skills || []).map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || "",
      })) as SkillItem[];
      setSkills(mappedSkills);
      updateAuthProfile({ skills: mappedSkills });
      setEditingSkillId(null);
      setEditingSkillDescription("");
      toast.success("Skill description updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update skill description");
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      const response = await fetch(`/api/auth/profile/skills/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete skill");
      const data = await response.json();
      const mappedSkills = (data.data?.skills || []).map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || "",
      })) as SkillItem[];
      setSkills(mappedSkills);
      updateAuthProfile({ skills: mappedSkills });
      toast.success("Skill removed successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove skill");
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!securityData.currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    setIsOtpSending(true);
    try {
      await requestPasswordChangeOtp({ currentPassword: securityData.currentPassword });
      setPasswordOtpRequested(true);
      toast.success("OTP sent to your email");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send OTP");
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordOtpRequested) {
      toast.error("Request OTP first");
      return;
    }

    if (!passwordOtp) {
      toast.error("Please enter the OTP code");
      return;
    }

    if (!securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await confirmPasswordChangeWithOtp({
        currentPassword: securityData.currentPassword,
        code: passwordOtp,
        newPassword: securityData.newPassword,
      });
      toast.success("Password changed successfully!");
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordOtp("");
      setPasswordOtpRequested(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to change password");
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleDiscardPassword = () => {
    setSecurityData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordOtp("");
    setPasswordOtpRequested(false);
    toast.info("Changes discarded");
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      // Immediately update UI by removing the session
      setSessions(prevSessions => prevSessions.filter((s) => s.id !== sessionId));
      toast.success("Session revoked successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to revoke session");
      console.error("Revoke session error:", error);
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessions();
      // Clear all sessions from state
      setSessions([]);
      toast.success("All sessions revoked. You will be logged out.");
      // Optionally redirect to login or refresh the page
      window.location.href = "/sign-in";
    } catch (error: any) {
      toast.error(error?.message || "Failed to revoke all sessions");
    }
  };

  const handleRequestPhoneCode = async () => {
    try {
      setIsSendingPhoneCode(true);
      const response = await requestPhoneVerificationOtp();
      setPhoneCodeRequested(true);
      if (response?.devCode) {
        setPhoneCodeHint(`Dev OTP: ${response.devCode}`);
      } else {
        setPhoneCodeHint(null);
      }
      toast.success(response?.message || "Verification code sent");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send verification code");
    } finally {
      setIsSendingPhoneCode(false);
    }
  };

  const handleConfirmPhoneCode = async () => {
    const normalizedCode = phoneVerificationCode.trim();
    if (!normalizedCode) {
      toast.error("Enter the verification code");
      return;
    }
    try {
      setIsConfirmingPhoneCode(true);
      await confirmPhoneVerificationOtp({ code: normalizedCode });
      toast.success("Phone verified successfully");
      await reloadVerificationStatus();
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify phone");
    } finally {
      setIsConfirmingPhoneCode(false);
    }
  };

  const handleUploadIdentityDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadIdentityDocument(file);
      toast.success("Identity document uploaded successfully");
      // Reload verification status
      await reloadVerificationStatus();
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload identity document");
    }
  };

  const handleUploadAddressDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAddressDocument(file);
      toast.success("Address document uploaded successfully");
      // Reload verification status
      await reloadVerificationStatus();
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload address document");
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-[16px]">
        <div className="px-6 pt-6">
          <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-4">
            {visibleMainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleMainTabChange(tab.id)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#1C4D8D]/[0.06] text-[#1C4D8D]"
                    : "text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "account" && (
          <div className="p-6">
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {visibleAccountTabs.map((subTab) => (
                  <button
                    key={subTab.id}
                    onClick={() => handleAccountTabChange(subTab.id)}
                    className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                      accountTab === subTab.id
                        ? "bg-[#1C4D8D]/[0.06] text-[#1C4D8D]"
                        : "text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>
            </div>

            {accountTab === "personal" && (
              <div className="space-y-6">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[#111827]">
                          {isEmployerRole ? "Business Information" : "Personal Information"}
                        </h2>
                        <p className="text-[13px] text-[#6B7280]">
                          Update your {isEmployerRole ? "employer profile" : "profile information"}.
                        </p>
                        {isProfileLoading && (
                          <p className="text-[12px] text-[#6B7280] mt-1">Loading profile...</p>
                        )}
                      </div>

                      {isEmployerRole && (
                        <div className="border border-[#1C4D8D]/20 bg-[#F8FBFF] rounded-[14px] p-4">
                          <div className="flex items-center gap-4">
                            {resolvedAvatarUrl ? (
                              <img
                                src={resolvedAvatarUrl}
                                alt="Employer profile"
                                className="w-14 h-14 rounded-[12px] object-cover border border-[#1C4D8D]/20"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-[12px] bg-[#1C4D8D]/10 text-[#1C4D8D] flex items-center justify-center font-bold text-[20px] border border-[#1C4D8D]/20">
                                {(personalInfo.companyName || personalInfo.firstName || "E").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-[12px] uppercase tracking-wide text-[#64748B]">Employer Profile</p>
                              <p className="text-[16px] font-semibold text-[#0F172A]">{personalInfo.companyName || `${personalInfo.firstName} ${personalInfo.lastName}`}</p>
                              <p className="text-[13px] text-[#475569]">{[personalInfo.city, personalInfo.province].filter(Boolean).join(", ") || "Add company location"}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="settings-first-name" className="text-[14px] font-medium text-[#475569] mb-2 block">First name</label>
                          <input
                            id="settings-first-name"
                            type="text"
                            value={personalInfo.firstName}
                            onChange={(e) => handlePersonalInfoChange("firstName", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label htmlFor="settings-last-name" className="text-[14px] font-medium text-[#475569] mb-2 block">Last name</label>
                          <input
                            id="settings-last-name"
                            type="text"
                            value={personalInfo.lastName}
                            onChange={(e) => handlePersonalInfoChange("lastName", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      {isEmployerRole && (
                        <div>
                          <label htmlFor="settings-company-name" className="text-[14px] font-medium text-[#475569] mb-2 block">Company name</label>
                          <input
                            id="settings-company-name"
                            type="text"
                            value={personalInfo.companyName}
                            onChange={(e) => handlePersonalInfoChange("companyName", e.target.value)}
                            placeholder="Enter your company name"
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          />
                        </div>
                      )}

                      {!isAdminRole ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <label htmlFor="settings-employer-city" className="text-[14px] font-medium text-[#475569] mb-2 block">City</label>
                              <select
                                id="settings-employer-city"
                                value={personalInfo.city}
                                onChange={(e) => handlePersonalInfoChange("city", e.target.value)}
                                disabled={isLoadingLocationData}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="">{isLoadingLocationData ? "Loading cities..." : "Select city/municipality"}</option>
                                {filteredCityOptions.map((city) => (
                                  <option key={city.code} value={city.name}>
                                    {city.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="settings-employer-province" className="text-[14px] font-medium text-[#475569] mb-2 block">Province</label>
                              <select
                                id="settings-employer-province"
                                value={personalInfo.province}
                                onChange={(e) => handlePersonalInfoChange("province", e.target.value)}
                                disabled={isLoadingLocationData}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="">{isLoadingLocationData ? "Loading provinces..." : "Select province"}</option>
                                {provinceOptions.map((province) => (
                                  <option key={province.code} value={province.name}>
                                    {province.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="settings-employer-barangay" className="text-[14px] font-medium text-[#475569] mb-2 block">Barangay</label>
                              <select
                                id="settings-employer-barangay"
                                value={personalInfo.barangay}
                                onChange={(e) => handlePersonalInfoChange("barangay", e.target.value)}
                                disabled={isLoadingBarangays || !personalInfo.city}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="">
                                  {!personalInfo.city
                                    ? "Select city first"
                                    : isLoadingBarangays
                                    ? "Loading barangays..."
                                    : "Select barangay"}
                                </option>
                                {barangayOptions.map((barangay) => (
                                  <option key={barangay.code} value={barangay.name}>
                                    {barangay.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="settings-location-type" className="text-[14px] font-medium text-[#475569] mb-2 block">Location type</label>
                              <select
                                id="settings-location-type"
                                value={personalInfo.addressType}
                                onChange={(e) => handlePersonalInfoChange("addressType", e.target.value)}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="home">Home address</option>
                                <option value="office">Office / Business address</option>
                                <option value="place">Landmark / Place</option>
                              </select>
                            </div>
                            <div>
                              <label htmlFor="settings-address" className="text-[14px] font-medium text-[#475569] mb-2 block">Address / Place</label>
                              <input
                                id="settings-address"
                                type="text"
                                list="settings-address-options"
                                value={personalInfo.address}
                                onChange={(e) => handlePersonalInfoChange("address", e.target.value)}
                                placeholder={personalInfo.addressType === "place" ? "e.g., Near City Hall" : "House no., street, subdivision"}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              />
                            </div>
                          </div>

                          <datalist id="settings-address-options">
                            {addressSuggestions.map((item) => (
                              <option key={item} value={item} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <div>
                          <label htmlFor="settings-worker-city" className="text-[14px] font-medium text-[#475569] mb-2 block">City</label>
                          <select
                            id="settings-worker-city"
                            value={personalInfo.city}
                            onChange={(e) => handlePersonalInfoChange("city", e.target.value)}
                            disabled={isLoadingLocationData}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          >
                            <option value="">{isLoadingLocationData ? "Loading cities..." : "Select city/municipality"}</option>
                            {cityOptions.map((city) => (
                              <option key={city.code} value={city.name}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {!isAdminRole && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="settings-phone" className="text-[14px] font-medium text-[#475569] mb-2 block">Phone number</label>
                            <input
                              id="settings-phone"
                              type="tel"
                              value={personalInfo.phone}
                              onChange={(e) => handlePersonalInfoChange("phone", e.target.value)}
                              placeholder="e.g., 0917 123 4567"
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label htmlFor="settings-employer-email" className="text-[14px] font-medium text-[#475569] mb-2 block">Email</label>
                            <input
                              id="settings-employer-email"
                              type="email"
                              value={personalInfo.email}
                              disabled
                              className="w-full bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#94A3B8] outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {isAdminRole && (
                        <div>
                          <label htmlFor="settings-worker-email" className="text-[14px] font-medium text-[#475569] mb-2 block">Email</label>
                          <input
                            id="settings-worker-email"
                            type="email"
                            value={personalInfo.email}
                            disabled
                            className="w-full bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#94A3B8] outline-none"
                          />
                        </div>
                      )}

                      {!isAdminRole && (
                        <>
                          <div>
                            <label htmlFor="settings-about" className="text-[14px] font-medium text-[#475569] mb-2 block">About Me</label>
                            <textarea
                              id="settings-about"
                              value={personalInfo.about}
                              onChange={(e) => handlePersonalInfoChange("about", e.target.value)}
                              placeholder="Tell us about yourself, your experience, and what you're passionate about..."
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all resize-none"
                              rows={4}
                            />
                          </div>

                          <div>
                            <label htmlFor="settings-experience" className="text-[14px] font-medium text-[#475569] mb-2 block">Total Experience</label>
                            <select
                              id="settings-experience"
                              value={experienceStats.totalExperience}
                              onChange={(e) => setExperienceStats({ ...experienceStats, totalExperience: e.target.value })}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                            >
                              <option value="">Select experience</option>
                              <option value="Less than 1 Year">Less than 1 Year</option>
                              <option value="1 Year">1 Year</option>
                              <option value="2 Years">2 Years</option>
                              <option value="3 Years">3 Years</option>
                              <option value="4 Years">4 Years</option>
                              <option value="5 Years">5 Years</option>
                              <option value="6 Years">6 Years</option>
                              <option value="7 Years">7 Years</option>
                              <option value="8 Years">8 Years</option>
                              <option value="9 Years">9 Years</option>
                              <option value="10+ Years">10+ Years</option>
                            </select>
                          </div>

                          <div>
                            <p className="text-[14px] font-medium text-[#475569] mb-2 block">Profile photo</p>
                            {resolvedAvatarUrl ? (
                              <div className="flex items-center gap-4">
                                <img
                                  src={resolvedAvatarUrl}
                                  alt="Profile"
                                  className="w-24 h-24 rounded-[12px] object-cover border-2 border-[#E5E7EB]"
                                />
                                <div className="flex flex-col gap-2">
                                  <label className="bg-[#1C4D8D] text-white font-semibold px-6 py-2 rounded-[10px] hover:opacity-90 transition-all cursor-pointer flex items-center gap-2 text-[14px]">
                                    <Upload className="w-4 h-4" />
                                    Change photo
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handlePhotoUpload}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    onClick={handleDeletePhoto}
                                    className="text-[#EF4444] hover:bg-[#FEE2E2] px-6 py-2 rounded-[10px] transition-all text-[14px] font-medium border border-[#FCA5A5]"
                                  >
                                    Remove photo
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="bg-[#1C4D8D] text-white font-semibold px-6 py-3 rounded-[10px] hover:opacity-90 transition-all cursor-pointer flex items-center gap-2">
                                  <Upload className="w-4 h-4" />
                                  Upload your photo
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                  />
                                </label>
                                <span className="text-[13px] text-[#64748B]">(jpg/png format)</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <button
                        onClick={handleSavePersonalInfo}
                        disabled={isProfileSaving}
                        className={`bg-[#1C4D8D] text-white font-semibold px-8 py-3 rounded-[10px] transition-all ${
                          isProfileSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
                        }`}
                      >
                        {isProfileSaving ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  )}

                  {accountTab === "experience" && !isEmployerRole && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[#111827]">Skills & Experience</h2>
                        <p className="text-[13px] text-[#6B7280]">Add and manage your skills and expertise.</p>
                      </div>

                      {/* Experience Stats Section - Read Only Display */}
                      <div className="bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border border-[#86efac] rounded-[16px] p-6">
                        <h3 className="text-[16px] font-semibold text-[#1e293b] mb-4">📊 Experience Statistics</h3>
                        <p className="text-[13px] text-[#64748b] mb-4">These stats are automatically calculated from your job applications. Set your Total Experience in Personal Information.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="flex items-center gap-3 bg-white rounded-[10px] px-4 py-3 border border-[#86efac]">
                              <div className="w-10 h-10 rounded-[10px] bg-[#dcfce7] flex items-center justify-center">
                                <span className="text-[20px]">✅</span>
                              </div>
                              <div>
                                <p className="text-[12px] text-[#64748b]">Jobs Completed</p>
                                <p className="text-[20px] font-bold text-[#16a34a]">{experienceStats.projectsCompleted}</p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 bg-white rounded-[10px] px-4 py-3 border border-[#86efac]">
                              <div className="w-10 h-10 rounded-[10px] bg-[#1C4D8D]/10 flex items-center justify-center">
                                <span className="text-[20px]">📝</span>
                              </div>
                              <div>
                                <p className="text-[12px] text-[#64748b]">Jobs Applied</p>
                                <p className="text-[20px] font-bold text-[#1C4D8D]">{experienceStats.jobsApplied}</p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 bg-white rounded-[10px] px-4 py-3 border border-[#86efac]">
                              <div className="w-10 h-10 rounded-[10px] bg-[#fef3c7] flex items-center justify-center">
                                <span className="text-[20px]">📈</span>
                              </div>
                              <div>
                                <p className="text-[12px] text-[#64748b]">Success Rate</p>
                                <p className="text-[20px] font-bold text-[#f59e0b]">{experienceStats.successRate}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#1C4D8D]/[0.08] border border-[#1C4D8D]/20 rounded-[16px] p-6">
                        <h3 className="text-[16px] font-semibold text-[#1e293b] mb-4">Add New Skill</h3>
                        <div className="space-y-4">
                          {/* Skill Selection Mode */}
                          <div>
                            <p className="text-[14px] font-medium text-[#475569] mb-2 block">Choose Option</p>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="skillMode"
                                  checked={skillSelectionMode === "predefined"}
                                  onChange={() => setSkillSelectionMode("predefined")}
                                  className="w-4 h-4 text-[#1C4D8D]"
                                />
                                <span className="text-[14px] text-[#475569]">Select from list</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="skillMode"
                                  checked={skillSelectionMode === "custom"}
                                  onChange={() => setSkillSelectionMode("custom")}
                                  className="w-4 h-4 text-[#1C4D8D]"
                                />
                                <span className="text-[14px] text-[#475569]">Custom skill</span>
                              </label>
                            </div>
                          </div>

                          {/* Skill Name Input */}
                          <div>
                            <p id="settings-skill-name-label" className="text-[14px] font-medium text-[#475569] mb-2 block">Skill Name</p>
                            {skillSelectionMode === "predefined" ? (
                              <select
                                aria-labelledby="settings-skill-name-label"
                                value={selectedPredefinedSkill}
                                onChange={(e) => setSelectedPredefinedSkill(e.target.value)}
                                className="w-full bg-white border border-[#1C4D8D]/20 rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="">Select a skill</option>
                                <optgroup label="Household & Cleaning">
                                  <option value="House Cleaning">House Cleaning</option>
                                  <option value="Window Cleaning">Window Cleaning</option>
                                  <option value="Laundry Service">Laundry Service</option>
                                  <option value="Ironing">Ironing</option>
                                  <option value="Kitchen Cleaning">Kitchen Cleaning</option>
                                  <option value="Bathroom Cleaning">Bathroom Cleaning</option>
                                </optgroup>
                                <optgroup label="Gardening & Landscaping">
                                  <option value="Gardening">Gardening</option>
                                  <option value="Lawn Mowing">Lawn Mowing</option>
                                  <option value="Landscaping">Landscaping</option>
                                  <option value="Plant Care">Plant Care</option>
                                  <option value="Weeding">Weeding</option>
                                  <option value="Hedge Trimming">Hedge Trimming</option>
                                </optgroup>
                                <optgroup label="Shopping & Delivery">
                                  <option value="Shopping">Shopping</option>
                                  <option value="Grocery Shopping">Grocery Shopping</option>
                                  <option value="Delivery Service">Delivery Service</option>
                                  <option value="Errand Running">Errand Running</option>
                                  <option value="Package Pickup">Package Pickup</option>
                                </optgroup>
                                <optgroup label="Academic & Tutoring">
                                  <option value="Tutoring">Tutoring</option>
                                  <option value="Math Tutoring">Math Tutoring</option>
                                  <option value="English Tutoring">English Tutoring</option>
                                  <option value="Language Tutoring">Language Tutoring</option>
                                  <option value="Science Tutoring">Science Tutoring</option>
                                  <option value="Homework Help">Homework Help</option>
                                  <option value="Test Preparation">Test Preparation</option>
                                </optgroup>
                                <optgroup label="Languages & Translation">
                                  <option value="English Speaking">English Speaking</option>
                                  <option value="Translation Service">Translation Service</option>
                                  <option value="Language Coaching">Language Coaching</option>
                                  <option value="Pronunciation Training">Pronunciation Training</option>
                                </optgroup>
                                <optgroup label="Fitness & Wellness">
                                  <option value="Personal Training">Personal Training</option>
                                  <option value="Yoga Instruction">Yoga Instruction</option>
                                  <option value="Fitness Coaching">Fitness Coaching</option>
                                  <option value="Walking Companion">Walking Companion</option>
                                </optgroup>
                                <optgroup label="Pet Care">
                                  <option value="Dog Walking">Dog Walking</option>
                                  <option value="Pet Sitting">Pet Sitting</option>
                                  <option value="Pet Grooming">Pet Grooming</option>
                                  <option value="Pet Training">Pet Training</option>
                                </optgroup>
                                <optgroup label="Handyman & Repairs">
                                  <option value="Handyman Services">Handyman Services</option>
                                  <option value="Painting">Painting</option>
                                  <option value="Carpentry">Carpentry</option>
                                  <option value="Plumbing Assistance">Plumbing Assistance</option>
                                  <option value="Furniture Assembly">Furniture Assembly</option>
                                  <option value="Electrical Assistance">Electrical Assistance</option>
                                </optgroup>
                                <optgroup label="Cooking & Food">
                                  <option value="Meal Preparation">Meal Preparation</option>
                                  <option value="Cooking">Cooking</option>
                                  <option value="Baking">Baking</option>
                                  <option value="Food Delivery">Food Delivery</option>
                                  <option value="Kitchen Help">Kitchen Help</option>
                                </optgroup>
                                <optgroup label="Childcare & Babysitting">
                                  <option value="Babysitting">Babysitting</option>
                                  <option value="Childcare">Childcare</option>
                                  <option value="After-School Care">After-School Care</option>
                                  <option value="Tutoring Kids">Tutoring Kids</option>
                                </optgroup>
                                <optgroup label="Administrative & Technical">
                                  <option value="Data Entry">Data Entry</option>
                                  <option value="Virtual Assistant">Virtual Assistant</option>
                                  <option value="Typing Services">Typing Services</option>
                                  <option value="Transcription">Transcription</option>
                                  <option value="Email Management">Email Management</option>
                                </optgroup>
                                <optgroup label="Creative Services">
                                  <option value="Social Media Management">Social Media Management</option>
                                  <option value="Photography">Photography</option>
                                  <option value="Graphic Design">Graphic Design</option>
                                  <option value="Content Writing">Content Writing</option>
                                  <option value="Video Editing">Video Editing</option>
                                </optgroup>
                                <optgroup label="Moving & Heavy Lifting">
                                  <option value="Moving Help">Moving Help</option>
                                  <option value="Heavy Lifting">Heavy Lifting</option>
                                  <option value="Packing Service">Packing Service</option>
                                </optgroup>
                                <optgroup label="Event Services">
                                  <option value="Event Setup">Event Setup</option>
                                  <option value="Event Planning">Event Planning</option>
                                  <option value="Party Hosting Assistance">Party Hosting Assistance</option>
                                  <option value="Decoration">Decoration</option>
                                </optgroup>
                              </select>
                            ) : (
                              <input
                                aria-labelledby="settings-skill-name-label"
                                type="text"
                                value={newSkillName}
                                onChange={(e) => setNewSkillName(e.target.value)}
                                placeholder="e.g., Flutter, Blockchain, Video Editing"
                                className="w-full bg-white border border-[#1C4D8D]/20 rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                                onKeyPress={(e) => e.key === "Enter" && handleAddSkill()}
                              />
                            )}
                          </div>

                          <div>
                            <label htmlFor="settings-skill-description" className="text-[14px] font-medium text-[#475569] mb-2 block">Description or experience note</label>
                            <textarea
                              id="settings-skill-description"
                              value={newSkillDescription}
                              onChange={(e) => setNewSkillDescription(e.target.value)}
                              placeholder="Optional: describe what you can do or your experience with this skill"
                              className="w-full bg-white border border-[#1C4D8D]/20 rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all resize-none"
                              rows={3}
                            />
                          </div>

                          <button
                            onClick={handleAddSkill}
                            className="w-full bg-[#1C4D8D] text-white font-semibold py-2.5 px-4 rounded-[10px] hover:opacity-90 transition-all"
                          >
                            Add Skill
                          </button>
                        </div>
                      </div>

                      {skills.length > 0 ? (
                        <div>
                          <h3 className="text-[14px] font-semibold text-[#111827] mb-3">Your Skills</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {skills.map((skill) => (
                              <div
                                key={skill.id}
                                className="bg-white border border-[#E5E7EB] rounded-[10px] p-4 flex items-start justify-between hover:shadow-md transition-all"
                              >
                                <div className="flex-1">
                                  <p className="text-[14px] font-semibold text-[#111827]">{skill.name}</p>
                                  {editingSkillId === skill.id ? (
                                    <div className="mt-3 space-y-3">
                                      <textarea
                                        value={editingSkillDescription}
                                        onChange={(e) => setEditingSkillDescription(e.target.value)}
                                        placeholder="Describe your experience with this skill"
                                        className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] text-[#111827] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all resize-none"
                                        rows={3}
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleEditSkillDescription(skill.id)}
                                          className="bg-[#1C4D8D] text-white text-[12px] font-semibold px-3 py-2 rounded-[8px] hover:opacity-90 transition-all"
                                        >
                                          Save note
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingSkillId(null);
                                            setEditingSkillDescription("");
                                          }}
                                          className="bg-[#F3F4F6] text-[#374151] text-[12px] font-semibold px-3 py-2 rounded-[8px] hover:bg-[#E5E7EB] transition-all"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="mt-2 text-[13px] text-[#64748B]">
                                        {skill.description?.trim() || "No description added"}
                                      </p>
                                      <div className="flex items-center gap-2 mt-3">
                                        <button
                                          onClick={() => {
                                            setEditingSkillId(skill.id);
                                            setEditingSkillDescription(skill.description || "");
                                          }}
                                          className="text-[12px] font-semibold text-[#1C4D8D] hover:opacity-80"
                                        >
                                          Edit description
                                        </button>
                                        {skill.endorsements ? (
                                          <span className="text-[12px] text-[#64748B]">{skill.endorsements} endorsements</span>
                                        ) : null}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteSkill(skill.id)}
                                  className="text-[#EF4444] hover:bg-[#FEE2E2] p-2 rounded-[8px] transition-colors flex-shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-[#f8fafc] rounded-[16px] border border-[#E5E7EB]">
                          <p className="text-[14px] text-[#64748B] mb-2">No skills added yet</p>
                          <p className="text-[12px] text-[#94A3B8]">Add your skills above to showcase your expertise</p>
                        </div>
                      )}
                    </div>
                  )}

                  {accountTab === "resume" && !isEmployerRole && (
                    <WorkerResumeSection initialResumeUrl={resumeUrl} />
                  )}
                </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-6">
              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <div className="mb-6">
                  <h2 className="text-[20px] font-semibold text-[#111827]">Change Password</h2>
                  <p className="text-[13px] text-[#6B7280]">
                    Changing your password will log you out of all active sessions.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="settings-current-password" className="text-[13px] text-[#6B7280]">Current Password</label>
                    <div className="relative">
                      <input
                        id="settings-current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                        className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-[12px] text-[#475569]">
                    Request OTP first. You will need the OTP from your email before setting a new password.
                  </div>

                  <div>
                    <button
                      onClick={handleRequestPasswordOtp}
                      disabled={isOtpSending}
                      className="px-5 py-2.5 bg-[#0F766E] text-white rounded-full text-[13px] font-semibold disabled:opacity-60"
                    >
                      {isOtpSending ? "Sending OTP..." : passwordOtpRequested ? "Resend OTP" : "Send OTP"}
                    </button>
                  </div>

                  <div>
                    <label htmlFor="settings-password-otp" className="text-[13px] text-[#6B7280]">OTP Code</label>
                    <input
                      id="settings-password-otp"
                      type="text"
                      value={passwordOtp}
                      onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-new-password" className="text-[13px] text-[#6B7280]">New Password</label>
                      <div className="relative">
                        <input
                          id="settings-new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={securityData.newPassword}
                          onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                          className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="settings-confirm-password" className="text-[13px] text-[#6B7280]">Confirm Password</label>
                      <div className="relative">
                        <input
                          id="settings-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={securityData.confirmPassword}
                          onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                          className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                  <button
                    onClick={handleDiscardPassword}
                    className="px-6 py-2.5 border border-[#E5E7EB] text-[#64748B] rounded-full text-[14px]"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={isPasswordSubmitting}
                    className="px-6 py-2.5 bg-[#1C4D8D] text-white rounded-full text-[14px] font-semibold disabled:opacity-60"
                  >
                    {isPasswordSubmitting ? "Saving..." : "Save New Password"}
                  </button>
                </div>
              </div>

              <MfaSettingsCard />

              {isEmployerRole && <EmployerPrivacyCard initialValue={hideHiredCandidates} />}

              <DeleteAccountCard />

              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[16px] font-semibold text-[#111827]">Active Sessions</h3>
                  {sessions.length > 0 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      className="text-[#EF4444] hover:bg-[#FEE2E2] px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors"
                    >
                      Delete All
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-[#6B7280] mb-4">
                  See your currently logged in sessions and remove unrecognized ones.
                </p>
                <div className="space-y-4">
                  {isLoadingSessions ? (
                    <p className="text-[13px] text-[#6B7280]">Loading sessions...</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-[13px] text-[#6B7280]">No active sessions found.</p>
                  ) : (
                    sessions.map((session, index) => (
                      <div key={session.id} className="border border-[#E5E7EB] rounded-[12px] p-4">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-[13px] font-semibold text-[#111827]">Session {index + 1}</p>
                          {!session.current && (
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              className="text-[#EF4444] hover:bg-[#FEE2E2] px-3 py-1 rounded-[8px] text-[12px] font-medium transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[12px] text-[#6B7280]">Current Session?</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.current ? "Yes" : "No"}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">Device Details</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.device}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">IP Address</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.ip}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">Location</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.location}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">Last activity</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.lastActive}</p>
                          </div>
                          <div className="flex items-end">
                            <span
                              className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
                                session.current ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#E2E8F0] text-[#475569]"
                              }`}
                            >
                              {session.current ? "Current session" : "Signed in"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {!isAdminRole && (
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                  <h3 className="text-[16px] font-semibold text-[#111827] mb-2">Verification</h3>
                  <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[12px] p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[14px] text-[#64748B]">Verification status</p>
                        <h4 className="text-[18px] font-semibold text-[#111827]">Profile verified</h4>
                        <p className="text-[12px] text-[#64748B] mt-1">All requirements completed.</p>
                      </div>
                      <span className="text-[12px] font-semibold px-3 py-1 rounded-full bg-[#DCFCE7] text-[#166534]">
                        {verificationCompletionPercent}% complete
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div className="h-full bg-[#22C55E]" style={{ width: `${verificationCompletionPercent}%` }} />
                      </div>
                      <p className="text-[12px] text-[#64748B] mt-2">
                        {completedSteps} of {verificationStepsData.length} steps completed
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {isLoadingVerification ? (
                      <p className="text-[13px] text-[#6B7280]">Loading verification status...</p>
                    ) : (
                      verificationStepsData.map((step) => {
                      const statusBadge = verificationStatusStyles[step.status];
                      const statusLabel = verificationStatusLabels[step.status];
                      const iconBg =
                        step.status === "complete" ? "bg-[#DCFCE7]" : step.status === "in-review" ? "bg-[#FEF3C7]" : "bg-[#E2E8F0]";
                      const icon =
                        step.status === "complete" ? (
                          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                        ) : step.status === "in-review" ? (
                          <Clock className="w-5 h-5 text-[#D97706]" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#94A3B8]" />
                        );

                      return (
                        <div key={step.id} className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
                                {icon}
                              </div>
                              <div className="flex-1">
                                <p className="text-[15px] font-semibold text-[#1E293B]">{step.title}</p>
                                <p className="text-[13px] text-[#64748B] mt-1">{step.description}</p>

                                {/* Action buttons based on verification type and status */}
                                {step.id === "phone" && step.status !== "complete" && (
                                  <div className="mt-2 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        onClick={handleRequestPhoneCode}
                                        disabled={isSendingPhoneCode}
                                        className="px-4 py-2 bg-[#1C4D8D] text-white text-[12px] rounded-[8px] hover:opacity-90 disabled:opacity-60"
                                      >
                                        {isSendingPhoneCode
                                          ? "Sending..."
                                          : phoneCodeRequested
                                            ? "Resend code"
                                            : "Send verification code"}
                                      </button>
                                      {phoneCodeHint && (
                                        <span className="text-[12px] text-[#475569]">{phoneCodeHint}</span>
                                      )}
                                    </div>
                                    {phoneCodeRequested && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          maxLength={6}
                                          value={phoneVerificationCode}
                                          onChange={(event) =>
                                            setPhoneVerificationCode(
                                              event.target.value.replace(/[^\d]/g, "").slice(0, 6)
                                            )
                                          }
                                          placeholder="Enter 6-digit code"
                                          className="w-[180px] bg-white border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[12px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                                        />
                                        <button
                                          onClick={handleConfirmPhoneCode}
                                          disabled={isConfirmingPhoneCode}
                                          className="px-4 py-2 border border-[#1C4D8D] text-[#1C4D8D] text-[12px] font-semibold rounded-[8px] hover:opacity-90/[0.06] disabled:opacity-60"
                                        >
                                          {isConfirmingPhoneCode ? "Verifying..." : "Confirm code"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {step.id === "identity" && step.status === "pending" && (
                                  <label className="mt-2 inline-block px-4 py-2 bg-[#1C4D8D] text-white text-[12px] rounded-[8px] hover:opacity-90 cursor-pointer">
                                    Upload ID
                                    <input
                                      type="file"
                                      accept="image/*,.pdf"
                                      onChange={handleUploadIdentityDocument}
                                      className="hidden"
                                    />
                                  </label>
                                )}

                                {step.id === "address" && step.status === "pending" && (
                                  <label className="mt-2 inline-block px-4 py-2 bg-[#1C4D8D] text-white text-[12px] rounded-[8px] hover:opacity-90 cursor-pointer">
                                    Upload Document
                                    <input
                                      type="file"
                                      accept="image/*,.pdf"
                                      onChange={handleUploadAddressDocument}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                            <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${statusBadge} whitespace-nowrap`}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "payments" && isEmployerRole && <EmployerPaymentMethodsSection />}

      </div>
    </div>
  );
}
