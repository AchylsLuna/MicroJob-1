import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Briefcase, TrendingUp, Star, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { motion, useScroll, useTransform } from "motion/react";
import { useState, useEffect } from "react";
import { MicroJobsLogo } from "./MicroJobsLogo";
import { getDefaultDashboardPath } from "../utils/dashboardRoutes";

// Animated Counter Component
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [target]);

  return <span>{count}{suffix}</span>;
}

// Floating Particle Component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-white/20 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

export function LandingPageBlue() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const dashboardPath = getDefaultDashboardPath(user);
  const { scrollYProgress } = useScroll();

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  const jobCards = [
    {
      title: "Sneaker Designer",
      company: "Nike Cooperation",
      location: "United State",
      salary: "$1000/m",
      color: "bg-gradient-to-br from-[#E8F4FF] to-[#D0E8FF]",
      icon: "👟",
    },
    {
      title: "React Developer",
      company: "Microsoft",
      location: "Washington",
      salary: "$4551/m",
      color: "bg-gradient-to-br from-[#FFF9E8] to-[#FFE8C0]",
      icon: "⚛️",
    },
    {
      title: "Product Designer",
      company: "Apple",
      location: "California",
      salary: "$1551/m",
      color: "bg-gradient-to-br from-[#FFE8E8] to-[#FFCFCF]",
      icon: "🎨",
    },
    {
      title: "Senior Artvizlog",
      company: "Google",
      location: "United State",
      salary: "$2000/m",
      color: "bg-gradient-to-br from-[#E8FFE8] to-[#CFEFCF]",
      icon: "📊",
    },
    {
      title: "Chef Leader",
      company: "Paypal",
      location: "Florida",
      salary: "$4521/m",
      color: "bg-gradient-to-br from-[#FFE8F4] to-[#FFCFE8]",
      icon: "👨‍🍳",
    },
    {
      title: "Cleaning Service",
      company: "Airbnb",
      location: "NewYork",
      salary: "$621/m",
      color: "bg-gradient-to-br from-[#E8F9FF] to-[#D0EFFF]",
      icon: "🧹",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create Your Profile",
      description: "Set up a comprehensive profile that showcases your skills, experience, and career goals. Make a lasting impression on potential employers.",
    },
    {
      number: "02",
      title: "Discover Opportunities",
      description: "Explore a diverse range of job listings tailored to match your expertise. Our AI-powered matching helps you discover the perfect opportunities.",
    },
    {
      number: "03",
      title: "Apply and Thrive",
      description: "Submit your applications with confidence and track your progress. Connect with top employers and take the next step in your career journey.",
    },
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MicroJobsLogo
                className="cursor-pointer"
                onClick={() => navigate("/")}
              />
            </motion.div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#jobs" className="text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Jobs</a>
              <a href="#features" className="text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Features</a>
              <a href="#employers" className="text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Employers</a>
              <a href="#help" className="text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Help</a>
              <a href="#contact" className="text-[14px] text-gray-600 hover:text-gray-900 font-medium transition-colors">Contact Us</a>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(isAuthenticated ? dashboardPath : "/sign-in")}
                className="text-[14px] font-semibold text-gray-700 px-5 py-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(73, 136, 196, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/sign-up")}
                className="text-[14px] font-semibold text-white px-6 py-2.5 rounded-full bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] hover:shadow-lg transition-all"
              >
                Get Started
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-cyan-50/30 pointer-events-none" />
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 bg-[#4988C4]/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-96 h-96 bg-[#1C4D8D]/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h1 className="text-[48px] lg:text-[56px] font-bold leading-tight text-gray-900 mb-6">
                  Unlock Your<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] via-[#3570A8] to-[#1C4D8D] animate-gradient bg-[length:200%_auto]">
                    Career Potential
                  </span><br />
                  with Mirco Jobs
                </h1>
              </motion.div>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-[16px] text-gray-600 mb-8 leading-relaxed"
              >
                Discover thousands of job opportunities with all the information you need. It's your future. Come find it. Manage all your job applications from start to finish.
              </motion.p>
              
              {/* Enhanced Get Started Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-[20px] p-6 border border-blue-100 shadow-lg mb-6"
              >
                <div className="flex items-center gap-4 mb-4">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center"
                  >
                    <Sparkles className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900">Ready to Get Started?</h3>
                    <p className="text-[13px] text-gray-600">Join over 10,000+ active job seekers</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(73, 136, 196, 0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/sign-up")}
                  className="w-full inline-flex items-center justify-center gap-2 text-[16px] font-semibold text-white px-8 py-4 rounded-full bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] hover:shadow-xl transition-all relative overflow-hidden group"
                >
                  <span className="relative z-10">Create Free Account</span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-[#1C4D8D] to-[#4988C4]"
                    initial={{ x: "100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                  <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                <p className="text-[11px] text-gray-500 text-center mt-3">
                  ✓ No credit card required • ✓ Free forever • ✓ Cancel anytime
                </p>
              </motion.div>

              {/* Trusted Companies */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                id="employers"
                className="mt-12 scroll-mt-24"
              >
                <p className="text-[13px] text-gray-500 mb-4">Trusted by leading companies:</p>
                <div className="flex items-center gap-4">
                  {["🏢", "💼", "🚀", "⚡", "🎯", "💡"].map((emoji, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 1 + i * 0.1, type: "spring" }}
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-[18px] cursor-pointer"
                    >
                      {emoji}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Right Content - Illustration */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative"
              style={{ opacity, scale }}
            >
              <div className="w-full aspect-square rounded-[32px] bg-gradient-to-br from-[#E8F4FF] via-[#F0F8FF] to-[#E8F9FF] p-12 relative overflow-hidden backdrop-blur-sm border border-white/50 shadow-2xl">
                {/* Floating Cards */}
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ delay: 0.2 }}
                  className="absolute top-8 left-8 bg-white/90 backdrop-blur-md rounded-[16px] p-4 shadow-xl cursor-pointer"
                >
                  <motion.div 
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] mb-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-[12px] font-semibold text-gray-900">Sarah K.</p>
                  <p className="text-[10px] text-gray-500">Designer</p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  transition={{ delay: 0.4 }}
                  className="absolute top-1/4 right-8 bg-white/90 backdrop-blur-md rounded-[16px] p-4 shadow-xl cursor-pointer"
                >
                  <motion.div 
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6BCF7F] to-[#4CAF50] mb-2"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-[12px] font-semibold text-gray-900">Alex M.</p>
                  <p className="text-[10px] text-gray-500">Developer</p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ delay: 0.6 }}
                  className="absolute bottom-12 left-12 bg-white/90 backdrop-blur-md rounded-[16px] p-4 shadow-xl cursor-pointer"
                >
                  <motion.div 
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD93D] to-[#FFA500] mb-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  />
                  <p className="text-[12px] font-semibold text-gray-900">Mike L.</p>
                  <p className="text-[10px] text-gray-500">Manager</p>
                </motion.div>

                {/* Center Text */}
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                  whileHover={{ scale: 1.1 }}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center"
                >
                  <div className="bg-white/90 backdrop-blur-md rounded-[20px] p-6 shadow-2xl border border-white/50">
                    <Sparkles className="w-8 h-8 text-[#4988C4] mx-auto mb-2" />
                    <p className="text-[24px] font-bold text-gray-900">Over 10,000</p>
                    <p className="text-[14px] text-gray-600">Active Jobs</p>
                  </div>
                </motion.div>

                {/* Floating Particles */}
                <FloatingParticles />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section with Animated Counters */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-blue-50/30 relative overflow-hidden">
        <motion.div 
          className="absolute -top-20 -right-20 w-96 h-96 bg-[#4988C4]/5 rounded-full blur-3xl"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[36px] font-bold text-gray-900 mb-3"
          >
            Join Mirco Jobs Today and Experience
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[36px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] mb-16"
          >
            The Power of Numbers
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: 95, label: "Users were hired through Mirco Jobs in the past year" },
              { value: 98, label: "Users were the placement among trusted Employers" },
              { value: 90, label: "Users were job placement with top companies" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -10, boxShadow: "0 20px 40px rgba(73, 136, 196, 0.2)" }}
                className="bg-white/80 backdrop-blur-sm rounded-[24px] p-8 shadow-lg border border-white/50"
              >
                <motion.div 
                  className="text-[48px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] mb-2"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 + 0.3, type: "spring", stiffness: 200 }}
                >
                  <AnimatedCounter target={stat.value} suffix="%" />
                </motion.div>
                <p className="text-[14px] text-gray-600">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Mirco Jobs Section with 3D Effect */}
      <section className="py-20 px-6 relative scroll-mt-24" id="features">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[36px] font-bold text-gray-900 mb-2">
              Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D]">Mirco Jobs?</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Skill-Based Matching */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05, rotateY: 5 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all perspective-1000"
            >
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-[#E8F4FF] to-[#F0F8FF] flex items-center justify-center mb-6"
              >
                <span className="text-[28px]">🎯</span>
              </motion.div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">Skill-Based Matching</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
                Our advanced algorithm matches your skills with the perfect job opportunities, ensuring you find roles that truly fit your expertise.
              </p>
              <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-[16px] p-4 space-y-3">
                {["React.js - Expert", "Node.js - Advanced", "UI/UX Design - Intermediate"].map((skill, i) => (
                  <motion.div
                    key={i}
                    initial={{ width: 0 }}
                    whileInView={{ width: "100%" }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[12px] font-semibold text-gray-700">{skill.split(" - ")[0]}</span>
                    <span className="text-[12px] text-gray-500">{skill.split(" - ")[1]}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Verified Companies */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05, rotateY: -5 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all"
            >
              <motion.div 
                whileHover={{ scale: 1.2 }}
                className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-[#E8FFE8] to-[#E8F9FF] flex items-center justify-center mb-6"
              >
                <CheckCircle className="w-7 h-7 text-[#10B981]" />
              </motion.div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">Verified Companies</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
                All companies on our platform are thoroughly vetted to ensure you connect with legitimate employers offering quality opportunities.
              </p>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-[#E8FFE8] to-green-50 rounded-[16px] p-6 text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <CheckCircle className="w-16 h-16 text-[#10B981] mx-auto mb-3" />
                </motion.div>
                <p className="text-[14px] font-semibold text-gray-900">All Companies Are</p>
                <p className="text-[14px] font-semibold text-[#10B981]">Fully Verified</p>
              </motion.div>
            </motion.div>

            {/* Tailored Job Matches */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all"
            >
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-[#E8F4FF] to-[#F0F8FF] flex items-center justify-center mb-6"
              >
                <Star className="w-7 h-7 text-[#4988C4]" />
              </motion.div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">Tailored Job Matches</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed">
                Receive personalized job recommendations based on your profile, experience, and career goals. Find opportunities that align perfectly with your aspirations.
              </p>
            </motion.div>

            {/* Streamlined Application Process */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              className="bg-white rounded-[24px] p-8 border border-gray-100 hover:shadow-2xl transition-all"
            >
              <motion.div 
                whileHover={{ scale: 1.2 }}
                className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-[#E8F4FF] to-[#F0F8FF] flex items-center justify-center mb-6"
              >
                <TrendingUp className="w-7 h-7 text-[#4988C4]" />
              </motion.div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-3">Streamlined Application Process</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed">
                Apply to multiple positions with ease. Track your applications, schedule interviews, and manage your job search all in one place.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Three Steps Section with Parallax */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#4988C4] via-[#3570A8] to-[#1C4D8D] relative overflow-hidden scroll-mt-24" id="help">
        <FloatingParticles />
        
        <motion.div 
          className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[36px] font-bold text-white mb-2">
              Your Mirco Jobs Journey in
            </h2>
            <p className="text-[36px] font-bold text-white">Three Simple Steps</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -10, rotateY: 5 }}
                className="bg-white/95 backdrop-blur-sm rounded-[24px] p-8 hover:bg-white transition-all shadow-xl"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 + 0.3, type: "spring", stiffness: 200 }}
                  className="text-[48px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] mb-4"
                >
                  {step.number}
                </motion.div>
                <h3 className="text-[20px] font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-[14px] text-gray-600 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="mt-12 text-center"
          >
            <motion.button
              whileHover={{ scale: 1.1, boxShadow: "0 20px 40px rgba(255, 255, 255, 0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/sign-up")}
              className="inline-flex items-center gap-2 text-[16px] font-semibold text-[#4988C4] px-8 py-4 rounded-full bg-white hover:shadow-xl transition-all"
            >
              Start Your Journey
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Find Your Match Jobs with Stagger Animation */}
      <section className="py-20 px-6 scroll-mt-24" id="jobs">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[36px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] mb-2">
              Find Your Match
            </h2>
            <p className="text-[36px] font-bold text-gray-900">Job Here</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobCards.map((job, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ 
                  y: -10, 
                  boxShadow: "0 20px 40px rgba(73, 136, 196, 0.2)",
                  rotateY: 5
                }}
                className="bg-white rounded-[24px] p-6 border border-gray-100 hover:shadow-xl transition-all cursor-pointer group"
              >
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  className={`w-16 h-16 rounded-[16px] ${job.color} flex items-center justify-center text-[32px] mb-4 shadow-lg`}
                >
                  {job.icon}
                </motion.div>
                
                <h3 className="text-[18px] font-bold text-gray-900 mb-2 group-hover:text-[#4988C4] transition-colors">{job.title}</h3>
                
                <div className="flex items-center gap-2 text-[13px] text-gray-600 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span>{job.company}</span>
                </div>
                
                <div className="flex items-center gap-2 text-[13px] text-gray-600 mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>{job.location}</span>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-[16px] font-bold text-gray-900">{job.salary}</span>
                  <motion.button
                    whileHover={{ scale: 1.2, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate("/dashboard/find-jobs")}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white group-hover:shadow-lg transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => navigate("/dashboard/find-jobs")}
              className="text-[14px] font-semibold text-[#4988C4] hover:text-[#1C4D8D] transition-colors"
            >
              Show More →
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-[36px] font-bold text-gray-900 mb-2">What Our Users</h2>
            <p className="text-[36px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D]">
              Say About Mirco Jobs
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                name: "Aisha M.",
                role: "HR Professional",
                gradient: "from-[#4988C4] to-[#1C4D8D]",
                text: '"Mirco Jobs transformed my job search experience. Within weeks, I connected with amazing employers and found my dream role. The platform\'s matching algorithm is incredibly accurate!"'
              },
              {
                name: "David K.",
                role: "Software Engineer",
                gradient: "from-[#6BCF7F] to-[#4CAF50]",
                text: '"As a hiring manager, Mirco Jobs has been a game-changer. The quality of candidates is exceptional, and the streamlined process saves us so much time. Highly recommended!"'
              }
            ].map((testimonial, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: index === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, boxShadow: "0 20px 40px rgba(73, 136, 196, 0.2)" }}
                className="bg-white/80 backdrop-blur-sm rounded-[24px] p-8 shadow-lg border border-white/50"
              >
                <div className="flex items-center gap-4 mb-6">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${testimonial.gradient}`}
                  />
                  <div>
                    <h4 className="text-[16px] font-bold text-gray-900">{testimonial.name}</h4>
                    <p className="text-[13px] text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Star className="w-5 h-5 fill-[#FFD93D] text-[#FFD93D]" />
                    </motion.div>
                  ))}
                </div>
                <p className="text-[14px] text-gray-600 leading-relaxed">
                  {testimonial.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section with Gradient Animation */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] rounded-[32px] p-12 relative overflow-hidden shadow-2xl"
          >
            <motion.div 
              className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"
              animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            <motion.div 
              className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"
              animate={{ scale: [1.5, 1, 1.5], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            
            <div className="relative z-10">
              <motion.h2 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[36px] font-bold text-white mb-4"
              >
                Ready to Find Your Dream Job?
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-[16px] text-white/90 mb-8"
              >
                Join thousands of professionals who have already found their perfect match on Mirco Jobs
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.1, boxShadow: "0 20px 40px rgba(255, 255, 255, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/sign-up")}
                className="inline-flex items-center gap-2 text-[16px] font-semibold text-[#4988C4] px-8 py-4 rounded-full bg-white hover:shadow-xl transition-all"
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6 scroll-mt-24" id="contact">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <motion.div whileHover={{ scale: 1.05 }}>
                <MicroJobsLogo
                  variant="light"
                  className="cursor-pointer mb-4"
                  onClick={() => navigate("/")}
                />
              </motion.div>
              <p className="text-[13px] text-gray-400">
                © 2026 Micro Jobs. All rights reserved.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h4 className="text-[14px] font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#jobs" className="text-[13px] text-gray-400 hover:text-white transition-colors">Jobs</a></li>
                <li><a href="#employers" className="text-[13px] text-gray-400 hover:text-white transition-colors">Employers</a></li>
                <li><a href="#features" className="text-[13px] text-gray-400 hover:text-white transition-colors">Companies</a></li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="text-[14px] font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-[13px] text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="text-[13px] text-gray-400 hover:text-white transition-colors">Contact</a></li>
                <li><a href="#help" className="text-[13px] text-gray-400 hover:text-white transition-colors">Help</a></li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate(isSuperAdmin ? "/dashboard/admin-dashboard" : "/admin-sign-in")}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Admin Dashboard
                  </button>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h4 className="text-[14px] font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/terms")}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/privacy")}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/cookie-policy")}
                    className="text-[13px] text-gray-400 hover:text-white transition-colors"
                  >
                    Cookie Policy
                  </button>
                </li>
              </ul>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="border-t border-gray-800 pt-8"
          >
            <p className="text-[12px] text-gray-500 text-center">
              Made by Computer Security 3rd Year Block 1 - COMSEC 01
            </p>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
