import { useEffect, useState } from "react";
import { Eye, EyeOff, Upload, Trash2, CheckCircle2, Clock, Circle, Download } from "lucide-react";
import { toast } from "../lib/toast";
import { useSearchParams } from "react-router-dom";
import {
  getProfile,
  updateProfile,
  uploadResume,
  deleteResume,
  uploadAvatar,
  deleteAvatar,
  requestPasswordChangeOtp,
  confirmPasswordChangeWithOtp,
  getSessions,
  revokeSession,
  revokeAllSessions,
  cleanupInactiveSessions,
  getVerificationStatus,
  verifyPhone,
  uploadIdentityDocument,
  uploadAddressDocument,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";

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
  { id: "privacy", label: "Privacy" },
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

interface SkillItem {
  id: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  endorsements?: number;
}

interface PaymentMethod {
  id: string;
  brand: "Visa" | "Mastercard" | "Card";
  last4: string;
  expiry: string;
  status: "default" | "active" | "expired";
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
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "sms" | "email">("authenticator");
  const [mfaSetupKey, setMfaSetupKey] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
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
    address: "",
    phone: "+63 912 345 6789",
    email: "jonas.delacruz@email.com",
    linkedin: "linkedin.com/in/jonasdelacruz",
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
  const [skillSelectionMode, setSkillSelectionMode] = useState<"predefined" | "custom">("predefined");
  const [selectedPredefinedSkill, setSelectedPredefinedSkill] = useState("");

  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpRequested, setPasswordOtpRequested] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  const [resume, setResume] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const resolvedAvatarUrl = toAbsoluteAssetUrl(avatarUrl);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: "visa-1", brand: "Visa", last4: "1234", expiry: "01/26", status: "default" },
    { id: "mc-1", brand: "Mastercard", last4: "1234", expiry: "01/26", status: "active" },
    { id: "mc-2", brand: "Mastercard", last4: "1234", expiry: "01/26", status: "expired" },
  ]);

  const [newCard, setNewCard] = useState({
    name: "",
    number: "",
    expiry: "",
    cvv: "",
  });

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const [verificationStepsData, setVerificationStepsData] = useState<VerificationStep[]>([]);
  const [verificationCompletionPercent, setVerificationCompletionPercent] = useState(0);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);

  const completedSteps = verificationStepsData.filter((step) => step.status === "complete").length;

  const visibleMainTabs = isAdminRole
    ? mainTabConfig.filter((tab) => tab.id !== "payments")
    : mainTabConfig;

  const visibleAccountTabs = isAdminRole || isEmployerRole
    ? accountTabConfig.filter((tab) => tab.id === "personal")
    : accountTabConfig;

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
        
        console.log("Loaded sessions:", sessionsData); // Debug log
        
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
        const response = await getVerificationStatus();
        setVerificationStepsData(response?.steps || []);
        setVerificationCompletionPercent(response?.completionPercent || 0);
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
    setPersonalInfo({ ...personalInfo, [field]: value });
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
      address: (user as any).address || prev.address,
      linkedin: user.linkedin || prev.linkedin,
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
          address: profile.address || prev.address,
          linkedin: profile.linkedin || prev.linkedin,
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
        const normalizedAvatarUrl: string | undefined = toAbsoluteAssetUrl(profile.avatarUrl) || undefined;
        updateAuthProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          city: profile.city,
          linkedin: profile.linkedin,
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
  }, []);

  const handleSavePersonalInfo = async () => {
    setIsProfileSaving(true);
    try {
      const profilePayload: Record<string, string> = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        companyName: personalInfo.companyName,
        city: personalInfo.city,
        province: personalInfo.province,
        address: personalInfo.address,
      };
      if (!isAdminRole) {
        profilePayload.phoneNumber = personalInfo.phone;
        profilePayload.linkedin = personalInfo.linkedin;
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
        linkedin: updated.linkedin,
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
    
    if (!skillName) {
      toast.error("Please select or enter a skill name");
      return;
    }
    try {
      const response = await fetch("/api/auth/profile/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token") || localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: skillName,
        }),
      });
      if (!response.ok) throw new Error("Failed to add skill");
      const data = await response.json();
      const mappedSkills = (data.data?.skills || []).map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || "",
      })) as SkillItem[];
      setSkills(mappedSkills);
      updateAuthProfile({ skills: mappedSkills });
      setNewSkillName("");
      setSelectedPredefinedSkill("");
      setSkillSelectionMode("predefined");
      toast.success(`${skillName} added to your skills!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add skill");
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      const response = await fetch(`/api/auth/profile/skills/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token") || localStorage.getItem("token")}`,
        },
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

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadResume(file);
      setResumeUrl(response?.data?.resumeUrl || null);
      setResume(file);
      toast.success("Resume uploaded successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload resume");
    }
  };

  const handleDeleteResume = async () => {
    try {
      await deleteResume();
      setResume(null);
      setResumeUrl(null);
      toast.success("Resume deleted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete resume");
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!securityData.currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await requestPasswordChangeOtp({ currentPassword: securityData.currentPassword });
      setPasswordOtpRequested(true);
      toast.success("OTP sent to your email");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send OTP");
    } finally {
      setIsPasswordSubmitting(false);
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

  const generateMfaSetupKey = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const group = () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `${group()}-${group()}-${group()}-${group()}`;
  };

  const generateBackupCodes = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const makeCode = () =>
      `${Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")}-${Array.from(
        { length: 4 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("")}`;
    const codes = Array.from({ length: 8 }, makeCode);
    setBackupCodes(codes);
    setShowBackupCodes(true);
    toast.success("Backup codes generated");
  };

  const handleToggleMfa = () => {
    if (mfaEnabled) {
      setMfaEnabled(false);
      setMfaSetupKey(null);
      setBackupCodes([]);
      setShowBackupCodes(false);
      toast.info("Two-factor authentication disabled");
      return;
    }
    setMfaEnabled(true);
    setMfaSetupKey(generateMfaSetupKey());
    toast.success("Two-factor authentication enabled");
  };

  const handleSendTestCode = () => {
    if (mfaMethod === "authenticator") {
      toast.info("Open your authenticator app and add the setup key.");
      return;
    }
    if (mfaMethod === "sms") {
      toast.info("Test code sent to your phone.");
      return;
    }
    toast.info("Test code sent to your email.");
  };

  const getBrand = (number: string): PaymentMethod["brand"] => {
    const trimmed = number.replace(/\s+/g, "");
    if (trimmed.startsWith("4")) return "Visa";
    if (trimmed.startsWith("5")) return "Mastercard";
    return "Card";
  };

  const handleAddCard = () => {
    if (!newCard.name || !newCard.number || !newCard.expiry || !newCard.cvv) {
      toast.error("Please fill in all card fields");
      return;
    }
    const last4 = newCard.number.replace(/\s+/g, "").slice(-4);
    const method: PaymentMethod = {
      id: Date.now().toString(),
      brand: getBrand(newCard.number),
      last4,
      expiry: newCard.expiry,
      status: "active",
    };
    setPaymentMethods([method, ...paymentMethods]);
    setNewCard({ name: "", number: "", expiry: "", cvv: "" });
    toast.success("Payment method added");
  };

  const handleSetDefault = (id: string) => {
    setPaymentMethods(
      paymentMethods.map((method) => ({
        ...method,
        status: method.id === id ? "default" : method.status === "expired" ? "expired" : "active",
      })),
    );
    toast.success("Default payment method updated");
  };

  const handleRemoveCard = (id: string) => {
    setPaymentMethods(paymentMethods.filter((method) => method.id !== id));
    toast.success("Payment method removed");
  };

  const handleDeleteAccount = () => {
    toast.error("Account deletion request submitted");
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

  const handleVerifyPhone = async () => {
    try {
      await verifyPhone();
      toast.success("Phone verified successfully");
      // Reload verification status
      const response = await getVerificationStatus();
      setVerificationStepsData(response?.steps || []);
      setVerificationCompletionPercent(response?.completionPercent || 0);
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify phone");
    }
  };

  const handleUploadIdentityDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadIdentityDocument(file);
      toast.success("Identity document uploaded successfully");
      // Reload verification status
      const response = await getVerificationStatus();
      setVerificationStepsData(response?.steps || []);
      setVerificationCompletionPercent(response?.completionPercent || 0);
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
      const response = await getVerificationStatus();
      setVerificationStepsData(response?.steps || []);
      setVerificationCompletionPercent(response?.completionPercent || 0);
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
                    ? "bg-[#EEF2FF] text-[#1D4ED8]"
                    : "text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <section className="p-6 space-y-6">
          {activeTab === "account" && (
            <div className="space-y-6">
              <div className="bg-white rounded-[16px] border border-[#E5E7EB]">
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-4 mb-6">
                    {visibleAccountTabs.map((subTab) => (
                      <button
                        key={subTab.id}
                        onClick={() => handleAccountTabChange(subTab.id)}
                        className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                          accountTab === subTab.id
                            ? "bg-[#EEF2FF] text-[#1D4ED8]"
                            : "text-[#64748B] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        {subTab.label}
                      </button>
                    ))}
                  </div>
                  {accountTab === "personal" && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[#111827]">Personal Information</h2>
                        <p className="text-[13px] text-[#6B7280]">Update your profile information.</p>
                        {isProfileLoading && (
                          <p className="text-[12px] text-[#6B7280] mt-1">Loading profile...</p>
                        )}
                      </div>

                      {isEmployerRole && (
                        <div className="border border-[#DBEAFE] bg-[#F8FBFF] rounded-[14px] p-4">
                          <div className="flex items-center gap-4">
                            {resolvedAvatarUrl ? (
                              <img
                                src={resolvedAvatarUrl}
                                alt="Employer profile"
                                className="w-14 h-14 rounded-[12px] object-cover border border-[#BFDBFE]"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-[12px] bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center font-bold text-[20px] border border-[#BFDBFE]">
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
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">First name</label>
                          <input
                            type="text"
                            value={personalInfo.firstName}
                            onChange={(e) => handlePersonalInfoChange("firstName", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Last name</label>
                          <input
                            type="text"
                            value={personalInfo.lastName}
                            onChange={(e) => handlePersonalInfoChange("lastName", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      {isEmployerRole && (
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Company name</label>
                          <input
                            type="text"
                            value={personalInfo.companyName}
                            onChange={(e) => handlePersonalInfoChange("companyName", e.target.value)}
                            placeholder="Enter your company name"
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[14px] font-medium text-[#475569] mb-2 block">City</label>
                        <input
                          type="text"
                          value={personalInfo.city}
                          onChange={(e) => handlePersonalInfoChange("city", e.target.value)}
                          className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                        />
                      </div>

                      {isEmployerRole && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Province</label>
                            <input
                              type="text"
                              value={personalInfo.province}
                              onChange={(e) => handlePersonalInfoChange("province", e.target.value)}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Address</label>
                            <input
                              type="text"
                              value={personalInfo.address}
                              onChange={(e) => handlePersonalInfoChange("address", e.target.value)}
                              placeholder="Office address"
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {!isAdminRole && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Phone number</label>
                            <input
                              type="tel"
                              value={personalInfo.phone}
                              onChange={(e) => handlePersonalInfoChange("phone", e.target.value)}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Email</label>
                            <input
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
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Email</label>
                          <input
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
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">LinkedIn</label>
                            <input
                              type="text"
                              value={personalInfo.linkedin}
                              onChange={(e) => handlePersonalInfoChange("linkedin", e.target.value)}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                            />
                          </div>

                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">About Me</label>
                            <textarea
                              value={personalInfo.about}
                              onChange={(e) => handlePersonalInfoChange("about", e.target.value)}
                              placeholder="Tell us about yourself, your experience, and what you're passionate about..."
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all resize-none"
                              rows={4}
                            />
                          </div>

                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Total Experience</label>
                            <select
                              value={experienceStats.totalExperience}
                              onChange={(e) => setExperienceStats({ ...experienceStats, totalExperience: e.target.value })}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
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
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Profile photo</label>
                            {resolvedAvatarUrl ? (
                              <div className="flex items-center gap-4">
                                <img
                                  src={resolvedAvatarUrl}
                                  alt="Profile"
                                  className="w-24 h-24 rounded-[12px] object-cover border-2 border-[#E5E7EB]"
                                />
                                <div className="flex flex-col gap-2">
                                  <label className="bg-[#2563EB] text-white font-semibold px-6 py-2 rounded-[10px] hover:bg-[#1D4ED8] transition-all cursor-pointer flex items-center gap-2 text-[14px]">
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
                                <label className="bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-[10px] hover:bg-[#1D4ED8] transition-all cursor-pointer flex items-center gap-2">
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
                        className={`bg-[#2563EB] text-white font-semibold px-8 py-3 rounded-[10px] transition-all ${
                          isProfileSaving ? "opacity-70 cursor-not-allowed" : "hover:bg-[#1D4ED8]"
                        }`}
                      >
                        {isProfileSaving ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  )}

                  {accountTab === "experience" && (
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
                              <div className="w-10 h-10 rounded-[10px] bg-[#dbeafe] flex items-center justify-center">
                                <span className="text-[20px]">📝</span>
                              </div>
                              <div>
                                <p className="text-[12px] text-[#64748b]">Jobs Applied</p>
                                <p className="text-[20px] font-bold text-[#2563eb]">{experienceStats.jobsApplied}</p>
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

                      <div className="bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] border border-[#bfdbfe] rounded-[16px] p-6">
                        <h3 className="text-[16px] font-semibold text-[#1e293b] mb-4">Add New Skill</h3>
                        <div className="space-y-4">
                          {/* Skill Selection Mode */}
                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Choose Option</label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="skillMode"
                                  checked={skillSelectionMode === "predefined"}
                                  onChange={() => setSkillSelectionMode("predefined")}
                                  className="w-4 h-4 text-[#2563EB]"
                                />
                                <span className="text-[14px] text-[#475569]">Select from list</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="skillMode"
                                  checked={skillSelectionMode === "custom"}
                                  onChange={() => setSkillSelectionMode("custom")}
                                  className="w-4 h-4 text-[#2563EB]"
                                />
                                <span className="text-[14px] text-[#475569]">Custom skill</span>
                              </label>
                            </div>
                          </div>

                          {/* Skill Name Input */}
                          <div>
                            <label className="text-[14px] font-medium text-[#475569] mb-2 block">Skill Name</label>
                            {skillSelectionMode === "predefined" ? (
                              <select
                                value={selectedPredefinedSkill}
                                onChange={(e) => setSelectedPredefinedSkill(e.target.value)}
                                className="w-full bg-white border border-[#bfdbfe] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
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
                                type="text"
                                value={newSkillName}
                                onChange={(e) => setNewSkillName(e.target.value)}
                                placeholder="e.g., Flutter, Blockchain, Video Editing"
                                className="w-full bg-white border border-[#bfdbfe] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                                onKeyPress={(e) => e.key === "Enter" && handleAddSkill()}
                              />
                            )}
                          </div>
                          <button
                            onClick={handleAddSkill}
                            className="w-full bg-[#2563EB] text-white font-semibold py-2.5 px-4 rounded-[10px] hover:bg-[#1D4ED8] transition-all"
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
                                  <div className="flex items-center gap-2 mt-2">
                                    <span
                                      className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold ${
                                        skill.level === "Expert"
                                          ? "bg-[#dbeafe] text-[#0c4a6e]"
                                          : skill.level === "Advanced"
                                          ? "bg-[#dcfce7] text-[#065f46]"
                                          : skill.level === "Intermediate"
                                          ? "bg-[#fef3c7] text-[#92400e]"
                                          : "bg-[#f3f4f6] text-[#4b5563]"
                                      }`}
                                    >
                                      {skill.level}
                                    </span>
                                    {skill.endorsements ? (
                                      <span className="text-[12px] text-[#64748B]">{skill.endorsements} endorsements</span>
                                    ) : null}
                                  </div>
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

                  {accountTab === "resume" && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[#111827]">CV/Resume</h2>
                        <p className="text-[13px] text-[#6B7280]">Upload your latest resume.</p>
                      </div>
                      {resumeUrl ? (
                        <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[12px] p-4 flex items-center justify-between">
                          <div>
                            <p className="text-[14px] font-semibold text-[#111827]">{resume?.name || "Resume uploaded"}</p>
                            <p className="text-[12px] text-[#64748B]">
                              {resume ? (resume.size / 1024).toFixed(2) + " KB" : "View your uploaded resume"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={resumeUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2563EB] hover:bg-[#EFF6FF] p-2 rounded-[8px]"
                              title="Download resume"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={handleDeleteResume}
                              className="text-[#EF4444] hover:bg-[#FEE2E2] p-2 rounded-[8px]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-[#CBD5E1] rounded-[12px] p-8 text-center">
                          <p className="text-[14px] text-[#64748B] mb-4">Upload your resume (PDF, DOC)</p>
                          <label className="bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-[10px] hover:bg-[#1D4ED8] transition-all cursor-pointer inline-flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Choose file
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={handleResumeUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                    <label className="text-[13px] text-[#6B7280]">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                        className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                      disabled={isPasswordSubmitting}
                      className="px-5 py-2.5 bg-[#0F766E] text-white rounded-full text-[13px] font-semibold disabled:opacity-60"
                    >
                      {isPasswordSubmitting ? "Sending OTP..." : passwordOtpRequested ? "Resend OTP" : "Send OTP"}
                    </button>
                  </div>

                  <div>
                    <label className="text-[13px] text-[#6B7280]">OTP Code</label>
                    <input
                      type="text"
                      value={passwordOtp}
                      onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[13px] text-[#6B7280]">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={securityData.newPassword}
                          onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                          className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                      <label className="text-[13px] text-[#6B7280]">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={securityData.confirmPassword}
                          onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                          className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                    className="px-6 py-2.5 bg-[#4F46E5] text-white rounded-full text-[14px] font-semibold disabled:opacity-60"
                  >
                    {isPasswordSubmitting ? "Saving..." : "Save New Password"}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#111827]">Two-Factor Authentication</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#6B7280]">{mfaEnabled ? "Enabled" : "Disabled"}</span>
                    <button
                      type="button"
                      onClick={handleToggleMfa}
                      className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                        mfaEnabled ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 bg-white rounded-full transition-transform ${mfaEnabled ? "translate-x-6" : ""}`}
                      />
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-[#6B7280] mt-2">
                  Add an extra verification step to protect your account.
                </p>

                {mfaEnabled && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] cursor-pointer hover:bg-[#F8FAFC]">
                        <input
                          type="radio"
                          name="mfa-method"
                          checked={mfaMethod === "authenticator"}
                          onChange={() => setMfaMethod("authenticator")}
                        />
                        Authenticator app
                      </label>
                      <label className="flex items-center gap-2 border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] cursor-pointer hover:bg-[#F8FAFC]">
                        <input
                          type="radio"
                          name="mfa-method"
                          checked={mfaMethod === "sms"}
                          onChange={() => setMfaMethod("sms")}
                        />
                        SMS code
                      </label>
                      <label className="flex items-center gap-2 border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] cursor-pointer hover:bg-[#F8FAFC]">
                        <input
                          type="radio"
                          name="mfa-method"
                          checked={mfaMethod === "email"}
                          onChange={() => setMfaMethod("email")}
                        />
                        Email code
                      </label>
                    </div>

                    <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] p-4">
                      <p className="text-[12px] font-semibold text-[#475569] mb-2">Setup key</p>
                      <div className="flex items-center justify-between gap-3">
                        <code className="text-[13px] text-[#0F172A] bg-white border border-[#E5E7EB] rounded px-2 py-1">
                          {mfaSetupKey || "Generating..."}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (mfaSetupKey) {
                              navigator.clipboard.writeText(mfaSetupKey);
                              toast.success("Setup key copied");
                            }
                          }}
                          className="text-[12px] text-[#2563EB] font-medium hover:text-[#1D4ED8]"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-[12px] text-[#64748B] mt-2">
                        Use this key in your authenticator app to finish setup.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSendTestCode}
                        className="px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-[#E2E8F0] text-[#1E293B] hover:bg-[#CBD5F5]"
                      >
                        Send test code
                      </button>
                      <button
                        type="button"
                        onClick={generateBackupCodes}
                        className="px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B]"
                      >
                        Generate backup codes
                      </button>
                    </div>

                    {backupCodes.length > 0 && showBackupCodes && (
                      <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[13px] font-semibold text-[#1E293B]">Backup codes</p>
                          <button
                            type="button"
                            onClick={() => setShowBackupCodes(false)}
                            className="text-[12px] text-[#64748B] hover:text-[#1E293B]"
                          >
                            Hide
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px] text-[#0F172A] font-mono">
                          {backupCodes.map((code) => (
                            <div key={code} className="bg-white border border-[#E5E7EB] rounded px-2 py-1">
                              {code}
                            </div>
                          ))}
                        </div>
                        <p className="text-[12px] text-[#64748B] mt-2">
                          Store these in a safe place. Each code can be used once.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <h3 className="text-[16px] font-semibold text-[#111827]">Profile Privacy</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  You can make some details of your jobs on the marketplace private.
                </p>
                <div className="mt-4 flex items-center justify-between border border-[#E5E7EB] rounded-[12px] px-4 py-4">
                  <div>
                    <p className="text-[15px] font-semibold text-[#111827]">Hide number of hired candidates</p>
                    <p className="text-[12px] text-[#6B7280]">Keep your hiring stats private.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#6B7280]">{hideHiredCandidates ? "Enable" : "Disabled"}</span>
                    <button
                      type="button"
                      onClick={() => setHideHiredCandidates(!hideHiredCandidates)}
                      className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                        hideHiredCandidates ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 bg-white rounded-full transition-transform ${
                          hideHiredCandidates ? "translate-x-6" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <h3 className="text-[16px] font-semibold text-[#111827] mb-2">Delete My Account</h3>
                <p className="text-[13px] text-[#6B7280] mb-4">
                  You can delete your account here.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    className="px-6 py-3 rounded-full border border-[#FCA5A5] text-[#B91C1C] text-[14px] font-semibold hover:bg-[#FEF2F2]"
                  >
                    Delete Account
                  </button>
                </div>
              </div>

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
                                {step.id === "phone" && step.status === "pending" && (
                                  <button
                                    onClick={handleVerifyPhone}
                                    className="mt-2 px-4 py-2 bg-[#2563EB] text-white text-[12px] rounded-[8px] hover:bg-[#1D4ED8]"
                                  >
                                    Verify Phone
                                  </button>
                                )}

                                {step.id === "identity" && step.status === "pending" && (
                                  <label className="mt-2 inline-block px-4 py-2 bg-[#2563EB] text-white text-[12px] rounded-[8px] hover:bg-[#1D4ED8] cursor-pointer">
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
                                  <label className="mt-2 inline-block px-4 py-2 bg-[#2563EB] text-white text-[12px] rounded-[8px] hover:bg-[#1D4ED8] cursor-pointer">
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

          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#111827]">Credit Card</h2>
                    <p className="text-[13px] text-[#6B7280]">Manage your credit cards and payment options.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.info("Add new card")}
                    className="text-[14px] text-[#2563EB] font-medium hover:text-[#1D4ED8]"
                  >
                    &gt; Add New Card
                  </button>
                </div>

                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="border border-[#E5E7EB] rounded-[14px] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-10 rounded-[10px] border border-[#E5E7EB] flex items-center justify-center text-[12px] font-semibold">
                          {method.brand}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#111827]">{method.brand} ending in {method.last4}</p>
                          <p className="text-[12px] text-[#6B7280]">Exp. Date {method.expiry}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {method.status === "default" && (
                          <span className="px-3 py-1 rounded-full bg-[#0F172A] text-white text-[11px] font-semibold">DEFAULT</span>
                        )}
                        {method.status === "expired" && (
                          <span className="px-3 py-1 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-semibold">EXPIRED</span>
                        )}
                        {method.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(method.id)}
                            className="text-[13px] text-[#2563EB] hover:text-[#1D4ED8]"
                          >
                            Set as Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(method.id)}
                          className="text-[#EF4444] hover:bg-[#FEE2E2] p-2 rounded-[8px]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <h3 className="text-[16px] font-semibold text-[#111827] mb-4">Add New Payment Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newCard.name}
                    onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                    placeholder="Name on Card"
                    className="w-full bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px]"
                  />
                  <input
                    type="text"
                    value={newCard.expiry}
                    onChange={(e) => setNewCard({ ...newCard, expiry: e.target.value })}
                    placeholder="Expiry"
                    className="w-full bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px]"
                  />
                  <input
                    type="text"
                    value={newCard.number}
                    onChange={(e) => setNewCard({ ...newCard, number: e.target.value })}
                    placeholder="Card Number"
                    className="w-full bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px]"
                  />
                  <input
                    type="text"
                    value={newCard.cvv}
                    onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value })}
                    placeholder="CVV"
                    className="w-full bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="mt-4 bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-[12px] hover:bg-[#1D4ED8]"
                >
                  Save card
                </button>
              </div>
            </div>
          )}

        </section>
      </div>
    </div>
  );
}
