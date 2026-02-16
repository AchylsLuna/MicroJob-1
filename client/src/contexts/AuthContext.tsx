import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "../lib/toast";
import { loginUser, registerUser, sendOtp, verifyOtp, logoutUser } from "../services/api";
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
  role: "hire" | "work" | "both" | "admin" | "superadmin";
  accountType: "employer" | "worker";
  accountOptions: ("employer" | "worker")[];
  isVerified: boolean;
  avatar?: string;
  phoneNumber?: string;
  city?: string;
  country?: string;
  linkedin?: string;
  avatarUrl?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  devOtpCode: string | null;
  login: (email: string, password: string, options?: { suppressToast?: boolean }) => Promise<void>;
  register: (email: string, password: string, name: string, accountPreference: "employer" | "worker" | "both", phoneNumber?: string) => Promise<void>;
  logout: (options?: { silent?: boolean }) => void;
  switchAccountType: (nextType: "employer" | "worker") => void;
  verifyOTP: (otp: string) => Promise<boolean>;
  resendOTP: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (code: string, newPassword: string) => Promise<void>;
  pendingVerification: { email: string; name: string } | null;
  updateProfile: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = "current_user";
const AUTH_USER_KEY = "auth_user";
const AUTH_TOKEN_KEY = "auth_token";
const LEGACY_TOKEN_KEY = "token";
const PENDING_VERIFICATION_EMAIL_KEY = "pending_verification_email";
const PENDING_VERIFICATION_NAME_KEY = "pending_verification_name";

const normalizeAccount = (
  role: User["role"],
  preferred?: "employer" | "worker" | "both",
): { accountType: User["accountType"]; accountOptions: User["accountOptions"] } => {
  if (preferred === "employer") {
    return { accountType: "employer", accountOptions: ["employer"] };
  }
  if (preferred === "worker") {
    return { accountType: "worker", accountOptions: ["worker"] };
  }
  if (preferred === "both") {
    return { accountType: "worker", accountOptions: ["employer", "worker"] };
  }
  if (role === "hire") {
    return { accountType: "employer", accountOptions: ["employer"] };
  }
  if (role === "both") {
    return { accountType: "worker", accountOptions: ["employer", "worker"] };
  }
  return { accountType: "worker", accountOptions: ["worker"] };
};

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "User";
  const lastName = parts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    // Check for existing session
    const currentUser = localStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY);
    if (currentUser) {
      const parsed = JSON.parse(currentUser) as User;
      const normalizedUser = {
        ...parsed,
        accountType: parsed.accountType ?? "worker",
        accountOptions: parsed.accountOptions ?? [parsed.accountType ?? "worker"],
      };
      setUser(normalizedUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalizedUser));
    }

    const pendingEmail = localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
    if (pendingEmail) {
      const pendingName = localStorage.getItem(PENDING_VERIFICATION_NAME_KEY) || "User";
      setPendingVerification({ email: pendingEmail, name: pendingName });
    }

    setIsLoading(false);
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
    const role = accountPreference === "employer" ? "hire" : accountPreference === "worker" ? "work" : "both";

    // Store pending verification
    setPendingVerification({ email: normalizedEmail, name: normalizedName });
    localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, normalizedEmail);
    localStorage.setItem(PENDING_VERIFICATION_NAME_KEY, normalizedName);
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

      const otpResponse = await sendOtp({ email: normalizedEmail });
      setDevOtpCode(otpResponse?.code ?? null);
      toast.success("OTP sent to your email!");
    } catch (error: any) {
      setPendingVerification(null);
      localStorage.removeItem("pending_account_preference");
      localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
      setDevOtpCode(null);
      setIsLoading(false);
      throw new Error(error?.message || "Registration failed");
    }

    setIsLoading(false);
  };

  const verifyOTP = async (otp: string): Promise<boolean> => {
    setIsLoading(true);

    const verificationEmail =
      pendingVerification?.email || localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || "";
    const verificationName =
      pendingVerification?.name || localStorage.getItem(PENDING_VERIFICATION_NAME_KEY) || "User";

    if (!verificationEmail) {
      setIsLoading(false);
      toast.error("No pending verification");
      return false;
    }

    const accountPreference = (localStorage.getItem("pending_account_preference") ?? "worker") as
      | "employer"
      | "worker"
      | "both";

    try {
      const response = await verifyOtp({ email: verificationEmail, code: otp });
      const apiUser = response.user;
      const role = (apiUser.role || "work") as User["role"];
      const { accountType, accountOptions } = normalizeAccount(role, accountPreference);

      const newUser: User = {
        id: apiUser.id,
        email: apiUser.email,
        firstName: apiUser.firstName || splitName(verificationName).firstName,
        lastName: apiUser.lastName || splitName(verificationName).lastName,
        role,
        accountType,
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
      if (response.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.token);
        localStorage.setItem(LEGACY_TOKEN_KEY, response.token);
      }
      window.dispatchEvent(new Event("auth_user_updated"));

      localStorage.removeItem("pending_account_preference");
      localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
      setPendingVerification(null);
      setDevOtpCode(null);

      setIsLoading(false);
      toast.success("Registration successful!");
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
      setDevOtpCode(otpResponse?.code ?? null);
      toast.success("New OTP sent!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend OTP");
    }
  };

  const login = async (email: string, password: string, options?: { suppressToast?: boolean }) => {
    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await loginUser({ emailOrUsername: normalizedEmail, password });
      const apiUser = response.user;
      const role = (apiUser.role || "work") as User["role"];
      const { accountType, accountOptions } = normalizeAccount(role);

      const loggedInUser: User = {
        id: apiUser.id,
        email: apiUser.email,
        firstName: apiUser.firstName || "User",
        lastName: apiUser.lastName || "User",
        role,
        accountType,
        accountOptions: [...accountOptions],
        isVerified: true,
        phoneNumber: apiUser.phoneNumber,
        city: apiUser.city,
        country: apiUser.country,
        linkedin: apiUser.linkedin,
        avatarUrl: apiUser.avatarUrl,
        createdAt: new Date().toISOString(),
      };

      setUser(loggedInUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loggedInUser));
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(loggedInUser));
      if (response.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.token);
        localStorage.setItem(LEGACY_TOKEN_KEY, response.token);
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
    setDevOtpCode(null);
    setPendingVerification(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    localStorage.removeItem(PENDING_VERIFICATION_NAME_KEY);
    if (!options?.silent) {
      toast.success("Logged out successfully");
    }
  };

  const switchAccountType = (nextType: "employer" | "worker") => {
    if (!user) return;
    const accountOptions = user.accountOptions.includes(nextType)
      ? user.accountOptions
      : [...user.accountOptions, nextType];
    const updatedUser = { ...user, accountType: nextType, accountOptions };
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
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
    
    // TODO: wire to backend password reset when available.
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.setItem("pending_reset_email", email);
    const mockResetCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("🔑 Your password reset code is:", mockResetCode);
    localStorage.setItem("pending_reset_code", mockResetCode);
    setIsLoading(false);
    toast.success("Password reset link sent to your email!");
  };

  const resetPassword = async (code: string, newPassword: string) => {
    if (!getPasswordStrength(newPassword).isStrong) {
      throw new Error(STRONG_PASSWORD_ERROR);
    }

    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const storedCode = localStorage.getItem("pending_reset_code");
    
    if (code !== storedCode) {
      setIsLoading(false);
      toast.error("Invalid reset code");
      return;
    }

    const pendingEmail = localStorage.getItem("pending_reset_email");
    if (!pendingEmail) {
      setIsLoading(false);
      throw new Error("User not found");
    }
    const resetUser: User = user ?? {
      id: `user-${Date.now()}`,
      email: pendingEmail,
      firstName: "User",
      lastName: "User",
      role: "work",
      accountType: "worker",
      accountOptions: ["worker"],
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    setUser(resetUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(resetUser));
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(resetUser));
    localStorage.removeItem("pending_reset_code");
    localStorage.removeItem("pending_reset_email");

    setIsLoading(false);
    toast.success("Password reset successful!");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        devOtpCode,
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
