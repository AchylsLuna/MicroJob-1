import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "../lib/toast";
import {
  loginUser,
  registerUser,
  sendOtp,
  verifyOtp,
  logoutUser,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from "../services/api";
import { getPasswordStrength, STRONG_PASSWORD_ERROR } from "../lib/passwordPolicy";
import {
  EMAIL_VALIDATION_MESSAGE,
  FULL_NAME_VALIDATION_MESSAGE,
  PHONE_VALIDATION_MESSAGE,
  isValidEmail,
  isValidFullName,
  isValidPhone,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from "../lib/authValidation";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "employer" | "admin" | "both";
  accountType: "worker" | "employer";
  accountOptions: ("worker" | "employer")[];
  accountPreference?: "worker" | "employer" | "both";
  isVerified: boolean;
  avatar?: string;
  phoneNumber?: string;
  city?: string;
  country?: string;
  linkedin?: string;
  about?: string;
  avatarUrl?: string;
  resumeUrl?: string;
  employerBalance?: number;
  workerBalance?: number;
  createdAt?: string;
  user_type?: string;
  userType?: string;
  totalExperience?: string;
  projectsCompleted?: number;
  jobsApplied?: number;
  successRate?: string;
  skills?: Array<{
    _id?: string;
    id?: string;
    name: string;
    level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    endorsements?: number;
    createdAt?: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, options?: { suppressToast?: boolean; requireOtp?: boolean }) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    accountPreference: "employer" | "worker" | "both",
    phoneNumber?: string,
  ) => Promise<void>;
  logout: (options?: { silent?: boolean }) => void;
  switchAccountType: (nextType: "employer" | "worker") => void;
  verifyOTP: (otp: string) => Promise<boolean>;
  resendOTP: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (code: string, newPassword: string) => Promise<void>;
  pendingVerification: { email: string; name: string; flow?: "signup" | "signin" } | null;
  updateProfile: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = "current_user";
const AUTH_USER_KEY = "auth_user";
const AUTH_TOKEN_KEY = "auth_token";
const LEGACY_TOKEN_KEY = "token";
const PENDING_VERIFICATION_EMAIL_KEY = "pending_verification_email";
const PENDING_VERIFICATION_NAME_KEY = "pending_verification_name";
const PENDING_VERIFICATION_FLOW_KEY = "pending_verification_flow";

type AccountPreference = "employer" | "worker" | "both";

const normalizeRole = (role?: string | null): User["role"] => {
  const value = String(role || "").toLowerCase();
  if (value === "admin" || value === "superadmin") {
    return "admin";
  }
  if (value === "both") {
    return "both";
  }
  if (value === "doctor" || value === "hire" || value === "employer") {
    return "employer";
  }
  return "user";
};

const getRoleCandidate = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const user = value as { role?: string | null; user_type?: string | null; userType?: string | null };
  return user.role ?? user.user_type ?? user.userType ?? null;
};

const normalizeAccountType = (value?: string | null): User["accountType"] | null => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "doctor" || normalized === "employer" || normalized === "hire") {
    return "employer";
  }
  if (
    normalized === "patient" ||
    normalized === "worker" ||
    normalized === "work" ||
    normalized === "user"
  ) {
    return "worker";
  }
  return null;
};

const normalizePreference = (value?: string | null): AccountPreference | undefined => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "doctor" || normalized === "employer" || normalized === "hire") {
    return "employer";
  }
  if (normalized === "patient" || normalized === "worker" || normalized === "work" || normalized === "user") {
    return "worker";
  }
  if (normalized === "both") {
    return "both";
  }
  return undefined;
};

const getPreferenceCandidate = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const user = value as {
    accountPreference?: string | null;
    accountType?: string | null;
    preferredAccount?: string | null;
    role?: string | null;
    user_type?: string | null;
    userType?: string | null;
  };

  return (
    user.accountPreference ??
    user.accountType ??
    user.preferredAccount ??
    user.role ??
    user.user_type ??
    user.userType ??
    null
  );
};

const normalizeAccountOptions = (value: unknown): User["accountOptions"] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const mapped = value
    .map((item) => normalizeAccountType(typeof item === "string" ? item : null))
    .filter((item): item is User["accountType"] => Boolean(item));
  return Array.from(new Set(mapped));
};

const normalizeAccount = (
  role: User["role"],
  preferred?: string | null,
): { accountType: User["accountType"]; accountOptions: User["accountOptions"] } => {
  const normalizedPreferred = normalizePreference(preferred);
  if (normalizedPreferred === "employer") {
    return { accountType: "employer", accountOptions: ["employer"] };
  }
  if (normalizedPreferred === "worker") {
    return { accountType: "worker", accountOptions: ["worker"] };
  }
  if (normalizedPreferred === "both" || role === "both") {
    return {
      accountType: role === "employer" ? "employer" : "worker",
      accountOptions: ["employer", "worker"],
    };
  }
  if (role === "employer") {
    return { accountType: "employer", accountOptions: ["employer"] };
  }
  return { accountType: "worker", accountOptions: ["worker"] };
};

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "User";
  const lastName = parts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
};

const getAuthPayload = (response: any) => {
  const container = response?.data && typeof response.data === "object" ? response.data : response;
  return {
    user: container?.user ?? response?.user ?? null,
    token: container?.token ?? response?.token ?? null,
  };
};

const getUserId = (apiUser: any): string => {
  if (!apiUser) return "";
  return String(apiUser.id || apiUser._id || apiUser.userId || "");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    name: string;
    flow?: "signup" | "signin";
  } | null>(null);

  useEffect(() => {
    const syncSessionFromStorage = () => {
      const currentUser = localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
      if (!currentUser) {
        setUser(null);
      } else {
        try {
          const parsed = JSON.parse(currentUser) as Partial<User> & {
            role?: string | null;
            user_type?: string | null;
            accountType?: string | null;
            accountPreference?: string | null;
            accountOptions?: unknown;
          };
          const normalizedRole = normalizeRole(getRoleCandidate(parsed));
          const preferredAccount = getPreferenceCandidate(parsed);
          const parsedAccountType = normalizeAccountType(parsed.accountType);
          const { accountType: derivedAccountType, accountOptions } = normalizeAccount(normalizedRole, preferredAccount);
          const normalizedOptions = normalizeAccountOptions(parsed.accountOptions);
          const normalizedUser = {
            ...parsed,
            role: normalizedRole,
            accountType: parsedAccountType || derivedAccountType,
            accountPreference: normalizePreference(preferredAccount) || undefined,
            accountOptions: normalizedOptions.length > 0 ? normalizedOptions : [...accountOptions],
          } as User;
          console.log("AuthProvider - Setting user from localStorage:", normalizedUser);
          setUser(normalizedUser);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalizedUser));
        } catch {
          localStorage.removeItem(AUTH_USER_KEY);
          localStorage.removeItem(CURRENT_USER_KEY);
          setUser(null);
        }
      }

      const pendingEmail = localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
      if (pendingEmail) {
        const pendingName = localStorage.getItem(PENDING_VERIFICATION_NAME_KEY) || "User";
        const flowValue = localStorage.getItem(PENDING_VERIFICATION_FLOW_KEY);
        const pendingFlow =
          flowValue === "signup" || flowValue === "signin" ? flowValue : undefined;
        setPendingVerification({ email: pendingEmail, name: pendingName, flow: pendingFlow });
      } else {
        setPendingVerification(null);
      }
    };

    syncSessionFromStorage();
    const handleAuthUserUpdated = () => {
      console.log("AuthProvider - auth_user_updated event received, re-syncing from storage");
      syncSessionFromStorage();
    };
    window.addEventListener("auth_user_updated", handleAuthUserUpdated);
    setIsLoading(false);
    return () => window.removeEventListener("auth_user_updated", handleAuthUserUpdated);
  }, []);

  const register = async (
    email: string,
    password: string,
    name: string,
    accountPreference: "employer" | "worker" | "both",
    phoneNumber?: string,
  ) => {
    if (!getPasswordStrength(password).isStrong) {
      throw new Error(STRONG_PASSWORD_ERROR);
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new Error(EMAIL_VALIDATION_MESSAGE);
    }

    const normalizedName = normalizeFullName(name);
    if (!isValidFullName(normalizedName)) {
      throw new Error(FULL_NAME_VALIDATION_MESSAGE);
    }

    const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : undefined;
    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      throw new Error(PHONE_VALIDATION_MESSAGE);
    }

    setIsLoading(true);

    const { firstName, lastName } = splitName(normalizedName);
    // Keep API payload backward compatible while preserving explicit "both" selection.
    const role =
      accountPreference === "employer"
        ? "hire"
        : accountPreference === "both"
          ? "both"
          : "work";

    // Store pending verification
    setPendingVerification({ email: normalizedEmail, name: normalizedName, flow: "signup" });
    localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, normalizedEmail);
    localStorage.setItem(PENDING_VERIFICATION_NAME_KEY, normalizedName);
    localStorage.setItem(PENDING_VERIFICATION_FLOW_KEY, "signup");
    localStorage.setItem("pending_account_preference", accountPreference);

    try {
      try {
        await registerUser({
          username: normalizedName,
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          phoneNumber: normalizedPhone,
          role,
        });
      } catch (error: any) {
        const message = String(error?.message || "");
        const isAlreadyRegistered = /already registered|already exists/i.test(message);
        if (!isAlreadyRegistered) {
          throw error;
        }
      }

      await sendOtp({ email: normalizedEmail });
      toast.success("OTP sent to your email!");
    } catch (error: any) {
      setPendingVerification(null);
      localStorage.removeItem("pending_account_preference");
      localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
      localStorage.removeItem(PENDING_VERIFICATION_FLOW_KEY);
      throw new Error(error?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (otp: string): Promise<boolean> => {
    setIsLoading(true);

    const verificationEmail =
      pendingVerification?.email || localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || "";
    const verificationName =
      pendingVerification?.name || localStorage.getItem(PENDING_VERIFICATION_NAME_KEY) || "User";
    const verificationFlow =
      pendingVerification?.flow ||
      (localStorage.getItem(PENDING_VERIFICATION_FLOW_KEY) === "signup" ? "signup" : "signin");

    if (!verificationEmail) {
      setIsLoading(false);
      toast.error("No pending verification");
      return false;
    }

    const storedPreference =
      verificationFlow === "signup" ? localStorage.getItem("pending_account_preference") : null;
    const accountPreference: "employer" | "worker" | "both" | undefined =
      storedPreference === "employer" || storedPreference === "worker" || storedPreference === "both"
        ? storedPreference
        : undefined;

    try {
      const response = await verifyOtp({ email: verificationEmail, code: otp });
      const { user: apiUser, token } = getAuthPayload(response);
      if (!apiUser) {
        throw new Error("Invalid verification response from server.");
      }
      if (!token) {
        throw new Error("Verification failed. Missing auth token.");
      }
      const role = normalizeRole(getRoleCandidate(apiUser));
      const preferredAccount = accountPreference ?? normalizePreference(getPreferenceCandidate(apiUser));
      const { accountType, accountOptions } = normalizeAccount(role, preferredAccount);

      const apiUserId = getUserId(apiUser);
      if (!apiUserId) {
        throw new Error("Invalid user id in verification response.");
      }

      const newUser: User = {
        id: apiUserId,
        email: apiUser.email,
        firstName: apiUser.firstName || splitName(verificationName).firstName,
        lastName: apiUser.lastName || splitName(verificationName).lastName,
        role,
        accountType,
        accountPreference: normalizePreference(preferredAccount) || undefined,
        accountOptions: [...accountOptions],
        isVerified: true,
        phoneNumber: apiUser.phoneNumber,
        city: apiUser.city,
        country: apiUser.country,
        linkedin: apiUser.linkedin,
        avatarUrl: apiUser.avatarUrl,
        createdAt: new Date().toISOString(),
      };

      setUser(newUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(LEGACY_TOKEN_KEY, token);
      }
      window.dispatchEvent(new Event("auth_user_updated"));

      localStorage.removeItem("pending_account_preference");
      localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
      localStorage.removeItem(PENDING_VERIFICATION_FLOW_KEY);
      setPendingVerification(null);
      setDevOtpCode(null);

      setIsLoading(false);
      toast.success("Verification successful!");
      return true;
    } catch (error: any) {
      setIsLoading(false);
      toast.error(error?.message || "Invalid OTP");
      return false;
    }
  };

  const resendOTP = async () => {
    const verificationEmail =
      pendingVerification?.email || localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || "";

    if (!verificationEmail) {
      toast.error("No pending verification");
      return;
    }

    try {
      const otpResponse = await sendOtp({ email: verificationEmail });
      toast.success("New OTP sent!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend OTP");
    }
  };

  const login = async (
    email: string,
    password: string,
    options?: { suppressToast?: boolean; requireOtp?: boolean }
  ) => {
    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await loginUser({ emailOrUsername: normalizedEmail, password });
      const { user: apiUser, token } = getAuthPayload(response);
      if (!apiUser) {
        throw new Error("Invalid login response from server.");
      }
      const role = normalizeRole(getRoleCandidate(apiUser));
      const preferredAccount = getPreferenceCandidate(apiUser);
      const { accountType, accountOptions } = normalizeAccount(role, preferredAccount);
      const normalizedOptions = normalizeAccountOptions(apiUser.accountOptions);

      const apiUserId = getUserId(apiUser);
      if (!apiUserId) {
        throw new Error("Invalid user id in login response.");
      }

      const loggedInUser: User = {
        id: apiUserId,
        email: apiUser.email,
        firstName: apiUser.firstName || "User",
        lastName: apiUser.lastName || "User",
        role,
        accountType,
        accountPreference: normalizePreference(preferredAccount) || undefined,
        accountOptions: normalizedOptions.length > 0 ? normalizedOptions : [...accountOptions],
        isVerified: true,
        phoneNumber: apiUser.phoneNumber,
        city: apiUser.city,
        country: apiUser.country,
        linkedin: apiUser.linkedin,
        avatarUrl: apiUser.avatarUrl,
        createdAt: new Date().toISOString(),
      };

      if (options?.requireOtp) {
        const verificationEmail = String(apiUser.email || normalizedEmail).toLowerCase().trim();
        const verificationName = `${apiUser.firstName || ""} ${apiUser.lastName || ""}`.trim() || "User";

        const otpResponse = await sendOtp({ email: verificationEmail });
        setPendingVerification({ email: verificationEmail, name: verificationName, flow: "signin" });
        localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, verificationEmail);
        localStorage.setItem(PENDING_VERIFICATION_NAME_KEY, verificationName);
        localStorage.setItem(PENDING_VERIFICATION_FLOW_KEY, "signin");
        localStorage.removeItem("pending_account_preference");

        setIsLoading(false);
        if (!options?.suppressToast) {
          toast.success("OTP sent to your email!");
        }
        return;
      }

      setUser(loggedInUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loggedInUser));
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(loggedInUser));
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(LEGACY_TOKEN_KEY, token);
      }
      window.dispatchEvent(new Event("auth_user_updated"));

      setIsLoading(false);
      if (!options?.suppressToast) {
        toast.success(`Welcome back, ${loggedInUser.firstName}!`);
      }
    } catch (error: any) {
      setIsLoading(false);
      throw new Error(error?.message || "Login failed");
    }
  };

  const logout = (options?: { silent?: boolean }) => {
    try {
      logoutUser().catch(() => undefined);
    } catch {
      // ignore logout errors
    }
    setUser(null);
    setPendingVerification(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
    localStorage.removeItem(PENDING_VERIFICATION_FLOW_KEY);
    if (!options?.silent) {
      toast.success("Logged out successfully");
    }
  };

  const switchAccountType = (nextType: "employer" | "worker") => {
    console.log("AuthContext - switchAccountType called with:", nextType);
    console.log("AuthContext - Current user:", user?.accountType);
    
    if (!user) {
      console.log("AuthContext - Switch aborted: no user");
      return;
    }
    
    const canSwitchByPreference = user.accountPreference === "both";
    const hasBothOptions =
      user.accountOptions.includes("worker") && user.accountOptions.includes("employer");
    const canSwitch = canSwitchByPreference || hasBothOptions;
    
    console.log("AuthContext - canSwitchByPreference:", canSwitchByPreference);
    console.log("AuthContext - hasBothOptions:", hasBothOptions);
    console.log("AuthContext - canSwitch:", canSwitch);
    
    if (!canSwitch) {
      console.log("AuthContext - Switch aborted: cannot switch");
      return;
    }

    const nextOptions: User["accountOptions"] =
      hasBothOptions || canSwitchByPreference ? ["worker", "employer"] : [...user.accountOptions];
    const updatedUser = { ...user, accountType: nextType, accountOptions: nextOptions };
    
    console.log("AuthContext - Setting user to:", updatedUser);
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
    console.log("AuthContext - localStorage updated");
    window.dispatchEvent(new Event("auth_user_updated"));
    console.log("AuthContext - Event dispatched");
    toast.success(`Switched to ${nextType === "employer" ? "Employer" : "Worker"} account`);
  };

  const updateProfile = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
    window.dispatchEvent(new Event("auth_user_updated"));
  };

  const requestPasswordReset = async (email: string) => {
    setIsLoading(true);

    try {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        throw new Error(EMAIL_VALIDATION_MESSAGE);
      }

      await requestPasswordResetOtp({ email: normalizedEmail });
      localStorage.setItem("pending_reset_email", normalizedEmail);
      toast.success("Reset code sent to your email.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (code: string, newPassword: string) => {
    if (!getPasswordStrength(newPassword).isStrong) {
      throw new Error(STRONG_PASSWORD_ERROR);
    }

    setIsLoading(true);

    try {
      const pendingEmail = localStorage.getItem("pending_reset_email");
      if (!pendingEmail) {
        throw new Error("Reset session expired. Please request a new code.");
      }

      await resetPasswordWithOtp({
        email: pendingEmail,
        code,
        newPassword,
      });

      localStorage.removeItem("pending_reset_email");
      toast.success("Password reset successful!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        switchAccountType,
        verifyOTP,
        resendOTP,
        requestPasswordReset,
        resetPassword,
        pendingVerification,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
