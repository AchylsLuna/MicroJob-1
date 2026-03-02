import { useEffect, useState } from "react";
import { Eye, EyeOff, Upload, Trash2, CheckCircle2, Clock, Circle } from "lucide-react";
import { toast } from "../lib/toast";
import { useSearchParams } from "react-router-dom";
import { getProfile, updateProfile } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type TabType = "account" | "privacy" | "payments";
type AccountTab = "personal" | "experience" | "resume";

const accountTabConfig: { id: AccountTab; label: string }[] = [
  { id: "personal", label: "Personal Information" },
  { id: "experience", label: "Experience" },
  { id: "resume", label: "CV/Resume" },
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

const verificationSteps: VerificationStep[] = [
  {
    id: "email",
    title: "Email address",
    description: "Confirm the email you use to sign in and receive alerts.",
    status: "complete",
  },
  {
    id: "phone",
    title: "Phone number",
    description: "Add a verified phone for account recovery and security checks.",
    status: "complete",
  },
  {
    id: "identity",
    title: "Government ID",
    description: "Upload a valid ID to prove your identity.",
    status: "complete",
  },
  {
    id: "address",
    title: "Proof of address",
    description: "Provide a recent utility bill or bank statement.",
    status: "complete",
  },
];

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

interface Experience {
  id: string;
  position: string;
  company: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
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
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const completedSteps = verificationSteps.filter((step) => step.status === "complete").length;
  const completionPercent = Math.round((completedSteps / verificationSteps.length) * 100);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "Jonas",
    lastName: "Dela Cruz",
    city: "Manila",
    country: "Philippines",
    phone: "+63 912 345 6789",
    email: "jonas.delacruz@email.com",
    linkedin: "linkedin.com/in/jonasdelacruz",
    photo: null as File | null,
  });

  const [experiences, setExperiences] = useState<Experience[]>([
    {
      id: "1",
      position: "Senior Frontend Developer",
      company: "Tech Solutions Inc.",
      startDate: "2022-01",
      endDate: "2024-01",
      current: false,
      description: "Led development of React-based applications",
    },
  ]);

  const [newExperience, setNewExperience] = useState({
    position: "",
    company: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
  });
  const [experienceLogo, setExperienceLogo] = useState<File | null>(null);

  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [resume, setResume] = useState<File | null>(null);

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

  const sessions: SessionInfo[] = [
    {
      id: "session-1",
      current: true,
      device: "MacBook Pro, Chrome",
      location: "Manila, Philippines",
      ip: "192.168.0.1",
      lastActive: "Feb 1, 2026, 9:24 AM",
    },
    {
      id: "session-2",
      current: false,
      device: "iPhone 15, Safari",
      location: "Makati, Philippines",
      ip: "192.168.1.14",
      lastActive: "Jan 28, 2026, 6:12 PM",
    },
  ];

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
    if (mappedAccountTab) {
      if (mappedAccountTab !== accountTab) {
        setAccountTab(mappedAccountTab);
      }
      return;
    }
    if (tabParam === "account" && accountTab !== "personal") {
      setAccountTab("personal");
    }
  }, [activeTab, accountTab, searchParams]);

  const handleAccountTabChange = (tab: AccountTab) => {
    setAccountTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const handlePersonalInfoChange = (field: string, value: string) => {
    setPersonalInfo({ ...personalInfo, [field]: value });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPersonalInfo({ ...personalInfo, photo: file });
      toast.success("Photo uploaded successfully!");
    }
  };

  useEffect(() => {
    if (!user) return;
    setPersonalInfo((prev) => ({
      ...prev,
      firstName: user.firstName || prev.firstName,
      lastName: user.lastName || prev.lastName,
      email: user.email || prev.email,
      phone: user.phoneNumber || prev.phone,
      city: user.city || prev.city,
      country: user.country || prev.country,
      linkedin: user.linkedin || prev.linkedin,
    }));
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
          email: profile.email || prev.email,
          phone: profile.phoneNumber || prev.phone,
          city: profile.city || prev.city,
          country: profile.country || prev.country,
          linkedin: profile.linkedin || prev.linkedin,
        }));
        updateAuthProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          city: profile.city,
          country: profile.country,
          linkedin: profile.linkedin,
          avatarUrl: profile.avatarUrl,
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
      const response = await updateProfile({
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        phoneNumber: personalInfo.phone,
        city: personalInfo.city,
        country: personalInfo.country,
        linkedin: personalInfo.linkedin,
      });
      const updated = (response as any)?.user ?? response;
      updateAuthProfile({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phoneNumber: updated.phoneNumber,
        city: updated.city,
        country: updated.country,
        linkedin: updated.linkedin,
        avatarUrl: updated.avatarUrl,
      });
      toast.success("Personal information saved successfully!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save personal information.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleAddExperience = () => {
    if (!newExperience.position || !newExperience.company || !newExperience.startDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    const experience: Experience = {
      id: Date.now().toString(),
      ...newExperience,
    };

    setExperiences([...experiences, experience]);
    setNewExperience({
      position: "",
      company: "",
      startDate: "",
      endDate: "",
      current: false,
      description: "",
    });
    setExperienceLogo(null);
    toast.success("Experience added successfully!");
  };

  const handleDeleteExperience = (id: string) => {
    setExperiences(experiences.filter((exp) => exp.id !== id));
    toast.success("Experience deleted");
  };

  const handleExperienceLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExperienceLogo(file);
      toast.success("Logo uploaded successfully!");
    }
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResume(file);
      toast.success("Resume uploaded successfully!");
    }
  };

  const handleDeleteResume = () => {
    setResume(null);
    toast.success("Resume deleted");
  };

  const handleChangePassword = () => {
    if (!securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    toast.success("Password changed successfully!");
    setSecurityData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleDiscardPassword = () => {
    setSecurityData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
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

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-[16px]">
        <section className="p-6 space-y-6">
          {activeTab === "account" && (
            <div className="space-y-6">
              <div className="bg-white rounded-[16px] border border-[#E5E7EB]">
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-4 mb-6">
                    {accountTabConfig.map((subTab) => (
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">City</label>
                          <input
                            type="text"
                            value={personalInfo.city}
                            onChange={(e) => handlePersonalInfoChange("city", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Country</label>
                          <input
                            type="text"
                            value={personalInfo.country}
                            onChange={(e) => handlePersonalInfoChange("country", e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

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
                        <label className="text-[14px] font-medium text-[#475569] mb-2 block">Profile photo</label>
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
                      </div>

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
                        <h2 className="text-[18px] font-semibold text-[#111827]">Experience</h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Job position</label>
                          <input
                            type="text"
                            value={newExperience.position}
                            onChange={(e) => setNewExperience({ ...newExperience, position: e.target.value })}
                            placeholder="Job position"
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Company name</label>
                          <input
                            type="text"
                            value={newExperience.company}
                            onChange={(e) => setNewExperience({ ...newExperience, company: e.target.value })}
                            placeholder="Company name"
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">Start date</label>
                          <input
                            type="month"
                            value={newExperience.startDate}
                            onChange={(e) => setNewExperience({ ...newExperience, startDate: e.target.value })}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[14px] font-medium text-[#475569] mb-2 block">End date</label>
                          <input
                            type="month"
                            value={newExperience.endDate}
                            onChange={(e) => setNewExperience({ ...newExperience, endDate: e.target.value })}
                            className="w-full bg-white border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-[#C7D2FE] text-[#1D4ED8] text-[13px] font-semibold cursor-pointer hover:bg-[#EEF2FF] transition-colors">
                            <Upload className="w-4 h-4" />
                            Upload your logo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleExperienceLogoUpload}
                              className="hidden"
                            />
                          </label>
                          <span className="text-[12px] text-[#94A3B8]">(jpg/png format/optional)</span>
                          {experienceLogo && (
                            <span className="text-[12px] text-[#64748B]">{experienceLogo.name}</span>
                          )}
                        </div>
                        <button
                          onClick={handleAddExperience}
                          className="bg-[#3B82F6] text-white font-semibold px-6 py-2.5 rounded-[10px] hover:bg-[#2563EB] transition-all"
                        >
                          Add Experience
                        </button>
                      </div>

                      {experiences.length > 0 && (
                        <div className="pt-6 border-t border-[#E5E7EB]">
                          <h3 className="text-[14px] font-semibold text-[#111827] mb-3">Saved experience</h3>
                          <div className="space-y-3">
                            {experiences.map((exp) => (
                              <div
                                key={exp.id}
                                className="flex items-center justify-between bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] px-4 py-3"
                              >
                                <div>
                                  <p className="text-[14px] font-semibold text-[#111827]">{exp.position}</p>
                                  <p className="text-[12px] text-[#64748B]">
                                    {exp.company} • {exp.startDate} - {exp.current ? "Present" : exp.endDate || "Present"}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteExperience(exp.id)}
                                  className="text-[#EF4444] hover:bg-[#FEE2E2] p-2 rounded-[8px] transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
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
                      {resume ? (
                        <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[12px] p-4 flex items-center justify-between">
                          <div>
                            <p className="text-[14px] font-semibold text-[#111827]">{resume.name}</p>
                            <p className="text-[12px] text-[#64748B]">{(resume.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <button
                            onClick={handleDeleteResume}
                            className="text-[#EF4444] hover:bg-[#FEE2E2] p-2 rounded-[8px]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                    className="px-6 py-2.5 bg-[#4F46E5] text-white rounded-full text-[14px] font-semibold"
                  >
                    Save New Password
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
                <h3 className="text-[16px] font-semibold text-[#111827] mb-2">Active Sessions</h3>
                <p className="text-[13px] text-[#6B7280] mb-4">
                  See your currently logged in sessions and remove unrecognized ones.
                </p>
                <div className="space-y-4">
                  {sessions.map((session, index) => (
                    <div key={session.id} className="border border-[#E5E7EB] rounded-[12px] p-4">
                      <p className="text-[13px] font-semibold text-[#111827] mb-3">Session {index + 1}</p>
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
                  ))}
                </div>
              </div>

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
                      {completionPercent}% complete
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#22C55E]" style={{ width: `${completionPercent}%` }} />
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-2">
                      {completedSteps} of {verificationSteps.length} steps completed
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {verificationSteps.map((step) => {
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
                            <div>
                              <p className="text-[15px] font-semibold text-[#1E293B]">{step.title}</p>
                              <p className="text-[13px] text-[#64748B] mt-1">{step.description}</p>
                            </div>
                          </div>
                          <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${statusBadge}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
