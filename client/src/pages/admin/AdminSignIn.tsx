import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";
import { toast } from "../../lib/toast";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES } from "../../utils/routes";

export function AdminSignIn() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isLoading && isAuthenticated && user?.role === "superadmin") {
    return <Navigate to={ROUTES.admin.dashboard} replace />;
  }

  if (!isLoading && isAuthenticated && user?.role === "admin") {
    return <Navigate to={ROUTES.admin.dashboard} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

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

      if (!storedUser || (storedUser.role !== "superadmin" && storedUser.role !== "admin")) {
        toast.error("Admin access required. Please use an admin account.");
        logout({ silent: true });
        return;
      }

      if (storedUser.role === "superadmin") {
        toast.success(`Welcome back${storedUser?.firstName ? `, ${storedUser.firstName}` : ""}!`);
        return;
      }

      toast.success(`Welcome back${storedUser?.firstName ? `, ${storedUser.firstName}` : ""}!`);
      toast.info("Admin access is limited to Dashboard, Analytics, Job Posting, and E-Wallet.");
    } catch (error: any) {
      toast.error(error.message || "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F2954] via-[#1C4D8D] to-[#4988C4] flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-white rounded-[24px] shadow-2xl p-8 lg:p-10">
        <button
          onClick={() => navigate(ROUTES.home)}
          className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[16px] bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-[28px] font-bold text-[#111827] mb-2">Admin Sign In</h2>
          <p className="text-[14px] text-[#6B7280]">Restricted access for platform administrators</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label className="text-[14px] font-medium text-[#111827] mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="text-[14px] font-medium text-[#111827] mb-2 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] pl-12 pr-12 py-4 text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all"
                disabled={isLoading}
              />
              <button
                type="button"
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
    </div>
  );
}
