import { useEffect, useState } from "react";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Award, 
  Download, 
  Edit, 
  Calendar,
  Building2,
  CheckCircle2,
  FileText,
  Linkedin,
  Globe,
  DollarSign
} from "lucide-react";
import { toast } from "../lib/toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getProfile } from "../../services/api";

interface WorkExperience {
  id: string;
  position: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  achievements: string[];
}

interface AcceptedWork {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  completedDate: string;
  salary: string;
  description: string;
  skills: string[];
  status: "Completed" | "In Progress";
}

export function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "experience" | "portfolio">("overview");
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const [profileUser, setProfileUser] = useState(user);

  useEffect(() => {
    if (user) {
      setProfileUser(user);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        const profile = (response as any)?.user ?? response;
        if (!profile || !isMounted) return;
        setProfileUser(profile);
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
      } catch (error) {
        // keep fallback to auth context
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [updateAuthProfile]);

  const fallbackName = "Jonas Dela Cruz";
  const displayName = profileUser ? `${profileUser.firstName || ""} ${profileUser.lastName || ""}`.trim() : fallbackName;
  const location = [profileUser?.city, profileUser?.country].filter(Boolean).join(", ") || "Manila, Philippines";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "JD";

  const profileData = {
    name: displayName || fallbackName,
    title: "Senior Frontend Developer",
    avatar: null, // Will use initials
    email: profileUser?.email || "jonas.delacruz@email.com",
    phone: profileUser?.phoneNumber || "+63 912 345 6789",
    location,
    linkedin: profileUser?.linkedin || "linkedin.com/in/jonasdelacruz",
    website: "jonasdelacruz.dev",
    about: "Passionate Frontend Developer with 5+ years of experience building scalable web applications. Specialized in React, TypeScript, and modern web technologies. Strong focus on creating intuitive user experiences and clean, maintainable code.",
    skills: ["React", "TypeScript", "Node.js", "Next.js", "Tailwind CSS", "GraphQL", "Redux", "Jest", "Git", "Figma"],
    resumeUploaded: true,
    resumeName: "Jonas_Dela_Cruz_Resume_2026.pdf",
    resumeSize: "245 KB",
  };

  const workExperiences: WorkExperience[] = [
    {
      id: "1",
      position: "Senior Frontend Developer",
      company: "Tech Solutions Inc.",
      location: "Manila, Philippines",
      startDate: "Jan 2022",
      endDate: "Present",
      current: true,
      description: "Leading frontend development team and architecting scalable React applications",
      achievements: [
        "Led migration from JavaScript to TypeScript, improving code quality by 40%",
        "Implemented design system used across 5+ products",
        "Mentored 3 junior developers and conducted code reviews",
        "Improved application performance by 60% through optimization",
      ],
    },
    {
      id: "2",
      position: "Frontend Developer",
      company: "Digital Innovations Co.",
      location: "Quezon City, Philippines",
      startDate: "Mar 2020",
      endDate: "Dec 2021",
      current: false,
      description: "Developed and maintained multiple client-facing web applications",
      achievements: [
        "Built responsive web applications serving 100k+ users",
        "Collaborated with UX team to improve user engagement by 35%",
        "Implemented automated testing reducing bugs by 50%",
      ],
    },
    {
      id: "3",
      position: "Junior Web Developer",
      company: "Startup Hub Philippines",
      location: "Makati, Philippines",
      startDate: "Jun 2019",
      endDate: "Feb 2020",
      current: false,
      description: "Contributed to various web development projects",
      achievements: [
        "Developed reusable React components",
        "Participated in agile development processes",
        "Learned modern web development best practices",
      ],
    },
  ];

  const acceptedWorks: AcceptedWork[] = [
    {
      id: "1",
      title: "E-Commerce Platform Development",
      company: "ShopNow Inc.",
      companyLogo: "SN",
      completedDate: "Dec 2025",
      salary: "₱150,000",
      description: "Developed a complete e-commerce platform with product catalog, cart, and checkout functionality",
      skills: ["React", "Node.js", "MongoDB", "Stripe"],
      status: "Completed",
    },
    {
      id: "2",
      title: "Dashboard Analytics System",
      company: "DataViz Solutions",
      companyLogo: "DV",
      completedDate: "Oct 2025",
      salary: "₱120,000",
      description: "Built an analytics dashboard with real-time data visualization and reporting features",
      skills: ["React", "D3.js", "TypeScript", "PostgreSQL"],
      status: "Completed",
    },
    {
      id: "3",
      title: "Mobile App Landing Page",
      company: "AppMasters",
      companyLogo: "AM",
      completedDate: "Sep 2025",
      salary: "₱80,000",
      description: "Created a responsive landing page for mobile app with animation and conversion optimization",
      skills: ["React", "Tailwind CSS", "Framer Motion"],
      status: "Completed",
    },
    {
      id: "4",
      title: "Healthcare Portal",
      company: "MediCare Plus",
      companyLogo: "MC",
      completedDate: "In Progress",
      salary: "₱200,000",
      description: "Developing a patient management system with appointment scheduling and medical records",
      skills: ["React", "TypeScript", "Firebase", "HIPAA Compliance"],
      status: "In Progress",
    },
  ];

  const handleEditProfile = () => {
    navigate("/dashboard/settings");
  };

  const handleDownloadResume = () => {
    toast.success("Resume downloaded successfully!");
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-[20px] border border-[#e2e8f0] shadow-sm overflow-hidden">
        {/* Cover Photo */}
        <div className="h-[140px] bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8]"></div>
        
        {/* Profile Info */}
        <div className="px-8 pb-6">
          <div className="flex items-end justify-between -mt-16">
            <div className="flex items-end gap-6">
              {/* Avatar */}
              <div className="w-32 h-32 rounded-[20px] bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-white font-bold text-[48px]">{initials}</span>
              </div>
              
              {/* Name and Title */}
              <div className="pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-[28px] font-bold text-[#1e293b]">
                    Welcome back 👋 {profileData.name.split(' ')[0]}
                  </h1>
                </div>
                <p className="text-[16px] text-[#64748b] mb-2">{profileData.title}</p>
                <div className="flex items-center gap-4 text-[14px] text-[#64748b]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {profileData.location}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {profileData.email}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleEditProfile}
              className="bg-[#2563eb] text-white font-semibold px-6 py-3 rounded-[12px] hover:bg-[#1d4ed8] transition-all flex items-center gap-2 mb-2"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-[16px] border border-[#e2e8f0] shadow-sm">
        <div className="flex border-b border-[#e2e8f0]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-6 py-4 text-[15px] font-medium transition-all ${
              activeTab === "overview"
                ? "text-[#2563eb] border-b-2 border-[#2563eb]"
                : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <User className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab("experience")}
            className={`flex items-center gap-2 px-6 py-4 text-[15px] font-medium transition-all ${
              activeTab === "experience"
                ? "text-[#2563eb] border-b-2 border-[#2563eb]"
                : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Work Experience
          </button>
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`flex items-center gap-2 px-6 py-4 text-[15px] font-medium transition-all ${
              activeTab === "portfolio"
                ? "text-[#2563eb] border-b-2 border-[#2563eb]"
                : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <Award className="w-4 h-4" />
            Portfolio & Accepted Work
          </button>
        </div>

        <div className="p-8">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - About & Contact */}
                <div className="lg:col-span-2 space-y-6">
                  {/* About Section */}
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#1e293b] mb-4">About Me</h2>
                    <p className="text-[14px] text-[#475569] leading-relaxed">{profileData.about}</p>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#1e293b] mb-4">Contact Information</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#dbeafe] flex items-center justify-center">
                          <Mail className="w-5 h-5 text-[#2563eb]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">Email</p>
                          <p className="text-[14px] font-medium text-[#1e293b]">{profileData.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#dcfce7] flex items-center justify-center">
                          <Phone className="w-5 h-5 text-[#16a34a]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">Phone</p>
                          <p className="text-[14px] font-medium text-[#1e293b]">{profileData.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#dbeafe] flex items-center justify-center">
                          <Linkedin className="w-5 h-5 text-[#0a66c2]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">LinkedIn</p>
                          <p className="text-[14px] font-medium text-[#1e293b] truncate">{profileData.linkedin}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-[12px] border border-[#e2e8f0]">
                        <div className="w-10 h-10 rounded-[10px] bg-[#f3e8ff] flex items-center justify-center">
                          <Globe className="w-5 h-5 text-[#9333ea]" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#64748b] mb-0.5">Website</p>
                          <p className="text-[14px] font-medium text-[#1e293b]">{profileData.website}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <h2 className="text-[20px] font-semibold text-[#1e293b] mb-4">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {profileData.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] text-[#2563eb] rounded-[10px] text-[13px] font-semibold border border-[#bfdbfe]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - CV/Resume */}
                <div className="space-y-6">
                  {/* CV/Resume Card */}
                  <div className="bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] border border-[#bfdbfe] rounded-[16px] p-6">
                    <h3 className="text-[18px] font-semibold text-[#1e293b] mb-4">CV/Resume</h3>
                    {profileData.resumeUploaded ? (
                      <div className="space-y-4">
                        <div className="bg-white rounded-[12px] p-4 border border-[#bfdbfe]">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-[10px] bg-[#2563eb] flex items-center justify-center">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-[14px] font-semibold text-[#1e293b]">{profileData.resumeName}</h4>
                              <p className="text-[12px] text-[#64748b]">{profileData.resumeSize}</p>
                            </div>
                          </div>
                          <button
                            onClick={handleDownloadResume}
                            className="w-full bg-[#2563eb] text-white font-semibold py-2.5 px-4 rounded-[10px] hover:bg-[#1d4ed8] transition-all flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                        <p className="text-[12px] text-[#475569] text-center">
                          Last updated: Jan 15, 2026
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileText className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
                        <p className="text-[14px] text-[#64748b] mb-3">No resume uploaded</p>
                        <button
                          onClick={() => navigate("/dashboard/settings")}
                          className="bg-[#2563eb] text-white font-semibold py-2 px-4 rounded-[10px] hover:bg-[#1d4ed8] transition-all text-[13px]"
                        >
                          Upload Resume
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-6">
                    <h3 className="text-[18px] font-semibold text-[#1e293b] mb-4">Quick Stats</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">Total Experience</span>
                        <span className="text-[16px] font-bold text-[#1e293b]">5+ Years</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">Projects Completed</span>
                        <span className="text-[16px] font-bold text-[#10b981]">12</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">Jobs Applied</span>
                        <span className="text-[16px] font-bold text-[#2563eb]">6</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-[#64748b]">Success Rate</span>
                        <span className="text-[16px] font-bold text-[#10b981]">85%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Work Experience Tab */}
          {activeTab === "experience" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[20px] font-semibold text-[#1e293b]">Work Experience</h2>
                <button
                  onClick={() => navigate("/dashboard/settings")}
                  className="text-[14px] text-[#2563eb] hover:text-[#1d4ed8] font-medium"
                >
                  Add Experience
                </button>
              </div>

              <div className="space-y-4">
                {workExperiences.map((exp) => (
                  <div key={exp.id} className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-[12px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center text-white font-bold text-[18px] shadow-md flex-shrink-0">
                        {exp.company.substring(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-[18px] font-bold text-[#1e293b] mb-1">{exp.position}</h3>
                            <p className="text-[14px] font-medium text-[#2563eb] mb-1 flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              {exp.company}
                            </p>
                            <div className="flex items-center gap-3 text-[13px] text-[#64748b]">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                              </div>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {exp.location}
                              </div>
                            </div>
                          </div>
                          {exp.current && (
                            <span className="bg-[#dcfce7] text-[#16a34a] px-3 py-1 rounded-[8px] text-[12px] font-semibold">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="text-[14px] text-[#475569] mb-3 mt-3">{exp.description}</p>

                        <div className="space-y-2">
                          <h4 className="text-[13px] font-semibold text-[#1e293b]">Key Achievements:</h4>
                          <ul className="space-y-1.5">
                            {exp.achievements.map((achievement, index) => (
                              <li key={index} className="flex items-start gap-2 text-[13px] text-[#475569]">
                                <CheckCircle2 className="w-4 h-4 text-[#10b981] flex-shrink-0 mt-0.5" />
                                <span>{achievement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio & Accepted Work Tab */}
          {activeTab === "portfolio" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[20px] font-semibold text-[#1e293b]">Accepted Work & Projects</h2>
                <div className="flex items-center gap-2 text-[14px] text-[#64748b]">
                  <Award className="w-4 h-4 text-[#10b981]" />
                  <span className="font-semibold text-[#1e293b]">{acceptedWorks.filter(w => w.status === "Completed").length}</span> Completed Projects
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acceptedWorks.map((work) => (
                  <div key={work.id} className="bg-white border border-[#e2e8f0] rounded-[16px] p-6 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center text-white font-bold text-[16px] shadow-md flex-shrink-0">
                          {work.companyLogo}
                        </div>
                        <div>
                          <h3 className="text-[16px] font-bold text-[#1e293b] mb-1">{work.title}</h3>
                          <p className="text-[13px] text-[#64748b]">{work.company}</p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-[8px] text-[12px] font-semibold ${
                          work.status === "Completed"
                            ? "bg-[#dcfce7] text-[#16a34a]"
                            : "bg-[#fef3c7] text-[#92400e]"
                        }`}
                      >
                        {work.status}
                      </span>
                    </div>

                    <p className="text-[13px] text-[#475569] mb-4">{work.description}</p>

                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-4 h-4 text-[#10b981]" />
                      <span className="text-[16px] font-bold text-[#10b981]">{work.salary}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {work.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2.5 py-1 bg-[#f1f5f9] text-[#475569] rounded-[6px] text-[11px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-[#64748b] pt-3 border-t border-[#e2e8f0]">
                      <Calendar className="w-3.5 h-3.5" />
                      {work.completedDate}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Earnings */}
              <div className="bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] border border-[#86efac] rounded-[16px] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] text-[#166534] mb-1">Total Earnings from Accepted Work</p>
                    <h3 className="text-[32px] font-bold text-[#15803d]">₱550,000</h3>
                    <p className="text-[13px] text-[#166534] mt-1">
                      From {acceptedWorks.filter(w => w.status === "Completed").length} completed projects
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-[16px] bg-[#16a34a] flex items-center justify-center">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
