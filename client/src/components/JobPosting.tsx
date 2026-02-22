import { useEffect, useState } from "react";
import { 
  Check,
  Bold,
  Italic,
  Underline,
  List,
  RotateCcw,
  Maximize2,
  X,
  Sparkles,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "../lib/toast";
import { useNavigate } from "react-router-dom";
import { createJob, getCategories } from "../services/api";
import { ROUTES } from "../utils/routes";

interface Responsibility {
  id: string;
  text: string;
}

interface HiringStage {
  id: string;
  name: string;
}

interface ScoreCriteria {
  id: string;
  label: string;
  weight: number;
}

interface ApplicationField {
  id: string;
  label: string;
  required: boolean;
}

export function JobPosting() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [jobType, setJobType] = useState("Fulltime");
  const [deadline, setDeadline] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [requirementsText, setRequirementsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [jobDescription, setJobDescription] = useState(
    "We are seeking a talented React Native Mobile Developer to join our dynamic and innovative development team. The ideal candidate will have a strong background in mobile application development, with a focus on building cross-platform applications using React Native. As a React Native Mobile Developer, you will collaborate with a..."
  );

  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([
    { 
      id: "1", 
      text: "Innovation: Develop and test new IT solutions, products, and services through creative experimentation and prototyping." 
    },
    { 
      id: "2", 
      text: "Collaboration: Work closely with cross-functional teams providing technical expertise and insights." 
    },
    { 
      id: "3", 
      text: "Project Management: Manage R&D projects, ensuring they are completed on time and within budget." 
    }
  ]);

  const [skills, setSkills] = useState<string[]>([
    "Analytical Thinking",
    "Communication",
    "Data Analysis",
    "Project Management",
    "Innovation",
    "Organization"
  ]);

  const [newSkill, setNewSkill] = useState("");

  const steps = [
    { number: 1, label: "Job Details", sectionId: "job-step-1" },
    { number: 2, label: "Job Requirement", sectionId: "job-step-2" },
    { number: 3, label: "Hiring Stage", sectionId: "job-step-3" },
    { number: 4, label: "Score card", sectionId: "job-step-4" },
    { number: 5, label: "Application Form", sectionId: "job-step-5" },
  ];

  const [hiringStages, setHiringStages] = useState<HiringStage[]>([
    { id: "1", name: "Application Review" },
    { id: "2", name: "Interview" },
    { id: "3", name: "Offer" },
  ]);
  const [newStage, setNewStage] = useState("");

  const [scoreCriteria, setScoreCriteria] = useState<ScoreCriteria[]>([
    { id: "1", label: "Technical Skills", weight: 40 },
    { id: "2", label: "Experience", weight: 35 },
    { id: "3", label: "Culture Fit", weight: 25 },
  ]);
  const [newCriteria, setNewCriteria] = useState("");

  const [applicationFields, setApplicationFields] = useState<ApplicationField[]>([
    { id: "full-name", label: "Full name", required: true },
    { id: "email", label: "Email address", required: true },
    { id: "phone", label: "Phone number", required: false },
    { id: "resume", label: "Resume/CV", required: true },
    { id: "portfolio", label: "Portfolio link", required: false },
  ]);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (!isMounted) return;
        setCategories(Array.isArray(data) ? data : []);
      } catch (error: any) {
        if (!isMounted) return;
        toast.error(error?.message || "Failed to load categories.");
      }
    };
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const addResponsibility = () => {
    const newId = String(responsibilities.length + 1);
    setResponsibilities([
      ...responsibilities,
      { id: newId, text: "" }
    ]);
  };

  const removeResponsibility = (id: string) => {
    setResponsibilities(responsibilities.filter(r => r.id !== id));
  };

  const updateResponsibility = (id: string, text: string) => {
    setResponsibilities(
      responsibilities.map(r => r.id === id ? { ...r, text } : r)
    );
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleGenerateAI = () => {
    toast.success("AI-generated job description added!");
  };

  const handleSave = async () => {
    const responsibilitiesList = responsibilities.map((item) => item.text.trim()).filter(Boolean);
    const requirementsList = requirementsText
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!jobTitle || !jobDescription || !location || !salary || !jobType || !deadline) {
      toast.error("Please fill in all required job details.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createJob({
        title: jobTitle,
        description: jobDescription,
        location,
        salary,
        jobType,
        deadline,
        skills,
        responsibilities: responsibilitiesList,
        requirements: requirementsList,
        category: categoryId || undefined,
      });
      toast.success("Job posting created successfully!");
      navigate(ROUTES.employer.jobs);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToStep = (stepNumber: number, sectionId: string) => {
    setCurrentStep(stepNumber);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const addHiringStage = () => {
    if (!newStage.trim()) return;
    setHiringStages([
      ...hiringStages,
      { id: Date.now().toString(), name: newStage.trim() },
    ]);
    setNewStage("");
  };

  const updateHiringStage = (id: string, name: string) => {
    setHiringStages(hiringStages.map((stage) => stage.id === id ? { ...stage, name } : stage));
  };

  const removeHiringStage = (id: string) => {
    setHiringStages(hiringStages.filter((stage) => stage.id !== id));
  };

  const addScoreCriteria = () => {
    if (!newCriteria.trim()) return;
    setScoreCriteria([
      ...scoreCriteria,
      { id: Date.now().toString(), label: newCriteria.trim(), weight: 10 },
    ]);
    setNewCriteria("");
  };

  const updateScoreCriteria = (id: string, updates: Partial<ScoreCriteria>) => {
    setScoreCriteria(scoreCriteria.map((criteria) => criteria.id === id ? { ...criteria, ...updates } : criteria));
  };

  const removeScoreCriteria = (id: string) => {
    setScoreCriteria(scoreCriteria.filter((criteria) => criteria.id !== id));
  };

  const toggleFieldRequired = (id: string) => {
    setApplicationFields(applicationFields.map((field) => field.id === id ? { ...field, required: !field.required } : field));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#1C4D8D] font-medium mb-3 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
            <h1 className="text-[28px] font-bold text-gray-900 mb-2">Post a New Job</h1>
            <p className="text-[14px] text-gray-600">Fill in the details to create a new job posting</p>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Left Sidebar - Steps */}
          <div className="w-[240px] flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.number}>
                    <button
                      onClick={() => scrollToStep(step.number, step.sectionId)}
                      className={`w-full flex items-center gap-3 text-left transition-colors ${
                        currentStep === step.number ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.number < currentStep
                            ? "bg-green-500 text-white"
                            : currentStep === step.number
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {step.number < currentStep ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text-[13px] font-medium">{step.number}</span>
                        )}
                      </div>
                      <span className="text-[14px] font-medium">{step.label}</span>
                    </button>
                    {index < steps.length - 1 && (
                      <div className="ml-4 mt-2 mb-2 h-8 border-l-2 border-gray-200"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Job Description Section */}
            <section id="job-step-1" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-semibold text-gray-900">
                  Job Description and Responsibilities
                </h2>
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-[13px] text-gray-700 mb-2">Job Title *</label>
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Senior Frontend Developer"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-gray-700 mb-2">Location *</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Manila, Philippines"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-gray-700 mb-2">Salary *</label>
                  <input
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. ₱60,000 - ₱90,000"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-gray-700 mb-2">Job Type *</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Fulltime">Fulltime</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-gray-700 mb-2">Deadline *</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-gray-700 mb-2">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[13px] text-gray-700 mb-2">About the job</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Toolbar */}
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      <Bold className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      <Italic className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      <Underline className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      <List className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      <RotateCcw className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors">
                      <Maximize2 className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  {/* Text Area */}
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full p-4 text-[14px] text-gray-700 leading-relaxed min-h-[120px] resize-none focus:outline-none"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[13px] text-gray-700 mb-3">Responsibilities</label>
                <div className="space-y-3">
                  {responsibilities.map((responsibility) => (
                    <div key={responsibility.id} className="flex items-start gap-3">
                      <textarea
                        value={responsibility.text}
                        onChange={(e) => updateResponsibility(responsibility.id, e.target.value)}
                        placeholder="Enter responsibility..."
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                      <button
                        onClick={() => removeResponsibility(responsibility.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addResponsibility}
                  className="mt-3 text-[14px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4" /> Add Responsibilities
                </button>
              </div>
            </section>

            {/* Requirements and Skills Section */}
            <section id="job-step-2" className="bg-white rounded-xl border border-gray-200 p-6 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-semibold text-gray-900">
                  Requirement and Skills
                </h2>
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[13px] text-gray-700 mb-3">Skills</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {skills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-[13px] text-gray-700"
                    >
                      <span>{skill}</span>
                      <button
                        onClick={() => removeSkill(skill)}
                        className="hover:text-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addSkill()}
                    placeholder="Add a skill..."
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addSkill}
                    className="px-4 py-2 bg-blue-600 text-white text-[14px] font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-gray-700 mb-2">Requirement</label>
                <textarea
                  placeholder="Enter job requirements..."
                  value={requirementsText}
                  onChange={(e) => setRequirementsText(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
            </section>

            {/* Hiring Stage */}
            <section id="job-step-3" className="bg-white rounded-xl border border-gray-200 p-6 mt-6 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-semibold text-gray-900">Hiring Stage</h2>
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-[12px] font-semibold text-gray-600">{hiringStages.length}</span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {hiringStages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[12px] font-semibold">
                      {index + 1}
                    </div>
                    <input
                      value={stage.name}
                      onChange={(e) => updateHiringStage(stage.id, e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeHiringStage(stage.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  placeholder="Add a stage..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addHiringStage}
                  className="px-4 py-2.5 bg-blue-600 text-white text-[14px] font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  Add
                </button>
              </div>
            </section>

            {/* Score Card */}
            <section id="job-step-4" className="bg-white rounded-xl border border-gray-200 p-6 mt-6 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-semibold text-gray-900">Score card</h2>
                <span className="text-[12px] text-gray-500">Weight in %</span>
              </div>
              <div className="space-y-3 mb-4">
                {scoreCriteria.map((criteria) => (
                  <div key={criteria.id} className="flex items-center gap-3">
                    <input
                      value={criteria.label}
                      onChange={(e) => updateScoreCriteria(criteria.id, { label: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={criteria.weight}
                      onChange={(e) => updateScoreCriteria(criteria.id, { weight: Number(e.target.value) })}
                      className="w-[90px] px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0}
                      max={100}
                    />
                    <button
                      onClick={() => removeScoreCriteria(criteria.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCriteria}
                  onChange={(e) => setNewCriteria(e.target.value)}
                  placeholder="Add criteria..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addScoreCriteria}
                  className="px-4 py-2.5 bg-blue-600 text-white text-[14px] font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  Add
                </button>
              </div>
            </section>

            {/* Application Form */}
            <section id="job-step-5" className="bg-white rounded-xl border border-gray-200 p-6 mt-6 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-semibold text-gray-900">Application Form</h2>
                <span className="text-[12px] text-gray-500">Toggle required fields</span>
              </div>
              <div className="space-y-3">
                {applicationFields.map((field) => (
                  <div key={field.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium text-gray-900">{field.label}</p>
                      <p className="text-[12px] text-gray-500">{field.required ? "Required" : "Optional"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFieldRequired(field.id)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                        field.required
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {field.required ? "Required" : "Make required"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 text-[14px] font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 text-[14px] font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className={`px-6 py-2.5 bg-blue-600 text-white text-[14px] font-medium rounded-lg transition-colors ${
                    isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700"
                  }`}
                >
                  {isSubmitting ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar - AI Assistant */}
          <div className="w-[320px] flex-shrink-0">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-gray-900 mb-1">
                    Generate your job description using AI
                  </h3>
                </div>
              </div>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                Save your time creating job descriptions, choose certain keywords for your job and let AI arrange it afterwards.
              </p>
              <button
                onClick={handleGenerateAI}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-blue-200 text-blue-600 text-[14px] font-medium rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate
              </button>
            </div>

            {/* Tips */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-[15px] font-semibold text-gray-900 mb-3">Tips for a great job post</h3>
              <ul className="space-y-2 text-[13px] text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Be clear and specific about the role</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>List must-have vs nice-to-have skills</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Include salary range when possible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Mention company culture and benefits</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
