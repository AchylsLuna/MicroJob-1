import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import bagIcon from "../assets/MicroIcon1.png";
import lockIcon from "../assets/lockIcon.png";
import mailIcon from "../assets/mailIcon.png";
import { loginUser } from "../api/auth";

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await loginUser({ emailOrUsername: email, password });
      const userEmail = user?.email?.toLowerCase();
      if (!userEmail) {
        setError("No email found on your account. Please contact support.");
        return;
      }

      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_token");
      window.dispatchEvent(new Event("auth_user_updated"));
      localStorage.setItem("pending_verification_email", userEmail);
      navigate("/email-verification", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-t from-cyan-400 to-indigo-900 flex items-center justify-center px-4 page-transition">
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .form-animate {
          animation: slideInRight 0.5s ease-out;
        }
      `}</style>
      
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Branding & Features */}
        <div className="text-white order-2 lg:order-1">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="flex items-center justify-center">
              <img src={bagIcon} alt="Bag Icon" className="w-18 h-18"/>
            </div>
            <div>
              <h1 className="text-5xl font-bold">MicroJobs</h1>
              <p className="text-white text-2xl">Professional Marketplace</p>
            </div>
          </div>

          {/* Main Heading */}
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Connect with Top Talent
            <br></br>
            & Amazing Opportunities
          </h2>

          {/* Description */}
          <p className="text-blue-100 text-lg mb-12">
            Join thousands of professionals growing their careers and businesses on our platform.
          </p>

          {/* Features */}
          <div className="space-y-6">
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-blue-400 bg-opacity-20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-blue-300">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Verified Professionals</h3>
                <p className="text-blue-200">All users are background-checked</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-blue-400 bg-opacity-20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-blue-300">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Secure Payments</h3>
                <p className="text-blue-200">Protected with escrow system</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-blue-400 bg-opacity-20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-blue-300">
                <span className="text-2xl">⭐</span>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Rated 4.9/5</h3>
                <p className="text-blue-200">By 10,000+ satisfied users</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign In Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 order-1 lg:order-2 form-animate">
          <h3 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h3>
          <p className="text-gray-600 mb-8">Sign in to continue your journey</p>

          <form onSubmit={handleSignIn} className="space-y-6">
            {error && <p className="text-red-600 text-sm">{error}</p>}
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <div className="relative">
                <img src={mailIcon} alt="Mail Icon" className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"/>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                Password
              </label>
              <div className="relative">
                <img src={lockIcon} alt="Lock Icon" className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"/>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? "👁" : "👁"}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Remember me</span>
              </label>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                Forgot password?
              </a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-t from-cyan-500 to-indigo-900 hover:from-blue-600 hover:to-blue-700 disabled:opacity-70 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 mt-8"
            >
              {loading ? "Signing in..." : "Sign In"} <span>→</span>
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 text-sm mt-6">
            Don't have an account? <button onClick={() => navigate("/signup")} className="text-blue-600 hover:text-blue-700 font-bold bg-none border-none cursor-pointer">Sign Up</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
