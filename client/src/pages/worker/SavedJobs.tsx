import { MapPin, Building2, Briefcase, Clock, Users, Bookmark, Trash2, ExternalLink, DollarSign, Calendar } from "lucide-react";
import { toast } from "../../lib/toast";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Job {
  id: string;
  title: string;
  company: string;
  salary: string;
  description: string;
  location: string;
  type: "Remote" | "Hybrid" | "On-site";
  posted: string;
  applicants: number;
  logo: string;
  saved: boolean;
  deadline: string;
  requirements: string[];
}

const initialJobs: Job[] = [
  {
    id: "1",
    title: "Senior React Developer",
    company: "Tech Solutions Inc.",
    salary: "₱80,000 - ₱120,000",
    description: "We're looking for an experienced React developer to join our growing team. Work on cutting-edge projects with modern tech stack including React, TypeScript, and GraphQL.",
    location: "Manila, PH",
    type: "Remote",
    posted: "2 days ago",
    applicants: 24,
    logo: "TS",
    saved: true,
    deadline: "Feb 15, 2026",
    requirements: ["React", "TypeScript", "GraphQL"]
  },
  {
    id: "2",
    title: "Full Stack Developer",
    company: "Innovation Labs",
    salary: "₱70,000 - ₱100,000",
    description: "Join our dynamic team building next-generation SaaS products. Experience with React, Node.js, and AWS required. Great benefits and work-life balance.",
    location: "Cebu, PH",
    type: "Hybrid",
    posted: "5 days ago",
    applicants: 18,
    logo: "IL",
    saved: true,
    deadline: "Feb 20, 2026",
    requirements: ["React", "Node.js", "AWS"]
  },
  {
    id: "3",
    title: "Mobile Developer",
    company: "Digital Ventures",
    salary: "₱75,000 - ₱110,000",
    description: "Build amazing mobile experiences with React Native. Competitive salary and benefits package included. Work with a talented team on innovative projects.",
    location: "Makati, PH",
    type: "On-site",
    posted: "1 week ago",
    applicants: 31,
    logo: "DV",
    saved: true,
    deadline: "Feb 18, 2026",
    requirements: ["React Native", "iOS", "Android"]
  },
  {
    id: "4",
    title: "Frontend Engineer",
    company: "Cloud Systems Corp",
    salary: "₱65,000 - ₱95,000",
    description: "Looking for a passionate frontend engineer to build beautiful and responsive user interfaces. Work with modern frameworks and tools.",
    location: "BGC, PH",
    type: "Hybrid",
    posted: "3 days ago",
    applicants: 42,
    logo: "CS",
    saved: true,
    deadline: "Feb 25, 2026",
    requirements: ["HTML/CSS", "JavaScript", "React"]
  },
  {
    id: "5",
    title: "UI/UX Developer",
    company: "Design Studio Pro",
    salary: "₱60,000 - ₱90,000",
    description: "Combine your design and development skills to create exceptional user experiences. Must have strong portfolio and experience with Figma.",
    location: "Quezon City, PH",
    type: "Remote",
    posted: "4 days ago",
    applicants: 27,
    logo: "DS",
    saved: true,
    deadline: "Feb 22, 2026",
    requirements: ["Figma", "React", "CSS"]
  },
  {
    id: "6",
    title: "Backend Developer",
    company: "DataTech Solutions",
    salary: "₱70,000 - ₱105,000",
    description: "Build scalable backend systems and APIs. Experience with Node.js, PostgreSQL, and microservices architecture required.",
    location: "Pasig, PH",
    type: "On-site",
    posted: "6 days ago",
    applicants: 19,
    logo: "DT",
    saved: true,
    deadline: "Feb 28, 2026",
    requirements: ["Node.js", "PostgreSQL", "Docker"]
  },
];

export function SavedJobs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [filter, setFilter] = useState<"all" | "Remote" | "Hybrid" | "On-site">("all");

  const handleUnsave = (jobId: string) => {
    setJobs(jobs.filter(job => job.id !== jobId));
    toast.success("Job removed from saved list");
  };

  const handleApply = (jobId: string, jobTitle: string) => {
    toast.info(`Starting application for: ${jobTitle}`);
    navigate(`/dashboard/job-details-new/${jobId}`);
  };

  const handleViewDetails = (jobId: string) => {
    navigate(`/dashboard/job-details-new/${jobId}`);
  };

  const filteredJobs = jobs.filter(job => {
    if (filter !== "all" && job.type !== filter) {
      return false;
    }
    if (!searchQuery) {
      return true;
    }
    const combined = `${job.title} ${job.company} ${job.location} ${job.requirements.join(" ")}`.toLowerCase();
    return combined.includes(searchQuery);
  });

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] text-[#6B7280]">
            You have {jobs.length} saved job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
              filter === "all"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
          >
            All Jobs
          </button>
          <button
            onClick={() => setFilter("Remote")}
            className={`px-4 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
              filter === "Remote"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
          >
            Remote
          </button>
          <button
            onClick={() => setFilter("Hybrid")}
            className={`px-4 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
              filter === "Hybrid"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
          >
            Hybrid
          </button>
          <button
            onClick={() => setFilter("On-site")}
            className={`px-4 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
              filter === "On-site"
                ? "bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white shadow-md"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
          >
            On-site
          </button>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 hover:shadow-lg hover:border-[#1C4D8D] transition-all duration-300 group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-14 h-14 rounded-[14px] bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] flex items-center justify-center text-white font-bold text-[16px] shadow-md flex-shrink-0">
                  {job.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[18px] font-bold text-[#111827] mb-1 group-hover:text-[#1C4D8D] transition-colors">
                    {job.title}
                  </h3>
                  <p className="text-[13px] text-[#6B7280] flex items-center gap-1 mb-2">
                    <Building2 className="w-3.5 h-3.5" />
                    {job.company}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold ${
                      job.type === 'Remote' ? 'bg-[#DBEAFE] text-[#1E40AF]' :
                      job.type === 'Hybrid' ? 'bg-[#FEF3C7] text-[#92400E]' :
                      'bg-[#D1FAE5] text-[#065F46]'
                    }`}>
                      {job.type}
                    </span>
                    <div className="flex items-center gap-1 text-[12px] text-[#6B7280]">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleUnsave(job.id)}
                className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors group/delete"
                title="Remove from saved"
              >
                <Trash2 className="w-5 h-5 text-[#6B7280] group-hover/delete:text-[#EF4444]" />
              </button>
            </div>

            {/* Salary */}
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-[#10B981]" />
              <p className="text-[16px] font-bold text-[#10B981]">{job.salary}</p>
              <span className="text-[12px] text-[#6B7280]">/ month</span>
            </div>

            {/* Description */}
            <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4 line-clamp-2">
              {job.description}
            </p>

            {/* Requirements */}
            <div className="mb-4">
              <p className="text-[12px] text-[#6B7280] mb-2">Required Skills:</p>
              <div className="flex flex-wrap gap-2">
                {job.requirements.map((req, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-[#F3F4F6] text-[#111827] rounded-[8px] text-[11px] font-medium"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
              <div className="flex items-center gap-4 text-[12px] text-[#6B7280]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {job.posted}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {job.applicants} applicants
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Deadline: {job.deadline}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => handleApply(job.id, job.title)}
                className="flex-1 bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] text-white font-semibold py-3 px-4 rounded-[10px] hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Briefcase className="w-4 h-4" />
                Apply Now
              </button>
              <button
                onClick={() => handleViewDetails(job.id)}
                className="px-4 py-3 border border-[#E5E7EB] text-[#6B7280] font-semibold rounded-[10px] hover:bg-[#F9FAFB] transition-colors"
                title="View Details"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 && (
        <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-12 text-center">
          <Bookmark className="w-16 h-16 text-[#D1D5DB] mx-auto mb-4" />
          <h3 className="text-[18px] font-semibold text-[#111827] mb-2">No saved jobs found</h3>
          <p className="text-[14px] text-[#6B7280]">
            {filter === "all" 
              ? "Start saving jobs you're interested in!" 
              : `No ${filter} jobs saved yet.`}
          </p>
        </div>
      )}
    </div>
  );
}
