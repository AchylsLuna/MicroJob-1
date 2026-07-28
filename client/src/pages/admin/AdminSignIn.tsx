import { useRef, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "../../lib/toast";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isAdmin } from "../../utils/dashboardRoutes";
import { ROUTES } from "../../utils/routes";

export function AdminSignIn() {
  const { login, isAuthenticated, user, logout } = useAuth();
  const [email, setEmail] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isLoading && isAuthenticated && isAdmin(user)) {
    return <Navigate to={ROUTES.admin.dashboard} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = passwordInputRef.current?.value || "";

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";
    const isSecureContext =
      window.isSecureContext || window.location.protocol === "https:" || isLocalhost;

    if (!isSecureContext) {
      toast.error("Secure connection required. Please use HTTPS.");
      return;
    }

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, { suppressToast: true });
      const stored =
        localStorage.getItem("auth_user") || localStorage.getItem("current_user");
      const storedUser = stored ? JSON.parse(stored) : null;

      if (!storedUser || !isAdmin(storedUser)) {
        toast.error("Admin access required. Please use an admin account.");
        logout({ silent: true });
        return;
      }

      toast.success(`Welcome back${storedUser?.firstName ? `, ${storedUser.firstName}` : ""}!`);
    } catch (error: any) {
      toast.error(error.message || "Sign in failed");
    } finally {
      if (passwordInputRef.current) {
        passwordInputRef.current.value = "";
      }
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-blue-950/30 blur-3xl" aria-hidden="true" />
      <div className="relative w-full max-w-[520px] rounded-[24px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,41,84,0.35)] backdrop-blur sm:p-8 lg:p-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] shadow-lg shadow-blue-900/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1C4D8D]">MicroJobs control center</p>
          <h1 className="mb-2 text-[28px] font-bold text-[#111827]">Admin Sign In</h1>
          <p className="text-[14px] text-[#6B7280]">Restricted access for platform administrators</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className="text-[14px] font-medium text-[#111827] mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="text-[14px] font-medium text-[#111827] mb-2 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                id="admin-password"
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-4 px-6 rounded-[12px] hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In as Admin"}
          </button>
        </form>

      </div>
    </main>
  );
}
