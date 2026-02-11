import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "../lib/toast";
import { loginUser, registerUser, sendOtp, verifyOtp, logoutUser } from "../../services/api";

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
  pendingVerification: { email: string; password: string; name: string } | null;
  updateProfile: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = "current_user";
const AUTH_USER_KEY = "auth_user";
const AUTH_TOKEN_KEY = "auth_token";
const LEGACY_TOKEN_KEY = "token";

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
    password: string;
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
    setIsLoading(false);
  }, []);

  const register = async (
    email: string,
    password: string,
    name: string,
    accountPreference: "employer" | "worker" | "both",
    phoneNumber?: string,
  ) => {
    setIsLoading(true);
    
    const normalizedEmail = email.trim().toLowerCase();
    const { firstName, lastName } = splitName(name);
    const role = accountPreference === "employer" ? "hire" : accountPreference === "worker" ? "work" : "both";
    const normalizedPhone = phoneNumber ? phoneNumber.replace(/\D/g, "") : undefined;

    // Store pending verification
    setPendingVerification({ email: normalizedEmail, password, name });
    localStorage.setItem("pending_account_preference", accountPreference);

    try {
      await registerUser({
        username: name,
        firstName,
        lastName,
        email: normalizedEmail,
        password,
        phoneNumber: normalizedPhone,
        role,
      });

      const otpResponse = await sendOtp({ email: normalizedEmail });
      setDevOtpCode(otpResponse?.code ?? null);
      toast.success("OTP sent to your email!");
    } catch (error: any) {
      setPendingVerification(null);
      localStorage.removeItem("pending_account_preference");
      setDevOtpCode(null);
      setIsLoading(false);
      throw new Error(error?.message || "Registration failed");
    }

    setIsLoading(false);
  };

  const verifyOTP = async (otp: string): Promise<boolean> => {
    setIsLoading(true);

    if (!pendingVerification) {
      setIsLoading(false);
      toast.error("No pending verification");
      return false;
    }

    const accountPreference = (localStorage.getItem("pending_account_preference") ?? "worker") as
      | "employer"
      | "worker"
      | "both";

    try {
      const response = await verifyOtp({ email: pendingVerification.email, code: otp });
      const apiUser = response.user;
      const role = (apiUser.role || "work") as User["role"];
      const { accountType, accountOptions } = normalizeAccount(role, accountPreference);

      const newUser: User = {
        id: apiUser.id,
        email: apiUser.email,
        firstName: apiUser.firstName || splitName(pendingVerification.name).firstName,
        lastName: apiUser.lastName || splitName(pendingVerification.name).lastName,
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
    if (!pendingVerification) {
      toast.error("No pending verification");
      return;
    }

    try {
      const otpResponse = await sendOtp({ email: pendingVerification.email });
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
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
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
