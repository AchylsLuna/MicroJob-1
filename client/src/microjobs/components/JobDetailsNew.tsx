import { useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Heart, Star } from "lucide-react";
import { toast } from "../lib/toast";

interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  location: string;
  salary: string;
  postedDays: number;
  applicants: number;
  level: string;
  type: string;
  workMode: string;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  founded?: string;
  companyLocation?: string;
  rating?: number;
  paymentVerified?: boolean;
  spend?: string;
  services?: string[];
}

const mockJobs: Job[] = [
  {
    id: "1",
    title: "Sr. UX Designer",
    company: "Netflix",
    companyLogo: "N",
    location: "Remote",
    salary: "$195/hr",
    postedDays: 5,
    applicants: 14,
    level: "Expert",
    type: "Part-Time",
    workMode: "Remote",
    description: "Netflix is one of the world's leading streaming entertainment service with over 238 million paid memberships in over 190 countries enjoying TV series, films and games across a wide variety of genres and languages. Members can play, pause, and resume watching as much as they want, anytime, anywhere, and can change their plans at any time.",
    responsibilities: [
      "We want you to have a deep understanding of the tools and services that are offered through WB Games New York. While we don't expect you to write code, we are looking for a level of curiosity from a technical standpoint. We want you to explore and ask plenty of questions.",
      "You will work directly with our engineers to design user interfaces and dashboards around the complex services that they are delivering.",
      "We are expecting you to create wireframes, interactive prototypes, and documentation of the frontends that you will be designing."
    ],
    requiredSkills: ["Wireframing", "Figma", "Adobe XD", "UX/UI Designer", "Team work"],
    founded: "January 6, 1997",
    companyLocation: "San Francisco, USA",
    rating: 5,
    paymentVerified: true,
    spend: "$65k + Spend",
    services: ["Web & App Design", "Backend", "FedRAMP", "Compliance", "Frontend", "Offensive Security"]
  },
  {
    id: "2",
    title: "Product designer",
    company: "Microsoft",
    companyLogo: "M",
    location: "Remote",
    salary: "$210/hr",
    postedDays: 4,
    applicants: 55,
    level: "Intermediate",
    type: "Full-Time",
    workMode: "Remote",
    description: "Welcome to Lightspeed LA, the first U.S.-based, AAA game development studio...",
    responsibilities: [],
    requiredSkills: [],
    services: []
  },
  {
    id: "3",
    title: "Backend Dev.",
    company: "Google",
    companyLogo: "G",
    location: "Remote",
    salary: "$180/hr",
    postedDays: 4,
    applicants: 21,
    level: "Intermediate",
    type: "Full-Time",
    workMode: "Remote",
    description: "Codfire is on a mission to make the world a better place...",
    responsibilities: [],
    requiredSkills: [],
    services: []
  }
];

export function JobDetailsNew() {
  const { jobId } = useParams();
  const [selectedJobId, setSelectedJobId] = useState(jobId || "1");
  const [savedJobs, setSavedJobs] = useState<string[]>([]);

  const selectedJob = mockJobs.find(j => j.id === selectedJobId) || mockJobs[0];

  const toggleSaveJob = (id: string) => {
    if (savedJobs.includes(id)) {
      setSavedJobs(savedJobs.filter(jobId => jobId !== id));
      toast.success("Job removed from saved");
    } else {
      setSavedJobs([...savedJobs, id]);
      toast.success("Job saved successfully");
    }
  };

  const handleApply = () => {
    toast.success("Application submitted successfully!");
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "expert": return "bg-purple-100 text-purple-700";
      case "intermediate": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "full-time": return "bg-green-100 text-green-700";
      case "part-time": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-8 px-8">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          <h1 className="text-[32px] font-bold">Find Your Dream Job Here</h1>
          <div className="text-white text-[40px]">✦</div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-8">
        <div className="flex gap-6">
          {/* Left Sidebar - Job List */}
          <div className="w-[280px] flex-shrink-0 space-y-4">
            {mockJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`w-full bg-white rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                  selectedJobId === job.id ? "border-blue-500" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-[18px] ${
                      job.companyLogo === "N" ? "bg-red-600" :
                      job.companyLogo === "M" ? "bg-gradient-to-br from-blue-500 to-cyan-400" :
                      "bg-gradient-to-br from-blue-600 to-green-500"
                    }`}>
                      {job.companyLogo}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px] text-gray-900">{job.title}</h3>
                      <p className="text-[12px] text-gray-500">{job.company} • {job.applicants} Applicants</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveJob(job.id);
                    }}
                    className="p-1"
                  >
                    <Heart className={`w-5 h-5 ${savedJobs.includes(job.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-1 rounded-md text-[11px] font-medium ${getLevelColor(job.level)}`}>
                    {job.level}
                  </span>
                  <span className={`px-2 py-1 rounded-md text-[11px] font-medium ${getTypeColor(job.type)}`}>
                    {job.type}
                  </span>
                  <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-amber-100 text-amber-700">
                    {job.workMode}
                  </span>
                </div>

                <p className="text-[13px] text-gray-600 mb-3 line-clamp-2">
                  {job.description}
                </p>

                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-gray-900">{job.salary}</span>
                  <span className="text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Posted {job.postedDays} days ago
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Main Content - Job Details */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-8">
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-[32px] font-bold text-gray-900">{selectedJob.title}</h1>
                <button
                  onClick={() => toggleSaveJob(selectedJob.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Heart className={`w-6 h-6 ${savedJobs.includes(selectedJob.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-[13px] font-medium ${getLevelColor(selectedJob.level)}`}>
                  {selectedJob.level}
                </span>
                <span className={`px-3 py-1.5 rounded-lg text-[13px] font-medium ${getTypeColor(selectedJob.type)}`}>
                  {selectedJob.type}
                </span>
                <span className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-amber-100 text-amber-700">
                  {selectedJob.workMode}
                </span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-[20px] font-semibold text-gray-900 mb-4">About the role</h2>
              <p className="text-[15px] text-gray-600 leading-relaxed">
                {selectedJob.description}
              </p>
            </div>

            {selectedJob.responsibilities.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[20px] font-semibold text-gray-900 mb-4">Responsibilities</h2>
                <ul className="space-y-3">
                  {selectedJob.responsibilities.map((responsibility, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0"></div>
                      <p className="text-[15px] text-gray-600 leading-relaxed">{responsibility}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedJob.requiredSkills.length > 0 && (
              <div>
                <h2 className="text-[20px] font-semibold text-gray-900 mb-4">Required skills:</h2>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-[14px] font-medium rounded-lg"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Company Info */}
          <div className="w-[320px] flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-200">
                <div className="w-14 h-14 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-[24px]">{selectedJob.companyLogo}</span>
                </div>
                <div>
                  <h3 className="font-bold text-[18px] text-gray-900 flex items-center gap-2">
                    {selectedJob.company}
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </h3>
                </div>
              </div>

              {selectedJob.founded && (
                <div className="mb-4">
                  <p className="text-[13px] font-semibold text-gray-900 mb-1">Founded</p>
                  <p className="text-[14px] text-gray-600">{selectedJob.founded}</p>
                </div>
              )}

              {selectedJob.companyLocation && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <p className="text-[13px] font-semibold text-gray-900 mb-1">Location</p>
                  <p className="text-[14px] text-gray-600">{selectedJob.companyLocation}</p>
                </div>
              )}

              <div className="mb-6 pb-6 border-b border-gray-200">
                <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Other Information</h3>
                
                {selectedJob.rating && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-[13px] text-gray-600">Payment verified</p>
                  </div>
                )}

                {selectedJob.spend && (
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900 mb-1">{selectedJob.spend}</p>
                    <p className="text-[13px] text-gray-600">Payment verified</p>
                  </div>
                )}
              </div>

              {selectedJob.services && selectedJob.services.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[15px] font-semibold text-gray-900 mb-3">Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.services.map((service) => (
                      <span
                        key={service}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-[12px] font-medium rounded-md"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleApply}
                className="w-full py-3 bg-blue-600 text-white font-semibold text-[15px] rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
