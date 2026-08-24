import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Upload, Trash2, CheckCircle2, Clock, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "../lib/toast";
import { formatDate, formatDateTime } from "../lib/formatters";
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
  uploadAddressDocument,
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  addProfileSkill,
  updateProfileSkill,
  deleteProfileSkill,
  type WorkExperience,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { DeleteAccountCard } from "./settings/DeleteAccountCard";
import { EmployerPaymentMethodsSection } from "./settings/EmployerPaymentMethodsSection";
import { EmployerPrivacyCard } from "./settings/EmployerPrivacyCard";
import { MfaSettingsCard } from "./settings/MfaSettingsCard";
import { WorkerResumeSection } from "./settings/WorkerResumeSection";
import { SettingsTabList } from "./settings/SettingsTabList";
import { ConfirmDialog } from "./ui";
import IdAnalyzerVerifier from "./IdAnalyzerVerifier";
import {
  normalizeFullName,
  normalizePhone,
} from "../lib/authValidation";
import {
  PROFILE_LIMITS,
  validateAvatarFile,
  validateProfileDetails,
  type ProfileValidationField,
} from "../lib/profileValidation";
import {
  getPhilippineBarangays,
  getPhilippineLocationOptions,
  type BarangayOption,
  type CityOption,
  type ProvinceOption,
} from "../services/philippineLocations";

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

// Factories (not module-level constants) so labels can be recomputed via
// useMemo(() => getXConfig(t), [t]) whenever the active language changes —
// a plain constant built once at import time would freeze stale text.
const getAccountTabConfig = (t: TFunction): { id: AccountTab; label: string }[] => [
  { id: "personal", label: t("settings.accountTabs.personal") },
  { id: "experience", label: t("settings.accountTabs.experience") },
  { id: "resume", label: t("settings.accountTabs.resume") },
];

const getMainTabConfig = (t: TFunction): { id: TabType; label: string }[] => [
  { id: "account", label: t("settings.tabs.account") },
  { id: "privacy", label: t("settings.tabs.privacy") },
  { id: "payments", label: t("settings.tabs.payments") },
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

type VerificationStatus = "complete" | "pending" | "in-review" | "rejected";

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  status: VerificationStatus;
}

const verificationStatusStyles: Record<VerificationStatus, string> = {
  complete: "bg-[#DCFCE7] text-[#166534]",
  "in-review": "bg-[#FEF3C7] text-[#92400E]",
  rejected: "bg-[#FEE2E2] text-[#991B1B]",
  pending: "bg-[#E2E8F0] text-[#475569]",
};

const getVerificationStatusLabels = (t: TFunction): Record<VerificationStatus, string> => ({
  complete: t("settings.verification.statusLabels.complete"),
  "in-review": t("settings.verification.statusLabels.inReview"),
  rejected: t("settings.verification.statusLabels.rejected"),
  pending: t("settings.verification.statusLabels.pending"),
});

const ADDRESS_SUGGESTION_KEYS = [
  "nearCityHall",
  "nearPublicMarket",
  "nearBarangayHall",
  "nearTransportTerminal",
  "nearSchoolZone",
  "nearBusinessDistrict",
] as const;

const getAddressSuggestions = (t: TFunction): string[] =>
  ADDRESS_SUGGESTION_KEYS.map((key) => t(`settings.personal.addressSuggestions.${key}`));

// Predefined skill catalog. `value` is the English string persisted to the
// backend (never translated); the visible option/optgroup label is looked
// up from settings.skills.catalog.{categories,items}.<key> at render time.
const SKILL_CATALOG: { categoryKey: string; items: { key: string; value: string }[] }[] = [
  {
    categoryKey: "householdCleaning",
    items: [
      { key: "houseCleaning", value: "House Cleaning" },
      { key: "windowCleaning", value: "Window Cleaning" },
      { key: "laundryService", value: "Laundry Service" },
      { key: "ironing", value: "Ironing" },
      { key: "kitchenCleaning", value: "Kitchen Cleaning" },
      { key: "bathroomCleaning", value: "Bathroom Cleaning" },
    ],
  },
  {
    categoryKey: "gardeningLandscaping",
    items: [
      { key: "gardening", value: "Gardening" },
      { key: "lawnMowing", value: "Lawn Mowing" },
      { key: "landscaping", value: "Landscaping" },
      { key: "plantCare", value: "Plant Care" },
      { key: "weeding", value: "Weeding" },
      { key: "hedgeTrimming", value: "Hedge Trimming" },
    ],
  },
  {
    categoryKey: "shoppingDelivery",
    items: [
      { key: "shopping", value: "Shopping" },
      { key: "groceryShopping", value: "Grocery Shopping" },
      { key: "deliveryService", value: "Delivery Service" },
      { key: "errandRunning", value: "Errand Running" },
      { key: "packagePickup", value: "Package Pickup" },
    ],
  },
  {
    categoryKey: "academicTutoring",
    items: [
      { key: "tutoring", value: "Tutoring" },
      { key: "mathTutoring", value: "Math Tutoring" },
      { key: "englishTutoring", value: "English Tutoring" },
      { key: "languageTutoring", value: "Language Tutoring" },
      { key: "scienceTutoring", value: "Science Tutoring" },
      { key: "homeworkHelp", value: "Homework Help" },
      { key: "testPreparation", value: "Test Preparation" },
    ],
  },
  {
    categoryKey: "languagesTranslation",
    items: [
      { key: "englishSpeaking", value: "English Speaking" },
      { key: "translationService", value: "Translation Service" },
      { key: "languageCoaching", value: "Language Coaching" },
      { key: "pronunciationTraining", value: "Pronunciation Training" },
    ],
  },
  {
    categoryKey: "fitnessWellness",
    items: [
      { key: "personalTraining", value: "Personal Training" },
      { key: "yogaInstruction", value: "Yoga Instruction" },
      { key: "fitnessCoaching", value: "Fitness Coaching" },
      { key: "walkingCompanion", value: "Walking Companion" },
    ],
  },
  {
    categoryKey: "petCare",
    items: [
      { key: "dogWalking", value: "Dog Walking" },
      { key: "petSitting", value: "Pet Sitting" },
      { key: "petGrooming", value: "Pet Grooming" },
      { key: "petTraining", value: "Pet Training" },
    ],
  },
  {
    categoryKey: "handymanRepairs",
    items: [
      { key: "handymanServices", value: "Handyman Services" },
      { key: "painting", value: "Painting" },
      { key: "carpentry", value: "Carpentry" },
      { key: "plumbingAssistance", value: "Plumbing Assistance" },
      { key: "furnitureAssembly", value: "Furniture Assembly" },
      { key: "electricalAssistance", value: "Electrical Assistance" },
    ],
  },
  {
    categoryKey: "cookingFood",
    items: [
      { key: "mealPreparation", value: "Meal Preparation" },
      { key: "cooking", value: "Cooking" },
      { key: "baking", value: "Baking" },
      { key: "foodDelivery", value: "Food Delivery" },
      { key: "kitchenHelp", value: "Kitchen Help" },
    ],
  },
  {
    categoryKey: "childcareBabysitting",
    items: [
      { key: "babysitting", value: "Babysitting" },
      { key: "childcare", value: "Childcare" },
      { key: "afterSchoolCare", value: "After-School Care" },
      { key: "tutoringKids", value: "Tutoring Kids" },
    ],
  },
  {
    categoryKey: "administrativeTechnical",
    items: [
      { key: "dataEntry", value: "Data Entry" },
      { key: "virtualAssistant", value: "Virtual Assistant" },
      { key: "typingServices", value: "Typing Services" },
      { key: "transcription", value: "Transcription" },
      { key: "emailManagement", value: "Email Management" },
    ],
  },
  {
    categoryKey: "creativeServices",
    items: [
      { key: "socialMediaManagement", value: "Social Media Management" },
      { key: "photography", value: "Photography" },
      { key: "graphicDesign", value: "Graphic Design" },
      { key: "contentWriting", value: "Content Writing" },
      { key: "videoEditing", value: "Video Editing" },
    ],
  },
  {
    categoryKey: "movingHeavyLifting",
    items: [
      { key: "movingHelp", value: "Moving Help" },
      { key: "heavyLifting", value: "Heavy Lifting" },
      { key: "packingService", value: "Packing Service" },
    ],
  },
  {
    categoryKey: "eventServices",
    items: [
      { key: "eventSetup", value: "Event Setup" },
      { key: "eventPlanning", value: "Event Planning" },
      { key: "partyHostingAssistance", value: "Party Hosting Assistance" },
      { key: "decoration", value: "Decoration" },
    ],
  },
];

interface SkillItem {
  id: string;
  name: string;
  description?: string;
  endorsements?: number;
}

type WorkExperienceItem = WorkExperience & { id: string };

const emptyExperienceDraft: Omit<WorkExperience, "_id" | "id"> = {
  title: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
};

const toMonthInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 7);
  return date.toISOString().slice(0, 7);
};

const formatExperienceMonth = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : formatDate(date, { month: "short", year: "numeric" });
};

const mapWorkExperiences = (items: WorkExperience[] = []): WorkExperienceItem[] =>
  items.map((item) => ({ ...item, id: item.id || item._id || "" })).filter((item) => item.id);

interface SessionInfo {
  id: string;
  current: boolean;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
}

type PersonalInfoState = {
  firstName: string;
  lastName: string;
  companyName: string;
  city: string;
  province: string;
  barangay: string;
  addressType: string;
  address: string;
  phone: string;
  email: string;
  about: string;
  jobPosition: string;
  linkedin: string;
  website: string;
  photo: File | null;
};

const profileToPersonalInfo = (profile: any, previous?: PersonalInfoState): PersonalInfoState => ({
  firstName: profile?.firstName || "",
  lastName: profile?.lastName || "",
  companyName: profile?.companyName || "",
  email: profile?.email || previous?.email || "",
  phone: profile?.phoneNumber || "",
  city: profile?.city || "",
  province: profile?.province || "",
  barangay: profile?.barangay || "",
  addressType: profile?.addressType || "home",
  address: profile?.address || "",
  about: profile?.about || "",
  jobPosition: profile?.jobPosition || "",
  linkedin: profile?.linkedin || "",
  website: profile?.website || "",
  photo: previous?.photo || null,
});

export function Settings() {
  const { t } = useTranslation("worker");
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
  const hasEmployerAccess = isEmployerRole || roleValue === "both";
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isAvatarSubmitting, setIsAvatarSubmitting] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileFormError, setProfileFormError] = useState("");
  const [profileErrorField, setProfileErrorField] = useState<ProfileValidationField | null>(null);
  const profileDraftDirtyRef = useRef(false);
  const originalPersonalInfoRef = useRef<PersonalInfoState | null>(null);
  const originalTotalExperienceRef = useRef("");

  const [personalInfo, setPersonalInfo] = useState<PersonalInfoState>({
    firstName: "",
    lastName: "",
    companyName: "",
    city: "",
    province: "",
    barangay: "",
    addressType: "home",
    address: "",
    phone: "",
    email: "",
    about: "",
    jobPosition: "",
    linkedin: "",
    website: "",
    photo: null as File | null,
  });

  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [workExperiences, setWorkExperiences] = useState<WorkExperienceItem[]>([]);
  const [experienceDraft, setExperienceDraft] = useState(emptyExperienceDraft);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [isExperienceSaving, setIsExperienceSaving] = useState(false);
  const [deleteExperienceTarget, setDeleteExperienceTarget] = useState<WorkExperienceItem | null>(null);
  const [deletingExperienceId, setDeletingExperienceId] = useState<string | null>(null);

  const [experienceStats, setExperienceStats] = useState({
    totalExperience: "",
  });

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDescription, setNewSkillDescription] = useState("");
  const [skillSelectionMode, setSkillSelectionMode] = useState<"predefined" | "custom">("predefined");
  const [selectedPredefinedSkill, setSelectedPredefinedSkill] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingSkillDescription, setEditingSkillDescription] = useState("");
  const [skillMutationId, setSkillMutationId] = useState<string | null>(null);

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
  const [locationDataError, setLocationDataError] = useState("");
  const [barangayDataError, setBarangayDataError] = useState("");
  const [locationReloadKey, setLocationReloadKey] = useState(0);

  const completedSteps = verificationStepsData.filter((step) => step.status === "complete").length;
  const isProfileVerified = verificationStepsData.length > 0 && completedSteps === verificationStepsData.length;

  const selectedProvince = provinceOptions.find(
    (item) => item.name.toLowerCase() === personalInfo.province.trim().toLowerCase(),
  );

  const filteredCityOptions = selectedProvince?.code
    ? cityOptions.filter((item) => item.provinceCode === selectedProvince.code)
    : [];

  const selectedCity = filteredCityOptions.find(
    (item) => item.name.toLowerCase() === personalInfo.city.trim().toLowerCase(),
  );

  const selectedBarangay = barangayOptions.find(
    (item) => item.name.toLowerCase() === personalInfo.barangay.trim().toLowerCase(),
  );

  const mainTabConfig = useMemo(() => getMainTabConfig(t), [t]);
  const accountTabConfig = useMemo(() => getAccountTabConfig(t), [t]);
  const verificationStatusLabels = useMemo(() => getVerificationStatusLabels(t), [t]);
  const addressSuggestions = useMemo(() => getAddressSuggestions(t), [t]);

  const visibleMainTabs = hasEmployerAccess
    ? mainTabConfig
    : mainTabConfig.filter((tab) => tab.id !== "payments");

  const visibleAccountTabs = (isAdminRole || isEmployerRole
    ? accountTabConfig.filter((tab) => tab.id === "personal")
    : accountTabConfig
  ).map((tab) =>
    isEmployerRole && tab.id === "personal"
      ? { ...tab, label: t("settings.accountTabs.business") }
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
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleMainTabChange = (tab: TabType) => {
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
          device: s.userAgent || t("settings.sessions.unknownDevice"),
          location: t("settings.sessions.unknown"),
          ip: s.ip || t("settings.sessions.unknown"),
          lastActive: s.createdAt ? formatDateTime(s.createdAt) : t("settings.sessions.unknown"),
        }));
        setSessions(mapped);
      } catch (error: any) {
        console.error("Failed to load sessions:", error);
        toast.error(t("settings.toast.loadSessionsFailed"));
      } finally {
        setIsLoadingSessions(false);
      }
    };
    loadSessions();
  }, [activeTab, t]);

  // Load verification status when privacy tab is active
  useEffect(() => {
    if (activeTab !== "privacy" || isAdminRole) return;
    const loadVerification = async () => {
      setIsLoadingVerification(true);
      try {
        await reloadVerificationStatus();
      } catch (error: any) {
        console.error("Failed to load verification status:", error);
        toast.error(t("settings.toast.loadVerificationFailed"));
      } finally {
        setIsLoadingVerification(false);
      }
    };
    loadVerification();
  }, [activeTab, isAdminRole, t]);

  const handlePersonalInfoChange = (field: string, value: string) => {
    profileDraftDirtyRef.current = true;
    if (profileFormError) {
      setProfileFormError("");
      setProfileErrorField(null);
    }
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

    const validationError = validateAvatarFile(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = "";
      return;
    }

    setIsAvatarSubmitting(true);
    try {
      const response = await uploadAvatar(file);
      const newAvatarUrl = toAbsoluteAssetUrl(response?.data?.avatarUrl || null);
      setAvatarUrl(newAvatarUrl);
      updateAuthProfile({ avatarUrl: newAvatarUrl ?? undefined });
      toast.success(t("settings.toast.photoUploaded"));
      // Trigger sidebar update
      window.dispatchEvent(new Event('auth_user_updated'));
    } catch (error: any) {
      toast.error(error.message || t("settings.toast.photoUploadFailed"));
    } finally {
      setIsAvatarSubmitting(false);
      e.target.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (isAvatarSubmitting) return;
    setIsAvatarSubmitting(true);
    try {
      await deleteAvatar();
      setAvatarUrl(null);
      updateAuthProfile({ avatarUrl: undefined });
      toast.success(t("settings.toast.photoRemoved"));
      // Trigger sidebar update
      window.dispatchEvent(new Event('auth_user_updated'));
    } catch (error: any) {
      toast.error(error.message || t("settings.toast.photoRemoveFailed"));
    } finally {
      setIsAvatarSubmitting(false);
    }
  };

  useEffect(() => {
    if (!user || profileDraftDirtyRef.current) return;
    setPersonalInfo((prev) => profileToPersonalInfo(user, prev));
    setExperienceStats({
      totalExperience: user.totalExperience || "",
    });
    if (user.skills && Array.isArray(user.skills)) {
      const mappedSkills = user.skills.map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || '',
      })) as SkillItem[];
      setSkills(mappedSkills);
    }
    if (Array.isArray(user.workExperience)) {
      setWorkExperiences(mapWorkExperiences(user.workExperience));
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadLocationData = async () => {
      setIsLoadingLocationData(true);
      setLocationDataError("");
      try {
        const { provinces, cities } = await getPhilippineLocationOptions();
        if (!isMounted) return;
        setProvinceOptions(provinces);
        setCityOptions(cities);
      } catch (error) {
        console.error("Failed to load Philippine location data:", error);
        if (isMounted) {
          setLocationDataError(t("settings.toast.locationOptionsUnavailable"));
        }
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
  }, [locationReloadKey, t]);

  useEffect(() => {
    let isMounted = true;

    const loadBarangays = async () => {
      if (!selectedCity?.code) {
        setBarangayOptions([]);
        setBarangayDataError("");
        return;
      }

      setIsLoadingBarangays(true);
      setBarangayDataError("");
      try {
        const normalized = await getPhilippineBarangays(selectedCity.code);
        if (!isMounted) return;
        setBarangayOptions(normalized);
      } catch (error) {
        console.error("Failed to load barangays:", error);
        if (isMounted) {
          setBarangayOptions([]);
          setBarangayDataError(t("settings.toast.barangayOptionsUnavailable"));
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
  }, [selectedCity?.code, t]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const response = await getProfile();
        const profile = (response as any)?.user ?? response;
        if (!isMounted || !profile) return;
        if (!profileDraftDirtyRef.current) {
          const loadedPersonalInfo = profileToPersonalInfo(profile);
          setPersonalInfo(loadedPersonalInfo);
          originalPersonalInfoRef.current = loadedPersonalInfo;
          originalTotalExperienceRef.current = profile.totalExperience || "";
        }
        if (profile.skills && Array.isArray(profile.skills)) {
          const mappedSkills = profile.skills.map((skill: any) => ({
            ...skill,
            id: skill.id || skill._id || '',
          })) as SkillItem[];
          setSkills(mappedSkills);
        }
        setWorkExperiences(mapWorkExperiences(profile.workExperience || []));
        setExperienceStats({
          totalExperience: profile.totalExperience || "",
        });
        setResumeUrl(profile.resumeUrl || null);
        setAvatarUrl(toAbsoluteAssetUrl(profile.avatarUrl));
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
          province: profile.province,
          barangay: profile.barangay,
          addressType: profile.addressType,
          address: profile.address,
          companyName: profile.companyName,
          about: profile.about,
          jobPosition: profile.jobPosition,
          linkedin: profile.linkedin,
          website: profile.website,
          totalExperience: profile.totalExperience,
          projectsCompleted: profile.projectsCompleted,
          jobsApplied: profile.jobsApplied,
          successRate: profile.successRate,
          avatarUrl: normalizedAvatarUrl,
        });
      } catch (error: any) {
        const message = error?.message || t("settings.toast.loadProfileFailed");
        toast.error(message);
      } finally {
        if (isMounted) setIsProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [updateAuthProfile, t]);

  const handleSavePersonalInfo = async () => {
    if (isProfileSaving || isProfileLoading) return;
    const firstName = normalizeFullName(personalInfo.firstName);
    const lastName = normalizeFullName(personalInfo.lastName);
    const phoneNumber = normalizePhone(personalInfo.phone);
    const normalizedProfile = {
      firstName,
      lastName,
      phone: personalInfo.phone.trim() ? phoneNumber : "",
      companyName: personalInfo.companyName.trim(),
      jobPosition: personalInfo.jobPosition.trim(),
      about: personalInfo.about.trim(),
      address: personalInfo.address.trim(),
      linkedin: personalInfo.linkedin.trim(),
      website: personalInfo.website.trim(),
    };
    const validationIssue = validateProfileDetails(normalizedProfile, { employer: isEmployerRole }, t);
    if (validationIssue) {
      const fieldIds: Record<ProfileValidationField, string> = {
        firstName: "settings-first-name",
        lastName: "settings-last-name",
        phone: "settings-phone",
        companyName: "settings-company-name",
        jobPosition: "settings-job-position",
        about: "settings-about",
        address: "settings-address",
        linkedin: "settings-linkedin",
        website: "settings-website",
      };
      setProfileFormError(validationIssue.message);
      setProfileErrorField(validationIssue.field);
      requestAnimationFrame(() => document.getElementById(fieldIds[validationIssue.field])?.focus());
      return;
    }

    const original = originalPersonalInfoRef.current;
    if (!original) {
      const message = t("settings.toast.profileStillLoading");
      setProfileFormError(message);
      toast.error(message);
      return;
    }

    const normalizedLocation = {
      province: personalInfo.province.trim(),
      city: personalInfo.city.trim(),
      barangay: personalInfo.barangay.trim(),
    };
    const locationChanged = (Object.keys(normalizedLocation) as Array<keyof typeof normalizedLocation>)
      .some((field) => normalizedLocation[field] !== original[field].trim());
    const hasAnyLocation = Object.values(normalizedLocation).some(Boolean);
    if (locationChanged && (isLoadingLocationData || isLoadingBarangays)) {
      const message = t("settings.toast.waitForLocationData");
      setProfileFormError(message);
      toast.error(message);
      return;
    }
    if (locationChanged && locationDataError) {
      const message = t("settings.toast.locationDataUnavailableForSave");
      setProfileFormError(message);
      toast.error(message);
      return;
    }
    if (hasAnyLocation && (!selectedProvince || !selectedCity || !selectedBarangay)) {
      const message = t("settings.toast.selectValidLocation");
      setProfileFormError(message);
      toast.error(message);
      return;
    }

    setProfileFormError("");
    setProfileErrorField(null);
    setIsProfileSaving(true);
    try {
      const nextValues: Record<string, string> = {
        firstName,
        lastName,
        companyName: personalInfo.companyName.trim(),
        city: normalizedLocation.city,
        province: normalizedLocation.province,
        barangay: normalizedLocation.barangay,
        addressType: personalInfo.addressType,
        address: personalInfo.address.trim(),
        phoneNumber,
        about: personalInfo.about.trim(),
        totalExperience: experienceStats.totalExperience,
        jobPosition: personalInfo.jobPosition.trim(),
        linkedin: personalInfo.linkedin.trim(),
        website: personalInfo.website.trim(),
      };
      const originalValues: Record<string, string> = {
        firstName: original.firstName.trim(),
        lastName: original.lastName.trim(),
        companyName: original.companyName.trim(),
        city: original.city.trim(),
        province: original.province.trim(),
        barangay: original.barangay.trim(),
        addressType: original.addressType,
        address: original.address.trim(),
        phoneNumber: normalizePhone(original.phone),
        about: original.about.trim(),
        totalExperience: originalTotalExperienceRef.current,
        jobPosition: original.jobPosition.trim(),
        linkedin: original.linkedin.trim(),
        website: original.website.trim(),
      };
      const adminAllowed = new Set([
        "firstName", "lastName", "companyName", "city", "province", "barangay", "addressType", "address",
      ]);
      const profilePayload = Object.fromEntries(
        Object.entries(nextValues).filter(([key, value]) => {
          if (isAdminRole && !adminAllowed.has(key)) return false;
          return value !== originalValues[key];
        }),
      );
      if (Object.keys(profilePayload).length === 0) {
        profileDraftDirtyRef.current = false;
        toast.success(t("settings.toast.noProfileChanges"));
        return;
      }
      const response = await updateProfile({
        ...profilePayload,
        // Note: projectsCompleted, jobsApplied, and successRate are auto-calculated by backend
      });
      const updated = (response as any)?.user ?? response;
      const savedPersonalInfo = profileToPersonalInfo(updated, personalInfo);
      setPersonalInfo(savedPersonalInfo);
      originalPersonalInfoRef.current = savedPersonalInfo;
      originalTotalExperienceRef.current = updated.totalExperience || "";
      
      setExperienceStats({
        totalExperience: updated.totalExperience ?? "",
      });
      
      profileDraftDirtyRef.current = false;
      updateAuthProfile({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phoneNumber: updated.phoneNumber,
        city: updated.city,
        province: updated.province,
        barangay: updated.barangay,
        addressType: updated.addressType,
        address: updated.address,
        companyName: updated.companyName,
        about: updated.about,
        jobPosition: updated.jobPosition,
        linkedin: updated.linkedin,
        website: updated.website,
        totalExperience: updated.totalExperience,
        projectsCompleted: updated.projectsCompleted ?? 0,
        jobsApplied: updated.jobsApplied ?? 0,
        successRate: updated.successRate ?? '0%',
        avatarUrl: updated.avatarUrl,
      });
      toast.success(t("settings.toast.profileSaved"));
    } catch (error: any) {
      const message = error?.message || t("settings.toast.profileSaveFailed");
      setProfileFormError(message);
      setProfileErrorField(null);
      toast.error(message);
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleAddSkill = async () => {
    const skillName = skillSelectionMode === "predefined" ? selectedPredefinedSkill : newSkillName.trim();
    const skillDescription = newSkillDescription.trim();
    
    if (!skillName) {
      toast.error(t("settings.toast.skillNameRequired"));
      return;
    }
    if (skillName.length > PROFILE_LIMITS.skillName) {
      toast.error(t("settings.toast.skillNameTooLong", { limit: PROFILE_LIMITS.skillName }));
      return;
    }
    if (skillDescription.length > PROFILE_LIMITS.skillDescription) {
      toast.error(t("settings.toast.skillDescriptionTooLong", { limit: PROFILE_LIMITS.skillDescription }));
      return;
    }
    if (skills.length >= 50 && !skills.some((skill) => skill.name.toLowerCase() === skillName.toLowerCase())) {
      toast.error(t("settings.toast.skillLimitReached"));
      return;
    }
    if (skillMutationId) return;
    setSkillMutationId("new");
    try {
      const data = await addProfileSkill({ name: skillName, description: skillDescription });
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
      toast.success(data?.message || t("settings.toast.skillSaved", { name: skillName }));
    } catch (error: any) {
      toast.error(error.message || t("settings.toast.skillAddFailed"));
    } finally {
      setSkillMutationId(null);
    }
  };

  const handleEditSkillDescription = async (id: string) => {
    if (editingSkillDescription.trim().length > PROFILE_LIMITS.skillDescription) {
      toast.error(t("settings.toast.skillDescriptionTooLong", { limit: PROFILE_LIMITS.skillDescription }));
      return;
    }
    if (skillMutationId) return;
    setSkillMutationId(id);
    try {
      const data = await updateProfileSkill(id, { description: editingSkillDescription });
      const mappedSkills = (data.data?.skills || []).map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || "",
      })) as SkillItem[];
      setSkills(mappedSkills);
      updateAuthProfile({ skills: mappedSkills });
      setEditingSkillId(null);
      setEditingSkillDescription("");
      toast.success(t("settings.toast.skillDescriptionUpdated"));
    } catch (error: any) {
      toast.error(error.message || t("settings.toast.skillDescriptionUpdateFailed"));
    } finally {
      setSkillMutationId(null);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (skillMutationId) return;
    setSkillMutationId(id);
    try {
      const data = await deleteProfileSkill(id);
      const mappedSkills = (data.data?.skills || []).map((skill: any) => ({
        ...skill,
        id: skill.id || skill._id || "",
      })) as SkillItem[];
      setSkills(mappedSkills);
      updateAuthProfile({ skills: mappedSkills });
      toast.success(t("settings.toast.skillRemoved"));
    } catch (error: any) {
      toast.error(error.message || t("settings.toast.skillRemoveFailed"));
    } finally {
      setSkillMutationId(null);
    }
  };

  const resetExperienceEditor = () => {
    setExperienceDraft(emptyExperienceDraft);
    setEditingExperienceId(null);
  };

  const handleSaveExperience = async () => {
    if (isExperienceSaving) return;
    if (!experienceDraft.title.trim() || !experienceDraft.company.trim() || !experienceDraft.startDate) {
      toast.error(t("settings.toast.experienceRequiredFields"));
      return;
    }
    if (!experienceDraft.current && !experienceDraft.endDate) {
      toast.error(t("settings.toast.experienceEndDateRequired"));
      return;
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (experienceDraft.startDate > currentMonth || (!experienceDraft.current && String(experienceDraft.endDate) > currentMonth)) {
      toast.error(t("settings.toast.experienceFutureDate"));
      return;
    }
    if (!experienceDraft.current && experienceDraft.endDate && experienceDraft.endDate < experienceDraft.startDate) {
      toast.error(t("settings.toast.experienceEndBeforeStart"));
      return;
    }
    if (
      experienceDraft.title.trim().length > PROFILE_LIMITS.experienceTitle ||
      experienceDraft.company.trim().length > PROFILE_LIMITS.experienceCompany ||
      (experienceDraft.location?.trim().length || 0) > PROFILE_LIMITS.experienceLocation ||
      (experienceDraft.description?.trim().length || 0) > PROFILE_LIMITS.experienceDescription
    ) {
      toast.error(t("settings.toast.experienceFieldTooLong"));
      return;
    }
    if (!editingExperienceId && workExperiences.length >= 25) {
      toast.error(t("settings.toast.experienceLimitReached"));
      return;
    }

    setIsExperienceSaving(true);
    try {
      const payload = {
        ...experienceDraft,
        title: experienceDraft.title.trim(),
        company: experienceDraft.company.trim(),
        location: experienceDraft.location?.trim() || "",
        description: experienceDraft.description?.trim() || "",
        endDate: experienceDraft.current ? null : experienceDraft.endDate,
      };
      const response = editingExperienceId
        ? await updateWorkExperience(editingExperienceId, payload)
        : await addWorkExperience(payload);
      const nextItems = mapWorkExperiences((response as any)?.workExperience || []);
      setWorkExperiences(nextItems);
      updateAuthProfile({ workExperience: nextItems });
      resetExperienceEditor();
      toast.success(editingExperienceId ? t("settings.toast.experienceUpdated") : t("settings.toast.experienceAdded"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.experienceSaveFailed"));
    } finally {
      setIsExperienceSaving(false);
    }
  };

  const handleEditExperience = (item: WorkExperienceItem) => {
    setEditingExperienceId(item.id);
    setExperienceDraft({
      title: item.title,
      company: item.company,
      location: item.location || "",
      startDate: toMonthInput(item.startDate),
      endDate: toMonthInput(item.endDate),
      current: Boolean(item.current),
      description: item.description || "",
    });
  };

  const handleDeleteExperience = async (id: string) => {
    if (deletingExperienceId) return;
    setDeletingExperienceId(id);
    try {
      const response = await deleteWorkExperience(id);
      const nextItems = mapWorkExperiences((response as any)?.workExperience || []);
      setWorkExperiences(nextItems);
      updateAuthProfile({ workExperience: nextItems });
      if (editingExperienceId === id) resetExperienceEditor();
      setDeleteExperienceTarget(null);
      toast.success(t("settings.toast.experienceRemoved"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.experienceRemoveFailed"));
    } finally {
      setDeletingExperienceId(null);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!securityData.currentPassword) {
      toast.error(t("settings.toast.currentPasswordRequired"));
      return;
    }

    setIsOtpSending(true);
    try {
      await requestPasswordChangeOtp({ currentPassword: securityData.currentPassword });
      setPasswordOtpRequested(true);
      toast.success(t("settings.toast.otpSent"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.otpSendFailed"));
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordOtpRequested) {
      toast.error(t("settings.toast.otpRequestFirst"));
      return;
    }

    if (!passwordOtp) {
      toast.error(t("settings.toast.otpCodeRequired"));
      return;
    }

    if (!securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword) {
      toast.error(t("settings.toast.fillAllFields"));
      return;
    }

    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error(t("settings.toast.passwordsDoNotMatch"));
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await confirmPasswordChangeWithOtp({
        currentPassword: securityData.currentPassword,
        code: passwordOtp,
        newPassword: securityData.newPassword,
      });
      toast.success(t("settings.toast.passwordChanged"));
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordOtp("");
      setPasswordOtpRequested(false);
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.passwordChangeFailed"));
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
    toast.info(t("settings.toast.changesDiscarded"));
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      // Immediately update UI by removing the session
      setSessions(prevSessions => prevSessions.filter((s) => s.id !== sessionId));
      toast.success(t("settings.toast.sessionRevoked"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.sessionRevokeFailed"));
      console.error("Revoke session error:", error);
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessions();
      // Clear all sessions from state
      setSessions([]);
      toast.success(t("settings.toast.allSessionsRevoked"));
      // Optionally redirect to login or refresh the page
      window.location.href = "/sign-in";
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.allSessionsRevokeFailed"));
    }
  };

  const handleRequestPhoneCode = async () => {
    try {
      setIsSendingPhoneCode(true);
      const response = await requestPhoneVerificationOtp();
      setPhoneCodeRequested(true);
      setPhoneCodeHint(
        response.devCode
          ? t("settings.toast.devCode", { code: response.devCode })
          : response.phoneMasked
            ? t("settings.toast.codeSentTo", { phone: response.phoneMasked })
            : null
      );
      toast.success(response?.message || t("settings.toast.verificationCodeSent"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.verificationCodeSendFailed"));
    } finally {
      setIsSendingPhoneCode(false);
    }
  };

  const handleConfirmPhoneCode = async () => {
    const normalizedCode = phoneVerificationCode.trim();
    if (!normalizedCode) {
      toast.error(t("settings.toast.enterVerificationCode"));
      return;
    }
    try {
      setIsConfirmingPhoneCode(true);
      await confirmPhoneVerificationOtp({ code: normalizedCode });
      toast.success(t("settings.toast.phoneVerified"));
      setPhoneVerificationCode("");
      setPhoneCodeRequested(false);
      await reloadVerificationStatus();
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.phoneVerifyFailed"));
    } finally {
      setIsConfirmingPhoneCode(false);
    }
  };

  const handleUploadAddressDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAddressDocument(file);
      toast.success(t("settings.toast.addressUploaded"));
      // Reload verification status
      await reloadVerificationStatus();
    } catch (error: any) {
      toast.error(error?.message || t("settings.toast.addressUploadFailed"));
    }
  };

  return (
    <div className="ui-page mx-auto max-w-[1200px] px-4 pb-16 md:px-0">
      <div className="ui-page-header">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1C4D8D]">{t("settings.eyebrow")}</p>
          <h1 className="ui-page-title mt-1">{t("settings.title")}</h1>
          <p className="ui-page-subtitle">{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-50 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="border-b border-slate-200 pb-4">
            <SettingsTabList
              ariaLabel={t("settings.tabs.ariaMain")}
              idPrefix="settings-main"
              options={visibleMainTabs}
              value={activeTab}
              onChange={handleMainTabChange}
            />
          </div>
        </div>

        {activeTab === "account" && (
          <div
            id="settings-main-panel-account"
            role="tabpanel"
            aria-labelledby="settings-main-tab-account"
            className="p-6"
          >
            <div className="mb-6">
              <SettingsTabList
                ariaLabel={t("settings.tabs.ariaAccount")}
                idPrefix="settings-account"
                options={visibleAccountTabs}
                value={accountTab}
                onChange={handleAccountTabChange}
              />
            </div>

            {accountTab === "personal" && (
              <div
                id="settings-account-panel-personal"
                role="tabpanel"
                aria-labelledby="settings-account-tab-personal"
              >
                <form
                  className="space-y-6"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSavePersonalInfo();
                  }}
                >
                      <div>
                        <h2 className="text-[18px] font-semibold text-[#111827]">
                          {isEmployerRole ? t("settings.personal.businessHeading") : t("settings.personal.personalHeading")}
                        </h2>
                        <p className="text-[13px] text-[#6B7280]">
                          {isEmployerRole ? t("settings.personal.businessSubtitle") : t("settings.personal.personalSubtitle")}
                        </p>
                        {isProfileLoading && (
                          <p className="text-[12px] text-[#6B7280] mt-1" role="status">{t("settings.personal.loading")}</p>
                        )}
                      </div>

                      {profileFormError ? (
                        <div id="settings-profile-error" className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-800" role="alert">
                          {profileFormError}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="settings-first-name" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.firstName")}</label>
                          <input
                            id="settings-first-name"
                            type="text"
                            value={personalInfo.firstName}
                            maxLength={PROFILE_LIMITS.name}
                            required
                            autoComplete="given-name"
                            aria-invalid={profileErrorField === "firstName"}
                            aria-describedby={profileErrorField === "firstName" ? "settings-profile-error" : undefined}
                            onChange={(e) => handlePersonalInfoChange("firstName", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label htmlFor="settings-last-name" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.lastName")}</label>
                          <input
                            id="settings-last-name"
                            type="text"
                            value={personalInfo.lastName}
                            maxLength={PROFILE_LIMITS.name}
                            required
                            autoComplete="family-name"
                            aria-invalid={profileErrorField === "lastName"}
                            aria-describedby={profileErrorField === "lastName" ? "settings-profile-error" : undefined}
                            onChange={(e) => handlePersonalInfoChange("lastName", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      {isEmployerRole && (
                        <div>
                          <label htmlFor="settings-company-name" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.companyName")}</label>
                          <input
                            id="settings-company-name"
                            type="text"
                            value={personalInfo.companyName}
                            maxLength={PROFILE_LIMITS.companyName}
                            required
                            autoComplete="organization"
                            aria-invalid={profileErrorField === "companyName"}
                            aria-describedby={profileErrorField === "companyName" ? "settings-profile-error" : undefined}
                            onChange={(e) => handlePersonalInfoChange("companyName", e.target.value)}
                            placeholder={t("settings.personal.companyNamePlaceholder")}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                          />
                        </div>
                      )}

                      {!isAdminRole && (
                        <>
                          {locationDataError ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="status">
                              <span>{locationDataError}</span>
                              <button
                                type="button"
                                onClick={() => setLocationReloadKey((value) => value + 1)}
                                className="min-h-11 rounded-[8px] border border-amber-300 bg-white px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                              >
                                {t("settings.personal.retry")}
                              </button>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <label htmlFor="settings-province" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.province")}</label>
                              <input
                                id="settings-province"
                                list="settings-province-options"
                                value={personalInfo.province}
                                maxLength={PROFILE_LIMITS.province}
                                autoComplete="address-level1"
                                disabled={isLoadingLocationData || Boolean(locationDataError)}
                                aria-invalid={Boolean(personalInfo.province) && !selectedProvince}
                                onChange={(event) => handlePersonalInfoChange("province", event.target.value)}
                                placeholder={isLoadingLocationData ? t("settings.personal.provincePlaceholderLoading") : t("settings.personal.provincePlaceholder")}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] disabled:bg-slate-50 disabled:text-slate-500"
                              />
                              <datalist id="settings-province-options">
                                {provinceOptions.map((province) => <option key={province.code} value={province.name} />)}
                              </datalist>
                            </div>

                            <div>
                              <label htmlFor="settings-city" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.city")}</label>
                              <input
                                id="settings-city"
                                list="settings-city-options"
                                value={personalInfo.city}
                                maxLength={PROFILE_LIMITS.city}
                                autoComplete="address-level2"
                                disabled={!selectedProvince || Boolean(locationDataError)}
                                aria-invalid={Boolean(personalInfo.city) && !selectedCity}
                                onChange={(event) => handlePersonalInfoChange("city", event.target.value)}
                                placeholder={selectedProvince ? t("settings.personal.cityPlaceholder") : t("settings.personal.cityPlaceholderDisabled")}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] disabled:bg-slate-50 disabled:text-slate-500"
                              />
                              <datalist id="settings-city-options">
                                {filteredCityOptions.map((city) => <option key={city.code} value={city.name} />)}
                              </datalist>
                            </div>

                            <div>
                              <label htmlFor="settings-barangay" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.barangay")}</label>
                              <input
                                id="settings-barangay"
                                list="settings-barangay-options"
                                value={personalInfo.barangay}
                                maxLength={PROFILE_LIMITS.barangay}
                                disabled={!selectedCity || isLoadingBarangays || Boolean(barangayDataError)}
                                aria-invalid={Boolean(personalInfo.barangay) && !selectedBarangay}
                                aria-describedby={barangayDataError ? "settings-barangay-help" : undefined}
                                onChange={(event) => handlePersonalInfoChange("barangay", event.target.value)}
                                placeholder={!selectedCity ? t("settings.personal.barangayPlaceholderDisabled") : isLoadingBarangays ? t("settings.personal.barangayPlaceholderLoading") : t("settings.personal.barangayPlaceholder")}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] disabled:bg-slate-50 disabled:text-slate-500"
                              />
                              <datalist id="settings-barangay-options">
                                {barangayOptions.map((barangay) => <option key={barangay.code} value={barangay.name} />)}
                              </datalist>
                              {barangayDataError ? <p id="settings-barangay-help" className="mt-1 text-[12px] text-amber-800">{barangayDataError}</p> : null}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="settings-location-type" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.locationType")}</label>
                              <select
                                id="settings-location-type"
                                value={personalInfo.addressType}
                                onChange={(e) => handlePersonalInfoChange("addressType", e.target.value)}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="home">{t("settings.personal.locationTypeOptions.home")}</option>
                                <option value="office">{t("settings.personal.locationTypeOptions.office")}</option>
                                <option value="place">{t("settings.personal.locationTypeOptions.place")}</option>
                              </select>
                            </div>
                            <div>
                              <label htmlFor="settings-address" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.address")}</label>
                              <input
                                id="settings-address"
                                type="text"
                                list="settings-address-options"
                                value={personalInfo.address}
                                maxLength={PROFILE_LIMITS.address}
                                autoComplete="street-address"
                                aria-invalid={profileErrorField === "address"}
                                aria-describedby={profileErrorField === "address" ? "settings-profile-error" : undefined}
                                onChange={(e) => handlePersonalInfoChange("address", e.target.value)}
                                placeholder={personalInfo.addressType === "place" ? t("settings.personal.addressPlaceholderPlace") : t("settings.personal.addressPlaceholderDefault")}
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
                      )}

                      {!isAdminRole && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="settings-phone" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.phone")}</label>
                            <input
                              id="settings-phone"
                              type="tel"
                              value={personalInfo.phone}
                              autoComplete="tel"
                              inputMode="tel"
                              aria-invalid={profileErrorField === "phone"}
                              aria-describedby={profileErrorField === "phone" ? "settings-profile-error" : undefined}
                              maxLength={20}
                              onChange={(e) => handlePersonalInfoChange("phone", e.target.value)}
                              placeholder={t("settings.personal.phonePlaceholder")}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                            />
                          </div>
                          <div>
                            <label htmlFor="settings-employer-email" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.email")}</label>
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
                          <label htmlFor="settings-worker-email" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.email")}</label>
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
                            <label htmlFor="settings-about" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.about")}</label>
                            <textarea
                              id="settings-about"
                              value={personalInfo.about}
                              maxLength={PROFILE_LIMITS.about}
                              aria-invalid={profileErrorField === "about"}
                              aria-describedby={profileErrorField === "about" ? "settings-profile-error settings-about-count" : "settings-about-count"}
                              onChange={(e) => handlePersonalInfoChange("about", e.target.value)}
                              placeholder={t("settings.personal.aboutPlaceholder")}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all resize-none"
                              rows={4}
                            />
                            <p id="settings-about-count" className="mt-1 text-right text-[12px] text-[#64748B]">
                              {personalInfo.about.length}/{PROFILE_LIMITS.about}
                            </p>
                          </div>

                          <div>
                            <label htmlFor="settings-job-position" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.jobPosition")}</label>
                            <input
                              id="settings-job-position"
                              type="text"
                              value={personalInfo.jobPosition}
                              onChange={(e) => handlePersonalInfoChange("jobPosition", e.target.value)}
                              placeholder={t("settings.personal.jobPositionPlaceholder")}
                              maxLength={PROFILE_LIMITS.jobPosition}
                              aria-invalid={profileErrorField === "jobPosition"}
                              aria-describedby={profileErrorField === "jobPosition" ? "settings-profile-error" : undefined}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="settings-linkedin" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.linkedin")}</label>
                              <input
                                id="settings-linkedin"
                                type="url"
                                value={personalInfo.linkedin}
                                onChange={(e) => handlePersonalInfoChange("linkedin", e.target.value)}
                                placeholder={t("settings.personal.linkedinPlaceholder")}
                                maxLength={PROFILE_LIMITS.url}
                                autoComplete="url"
                                aria-invalid={profileErrorField === "linkedin"}
                                aria-describedby={profileErrorField === "linkedin" ? "settings-profile-error" : undefined}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              />
                            </div>
                            <div>
                              <label htmlFor="settings-website" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.website")}</label>
                              <input
                                id="settings-website"
                                type="url"
                                value={personalInfo.website}
                                onChange={(e) => handlePersonalInfoChange("website", e.target.value)}
                                placeholder={t("settings.personal.websitePlaceholder")}
                                maxLength={PROFILE_LIMITS.url}
                                autoComplete="url"
                                aria-invalid={profileErrorField === "website"}
                                aria-describedby={profileErrorField === "website" ? "settings-profile-error" : undefined}
                                className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label htmlFor="settings-experience" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.experienceLabel")}</label>
                            <select
                              id="settings-experience"
                              value={experienceStats.totalExperience}
                              onChange={(e) => setExperienceStats({ ...experienceStats, totalExperience: e.target.value })}
                              className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                            >
                              <option value="">{t("settings.personal.experienceOptions.select")}</option>
                              <option value="Less than 1 Year">{t("settings.personal.experienceOptions.lessThanOne")}</option>
                              <option value="1 Year">{t("settings.personal.experienceOptions.one")}</option>
                              <option value="2 Years">{t("settings.personal.experienceOptions.two")}</option>
                              <option value="3 Years">{t("settings.personal.experienceOptions.three")}</option>
                              <option value="4 Years">{t("settings.personal.experienceOptions.four")}</option>
                              <option value="5 Years">{t("settings.personal.experienceOptions.five")}</option>
                              <option value="6 Years">{t("settings.personal.experienceOptions.six")}</option>
                              <option value="7 Years">{t("settings.personal.experienceOptions.seven")}</option>
                              <option value="8 Years">{t("settings.personal.experienceOptions.eight")}</option>
                              <option value="9 Years">{t("settings.personal.experienceOptions.nine")}</option>
                              <option value="10+ Years">{t("settings.personal.experienceOptions.tenPlus")}</option>
                            </select>
                          </div>

                          <div>
                            <p className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.personal.photo")}</p>
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
                                    {t("settings.personal.changePhoto")}
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.gif,.webp"
                                      onChange={handlePhotoUpload}
                                      disabled={isAvatarSubmitting}
                                      aria-label="Choose a new profile photo"
                                      className="sr-only"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={handleDeletePhoto}
                                    disabled={isAvatarSubmitting}
                                    aria-busy={isAvatarSubmitting}
                                    className="text-[#EF4444] hover:bg-[#FEE2E2] px-6 py-2 rounded-[10px] transition-all text-[14px] font-medium border border-[#FCA5A5]"
                                  >
                                    {t("settings.personal.removePhoto")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="bg-[#1C4D8D] text-white font-semibold px-6 py-3 rounded-[10px] hover:opacity-90 transition-all cursor-pointer flex items-center gap-2 focus-within:ring-2 focus-within:ring-[#1C4D8D] focus-within:ring-offset-2">
                                  <Upload className="w-4 h-4" />
                                  {t("settings.personal.uploadPhoto")}
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.gif,.webp"
                                    onChange={handlePhotoUpload}
                                    disabled={isAvatarSubmitting}
                                    aria-label="Choose a profile photo"
                                    className="sr-only"
                                  />
                                </label>
                                <span className="text-[13px] text-[#64748B]">{t("settings.personal.photoHint")}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <button
                        type="submit"
                        disabled={isProfileSaving || isProfileLoading}
                        aria-busy={isProfileSaving || isProfileLoading}
                        className={`bg-[#1C4D8D] text-white font-semibold px-8 py-3 rounded-[10px] transition-all ${
                          isProfileSaving || isProfileLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
                        }`}
                      >
                        {isProfileSaving ? t("settings.personal.saving") : isProfileLoading ? t("settings.personal.loadingButton") : t("settings.personal.save")}
                      </button>
                </form>
              </div>
                  )}

                  {accountTab === "experience" && !isEmployerRole && (
                    <div
                      id="settings-account-panel-experience"
                      role="tabpanel"
                      aria-labelledby="settings-account-tab-experience"
                      className="space-y-6"
                    >
                      <div>
                        <h2 className="text-[18px] font-semibold text-[#111827]">{t("settings.experience.heading")}</h2>
                        <p className="text-[13px] text-[#6B7280]">{t("settings.experience.subtitle")}</p>
                      </div>

                      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6 space-y-5">
                        <div>
                          <h3 className="text-[16px] font-semibold text-[#1E293B]">
                            {editingExperienceId ? t("settings.experience.editHeading") : t("settings.experience.addHeading")}
                          </h3>
                          <p className="mt-1 text-[13px] text-[#64748B]">{t("settings.experience.formSubtitle")}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="experience-title" className="text-[13px] font-medium text-[#475569] mb-2 block">{t("settings.experience.jobTitle")}</label>
                            <input id="experience-title" value={experienceDraft.title} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, title: e.target.value }))} maxLength={100} placeholder={t("settings.experience.jobTitlePlaceholder")} className="w-full border border-[#E2E8F0] rounded-[10px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]" />
                          </div>
                          <div>
                            <label htmlFor="experience-company" className="text-[13px] font-medium text-[#475569] mb-2 block">{t("settings.experience.company")}</label>
                            <input id="experience-company" value={experienceDraft.company} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, company: e.target.value }))} maxLength={120} placeholder={t("settings.experience.companyPlaceholder")} className="w-full border border-[#E2E8F0] rounded-[10px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]" />
                          </div>
                          <div>
                            <label htmlFor="experience-location" className="text-[13px] font-medium text-[#475569] mb-2 block">{t("settings.experience.location")}</label>
                            <input id="experience-location" value={experienceDraft.location} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, location: e.target.value }))} maxLength={120} placeholder={t("settings.experience.locationPlaceholder")} className="w-full border border-[#E2E8F0] rounded-[10px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="experience-start" className="text-[13px] font-medium text-[#475569] mb-2 block">{t("settings.experience.start")}</label>
                              <input id="experience-start" type="month" value={experienceDraft.startDate} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, startDate: e.target.value }))} className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]" />
                            </div>
                            <div>
                              <label htmlFor="experience-end" className="text-[13px] font-medium text-[#475569] mb-2 block">{t("settings.experience.end")}</label>
                              <input id="experience-end" type="month" value={experienceDraft.endDate || ""} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, endDate: e.target.value }))} disabled={experienceDraft.current} className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D] disabled:bg-[#F1F5F9]" />
                            </div>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-[13px] text-[#475569] cursor-pointer">
                          <input type="checkbox" checked={experienceDraft.current} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, current: e.target.checked, endDate: e.target.checked ? "" : prev.endDate }))} className="w-4 h-4" />
                          {t("settings.experience.current")}
                        </label>

                        <div>
                          <label htmlFor="experience-description" className="text-[13px] font-medium text-[#475569] mb-2 block">{t("settings.experience.description")}</label>
                          <textarea id="experience-description" value={experienceDraft.description} onChange={(e) => setExperienceDraft((prev) => ({ ...prev, description: e.target.value }))} maxLength={1000} rows={3} placeholder={t("settings.experience.descriptionPlaceholder")} className="w-full border border-[#E2E8F0] rounded-[10px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D] resize-none" />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={handleSaveExperience} disabled={isExperienceSaving} className="bg-[#1C4D8D] text-white font-semibold px-5 py-2.5 rounded-[10px] disabled:opacity-60">
                            {isExperienceSaving ? t("settings.experience.saving") : editingExperienceId ? t("settings.experience.save") : t("settings.experience.add")}
                          </button>
                          {editingExperienceId && (
                            <button type="button" onClick={resetExperienceEditor} className="bg-[#F1F5F9] text-[#475569] font-semibold px-5 py-2.5 rounded-[10px]">{t("settings.experience.cancel")}</button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[16px] font-semibold text-[#1E293B]">{t("settings.experience.historyHeading")}</h3>
                          <span className="text-[12px] text-[#64748B]">{t("settings.experience.entry", { count: workExperiences.length })}</span>
                        </div>
                        {workExperiences.length ? workExperiences.map((item) => (
                          <div key={item.id} className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-5 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-[#1E293B]">{item.title}</p>
                              <p className="text-[13px] text-[#475569]">{[item.company, item.location].filter(Boolean).join(" · ")}</p>
                              <p className="mt-1 text-[12px] text-[#64748B]">{formatExperienceMonth(item.startDate)} – {item.current ? t("settings.experience.present") : formatExperienceMonth(item.endDate)}</p>
                              {item.description ? <p className="mt-3 text-[13px] text-[#475569] whitespace-pre-line">{item.description}</p> : null}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button type="button" onClick={() => handleEditExperience(item)} className="text-[12px] font-semibold text-[#1C4D8D] px-3 py-2 rounded-[8px] hover:bg-[#DBEAFE]">{t("settings.experience.edit")}</button>
                              <button type="button" onClick={() => setDeleteExperienceTarget(item)} aria-label={t("settings.experience.deleteAria", { title: item.title })} className="text-[#EF4444] p-2 rounded-[8px] hover:bg-[#FEE2E2]"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-[14px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center text-[13px] text-[#64748B]">{t("settings.experience.empty")}</div>
                        )}
                      </div>

                      <div className="bg-[#1C4D8D]/[0.08] border border-[#1C4D8D]/20 rounded-[16px] p-6">
                        <h3 className="text-[16px] font-semibold text-[#1e293b] mb-4">{t("settings.skills.addNew")}</h3>
                        <div className="space-y-4">
                          {/* Skill Selection Mode */}
                          <div>
                            <p className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.skills.chooseOption")}</p>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="skillMode"
                                  checked={skillSelectionMode === "predefined"}
                                  onChange={() => setSkillSelectionMode("predefined")}
                                  className="w-4 h-4 text-[#1C4D8D]"
                                />
                                <span className="text-[14px] text-[#475569]">{t("settings.skills.selectFromList")}</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="skillMode"
                                  checked={skillSelectionMode === "custom"}
                                  onChange={() => setSkillSelectionMode("custom")}
                                  className="w-4 h-4 text-[#1C4D8D]"
                                />
                                <span className="text-[14px] text-[#475569]">{t("settings.skills.customSkill")}</span>
                              </label>
                            </div>
                          </div>

                          {/* Skill Name Input */}
                          <div>
                            <p id="settings-skill-name-label" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.skills.skillName")}</p>
                            {skillSelectionMode === "predefined" ? (
                              <select
                                aria-labelledby="settings-skill-name-label"
                                value={selectedPredefinedSkill}
                                onChange={(e) => setSelectedPredefinedSkill(e.target.value)}
                                className="w-full bg-white border border-[#1C4D8D]/20 rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                              >
                                <option value="">{t("settings.skills.selectPlaceholder")}</option>
                                {SKILL_CATALOG.map((category) => (
                                  <optgroup
                                    key={category.categoryKey}
                                    label={t(`settings.skills.catalog.categories.${category.categoryKey}`)}
                                  >
                                    {category.items.map((item) => (
                                      <option key={item.key} value={item.value}>
                                        {t(`settings.skills.catalog.items.${item.key}`)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-labelledby="settings-skill-name-label"
                                type="text"
                                value={newSkillName}
                                maxLength={PROFILE_LIMITS.skillName}
                                onChange={(e) => setNewSkillName(e.target.value)}
                                placeholder={t("settings.skills.customPlaceholder")}
                                className="w-full bg-white border border-[#1C4D8D]/20 rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleAddSkill();
                                  }
                                }}
                              />
                            )}
                          </div>

                          <div>
                            <label htmlFor="settings-skill-description" className="text-[14px] font-medium text-[#475569] mb-2 block">{t("settings.skills.descriptionLabel")}</label>
                            <textarea
                              id="settings-skill-description"
                              value={newSkillDescription}
                              maxLength={PROFILE_LIMITS.skillDescription}
                              aria-describedby="settings-skill-description-count"
                              onChange={(e) => setNewSkillDescription(e.target.value)}
                              placeholder={t("settings.skills.descriptionPlaceholder")}
                              className="w-full bg-white border border-[#1C4D8D]/20 rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all resize-none"
                              rows={3}
                            />
                            <p id="settings-skill-description-count" className="mt-1 text-right text-[12px] text-[#64748B]">
                              {newSkillDescription.length}/{PROFILE_LIMITS.skillDescription}
                            </p>
                          </div>

                          <button
                            onClick={handleAddSkill}
                            disabled={Boolean(skillMutationId)}
                            aria-busy={skillMutationId === "new"}
                            className="w-full bg-[#1C4D8D] text-white font-semibold py-2.5 px-4 rounded-[10px] hover:opacity-90 transition-all"
                          >
                            {skillMutationId === "new" ? t("settings.skills.saving") : t("settings.skills.add")}
                          </button>
                        </div>
                      </div>

                      {skills.length > 0 ? (
                        <div>
                          <h3 className="text-[14px] font-semibold text-[#111827] mb-3">{t("settings.skills.yourSkills")}</h3>
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
                                        aria-label={t("settings.skills.descriptionForAria", { name: skill.name })}
                                        value={editingSkillDescription}
                                        maxLength={PROFILE_LIMITS.skillDescription}
                                        onChange={(e) => setEditingSkillDescription(e.target.value)}
                                        placeholder={t("settings.skills.descriptionEditPlaceholder")}
                                        className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] text-[#111827] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all resize-none"
                                        rows={3}
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleEditSkillDescription(skill.id)}
                                          disabled={skillMutationId === skill.id}
                                          className="bg-[#1C4D8D] text-white text-[12px] font-semibold px-3 py-2 rounded-[8px] hover:opacity-90 transition-all"
                                        >
                                          {skillMutationId === skill.id ? t("settings.skills.saving") : t("settings.skills.saveNote")}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingSkillId(null);
                                            setEditingSkillDescription("");
                                          }}
                                          className="bg-[#F3F4F6] text-[#374151] text-[12px] font-semibold px-3 py-2 rounded-[8px] hover:bg-[#E5E7EB] transition-all"
                                        >
                                          {t("settings.skills.cancel")}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="mt-2 text-[13px] text-[#64748B]">
                                        {skill.description?.trim() || t("settings.skills.noDescription")}
                                      </p>
                                      <div className="flex items-center gap-2 mt-3">
                                        <button
                                          onClick={() => {
                                            setEditingSkillId(skill.id);
                                            setEditingSkillDescription(skill.description || "");
                                          }}
                                          className="text-[12px] font-semibold text-[#1C4D8D] hover:opacity-80"
                                        >
                                          {t("settings.skills.editDescription")}
                                        </button>
                                        {skill.endorsements ? (
                                          <span className="text-[12px] text-[#64748B]">{t("settings.skills.endorsements", { count: skill.endorsements })}</span>
                                        ) : null}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSkill(skill.id)}
                                  disabled={skillMutationId === skill.id}
                                  aria-label={t("settings.skills.deleteAria", { name: skill.name })}
                                  aria-busy={skillMutationId === skill.id}
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
                          <p className="text-[14px] text-[#64748B] mb-2">{t("settings.skills.emptyTitle")}</p>
                          <p className="text-[12px] text-[#94A3B8]">{t("settings.skills.emptySubtitle")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {accountTab === "resume" && !isEmployerRole && (
                    <div
                      id="settings-account-panel-resume"
                      role="tabpanel"
                      aria-labelledby="settings-account-tab-resume"
                    >
                      <WorkerResumeSection initialResumeUrl={resumeUrl} />
                    </div>
                  )}
                </div>
          )}

          {activeTab === "privacy" && (
            <div
              id="settings-main-panel-privacy"
              role="tabpanel"
              aria-labelledby="settings-main-tab-privacy"
              className="space-y-6"
            >
              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <div className="mb-6">
                  <h2 className="text-[20px] font-semibold text-[#111827]">{t("settings.password.heading")}</h2>
                  <p className="text-[13px] text-[#6B7280]">
                    {t("settings.password.subtitle")}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="settings-current-password" className="text-[13px] text-[#6B7280]">{t("settings.password.current")}</label>
                    <div className="relative">
                      <input
                        id="settings-current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                        className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? t("settings.password.hideCurrent") : t("settings.password.showCurrent")}
                        aria-pressed={showCurrentPassword}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-[12px] text-[#475569]">
                    {t("settings.password.otpHint")}
                  </div>

                  <div>
                    <button
                      onClick={handleRequestPasswordOtp}
                      disabled={isOtpSending}
                      className="px-5 py-2.5 bg-[#0F766E] text-white rounded-full text-[13px] font-semibold disabled:opacity-60"
                    >
                      {isOtpSending ? t("settings.password.sendingOtp") : passwordOtpRequested ? t("settings.password.resendOtp") : t("settings.password.sendOtp")}
                    </button>
                  </div>

                  <div>
                    <label htmlFor="settings-password-otp" className="text-[13px] text-[#6B7280]">{t("settings.password.otpLabel")}</label>
                    <input
                      id="settings-password-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label={t("settings.password.otpAria")}
                      value={passwordOtp}
                      onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("settings.password.otpPlaceholder")}
                      className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-new-password" className="text-[13px] text-[#6B7280]">{t("settings.password.new")}</label>
                      <div className="relative">
                        <input
                          id="settings-new-password"
                          type={showNewPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={securityData.newPassword}
                          onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                          className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? t("settings.password.hideNew") : t("settings.password.showNew")}
                          aria-pressed={showNewPassword}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="settings-confirm-password" className="text-[13px] text-[#6B7280]">{t("settings.password.confirm")}</label>
                      <div className="relative">
                        <input
                          id="settings-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={securityData.confirmPassword}
                          onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                          className="w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? t("settings.password.hideConfirm") : t("settings.password.showConfirm")}
                          aria-pressed={showConfirmPassword}
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
                    {t("settings.password.discard")}
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={isPasswordSubmitting}
                    className="px-6 py-2.5 bg-[#1C4D8D] text-white rounded-full text-[14px] font-semibold disabled:opacity-60"
                  >
                    {isPasswordSubmitting ? t("settings.password.saving") : t("settings.password.save")}
                  </button>
                </div>
              </div>

              <MfaSettingsCard />

              {hasEmployerAccess && <EmployerPrivacyCard initialValue={hideHiredCandidates} />}

              <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[16px] font-semibold text-[#111827]">{t("settings.sessions.heading")}</h3>
                  {sessions.length > 0 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      className="text-[#EF4444] hover:bg-[#FEE2E2] px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors"
                    >
                      {t("settings.sessions.signOutAll")}
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-[#6B7280] mb-4">
                  {t("settings.sessions.subtitle")}
                </p>
                <div className="space-y-4">
                  {isLoadingSessions ? (
                    <p className="text-[13px] text-[#6B7280]">{t("settings.sessions.loading")}</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-[13px] text-[#6B7280]">{t("settings.sessions.empty")}</p>
                  ) : (
                    sessions.map((session, index) => (
                      <div key={session.id} className="border border-[#E5E7EB] rounded-[12px] p-4">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-[13px] font-semibold text-[#111827]">{t("settings.sessions.sessionLabel", { number: index + 1 })}</p>
                          {!session.current && (
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              className="text-[#EF4444] hover:bg-[#FEE2E2] px-3 py-1 rounded-[8px] text-[12px] font-medium transition-colors"
                            >
                              {t("settings.sessions.revoke")}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[12px] text-[#6B7280]">{t("settings.sessions.currentQuestion")}</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.current ? t("settings.sessions.yes") : t("settings.sessions.no")}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">{t("settings.sessions.device")}</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.device}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">{t("settings.sessions.ip")}</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.ip}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">{t("settings.sessions.location")}</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.location}</p>
                          </div>
                          <div>
                            <p className="text-[12px] text-[#6B7280]">{t("settings.sessions.lastActive")}</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{session.lastActive}</p>
                          </div>
                          <div className="flex items-end">
                            <span
                              className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
                                session.current ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#E2E8F0] text-[#475569]"
                              }`}
                            >
                              {session.current ? t("settings.sessions.currentBadge") : t("settings.sessions.signedInBadge")}
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
                  <h3 className="text-[16px] font-semibold text-[#111827] mb-2">{t("settings.verification.heading")}</h3>
                  <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[12px] p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[14px] text-[#64748B]">{t("settings.verification.statusLabel")}</p>
                        <h4 className="text-[18px] font-semibold text-[#111827]">
                          {isProfileVerified ? t("settings.verification.verified") : t("settings.verification.incomplete")}
                        </h4>
                        <p className="text-[12px] text-[#64748B] mt-1">
                          {isProfileVerified ? t("settings.verification.verifiedSubtitle") : t("settings.verification.incompleteSubtitle")}
                        </p>
                      </div>
                      <span className="text-[12px] font-semibold px-3 py-1 rounded-full bg-[#DCFCE7] text-[#166534]">
                        {t("settings.verification.percentComplete", { percent: verificationCompletionPercent })}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div
                        className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden"
                        role="progressbar"
                        aria-label={t("settings.verification.progressAria")}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={verificationCompletionPercent}
                      >
                        <div className="h-full bg-[#22C55E]" style={{ width: `${verificationCompletionPercent}%` }} />
                      </div>
                      <p className="text-[12px] text-[#64748B] mt-2">
                        {t("settings.verification.stepsCompleted", { completed: completedSteps, total: verificationStepsData.length })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {isLoadingVerification ? (
                      <p className="text-[13px] text-[#6B7280]">{t("settings.verification.loading")}</p>
                    ) : (
                      verificationStepsData.map((step) => {
                      const statusBadge = verificationStatusStyles[step.status];
                      const statusLabel = verificationStatusLabels[step.status];
                      const iconBg =
                        step.status === "complete"
                          ? "bg-[#DCFCE7]"
                          : step.status === "in-review"
                            ? "bg-[#FEF3C7]"
                            : step.status === "rejected"
                              ? "bg-[#FEE2E2]"
                              : "bg-[#E2E8F0]";
                      const icon =
                        step.status === "complete" ? (
                          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                        ) : step.status === "in-review" ? (
                          <Clock className="w-5 h-5 text-[#D97706]" />
                        ) : step.status === "rejected" ? (
                          <Circle className="w-5 h-5 text-[#DC2626]" />
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
                                          ? t("settings.verification.sendingCode")
                                          : phoneCodeRequested
                                            ? t("settings.verification.resendCode")
                                            : t("settings.verification.sendCode")}
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
                                          autoComplete="one-time-code"
                                          aria-label={t("settings.verification.codeAria")}
                                          maxLength={6}
                                          value={phoneVerificationCode}
                                          onChange={(event) =>
                                            setPhoneVerificationCode(
                                              event.target.value.replace(/[^\d]/g, "").slice(0, 6)
                                            )
                                          }
                                          placeholder={t("settings.verification.codePlaceholder")}
                                          className="w-[180px] bg-white border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[12px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1C4D8D]"
                                        />
                                        <button
                                          onClick={handleConfirmPhoneCode}
                                          disabled={isConfirmingPhoneCode}
                                          className="px-4 py-2 border border-[#1C4D8D] text-[#1C4D8D] text-[12px] font-semibold rounded-[8px] hover:opacity-90/[0.06] disabled:opacity-60"
                                        >
                                          {isConfirmingPhoneCode ? t("settings.verification.verifying") : t("settings.verification.confirmCode")}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {step.id === "identity" && (step.status === "pending" || step.status === "rejected") && (
                                  <div className="mt-2">
                                    <IdAnalyzerVerifier
                                      profileId={import.meta.env.VITE_KYC_PROFILE_ID}
                                      onComplete={async () => { await reloadVerificationStatus(); }}
                                    />
                                  </div>
                                )}

                                {step.id === "address" && (step.status === "pending" || step.status === "rejected") && (
                                  <label className="mt-2 inline-block px-4 py-2 bg-[#1C4D8D] text-white text-[12px] rounded-[8px] hover:opacity-90 cursor-pointer">
                                    {step.status === "rejected" ? t("settings.verification.uploadReplacement") : t("settings.verification.uploadDocument")}
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

              <DeleteAccountCard />
            </div>
          )}

          {activeTab === "payments" && hasEmployerAccess && (
            <div
              id="settings-main-panel-payments"
              role="tabpanel"
              aria-labelledby="settings-main-tab-payments"
            >
              <EmployerPaymentMethodsSection />
            </div>
          )}

      </div>
      <ConfirmDialog
        open={Boolean(deleteExperienceTarget)}
        title={t("settings.deleteExperienceDialog.title")}
        description={t("settings.deleteExperienceDialog.description", {
          title: deleteExperienceTarget?.title || t("settings.deleteExperienceDialog.fallbackTitle"),
        })}
        confirmLabel={t("settings.deleteExperienceDialog.confirmLabel")}
        destructive
        pending={Boolean(deletingExperienceId)}
        onClose={() => setDeleteExperienceTarget(null)}
        onConfirm={() => deleteExperienceTarget && handleDeleteExperience(deleteExperienceTarget.id)}
      />
    </div>
  );
}
