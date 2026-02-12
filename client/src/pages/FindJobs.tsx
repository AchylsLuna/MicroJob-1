import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { categoriesAPI, jobsAPI } from "../services/jobs";

interface CategoryItem {
  _id: string;
  name: string;
}

interface JobItem {
  _id: string;
  title: string;
  salary: string;
  description: string;
  location: string;
  jobType: string;
  urgent?: boolean;
  category?: { _id?: string; name?: string };
  jobPoster?: { _id?: string; id?: string; firstName?: string; lastName?: string };
}

const FindJobs: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filterOptions = ["Fulltime", "Freelance", "Remote", "Part-time"];
  const sortOptions = ["Newest"];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getCategories();
        setCategories(response.data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchAppliedJobs = async () => {
      try {
        const response = await jobsAPI.getUserApplications();
        const apps = response.data || [];
        const ids = new Set<string>(apps.map((app: { job?: { _id?: string } }) => app.job?._id).filter(Boolean));
        setAppliedJobIds(ids);
      } catch (err) {
        console.error("Failed to load applications", err);
      }
    };

    if (user) {
      fetchAppliedJobs();
    }
  }, [user]);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: { category?: string; jobType?: string; search?: string; excludeOwn?: boolean } = {};
        if (selectedCategory !== "All") params.category = selectedCategory;
        if (selectedFilters.length > 0) params.jobType = selectedFilters.join(",");
        if (searchQuery) params.search = searchQuery;
        params.excludeOwn = true;

        const response = await jobsAPI.getJobs(params);
        setJobs(response.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load jobs.");
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchJobs, 300);
    return () => clearTimeout(debounce);
  }, [selectedCategory, selectedFilters, searchQuery]);

  const toggleFilter = (filter: string) => {
    if (selectedFilters.includes(filter)) {
      setSelectedFilters(selectedFilters.filter((f) => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
  };

  const authUserId = user?.id || (user as any)?._id;
  const displayedJobs = jobs.filter((job) => !appliedJobIds.has(job._id));

  return (
    <div>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 mb-8">
        <h1 className="text-4xl font-bold mb-2">Find jobs</h1>
        <p className="text-blue-100">Discover and apply jobs that match your skills and interests</p>
      </div>

      {/* Content */}
      <div className="px-8 pb-20">
          {/* Search and Filters Bar */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by skills, name, or expertise..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
                <span className="absolute right-4 top-3.5 text-gray-400">🔍</span>
              </div>
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilters([]);
                  setSelectedCategory("All");
                }}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 flex items-center gap-2"
              >
                Clear Filters
              </button>
            </div>

            {/* Category Buttons */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[{ _id: "All", name: "All" }, ...categories].map((category) => (
                <button
                  key={category._id}
                  onClick={() => setSelectedCategory(category._id)}
                  className={`px-6 py-2 rounded-full font-semibold whitespace-nowrap transition ${
                    selectedCategory === category._id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Showing {displayedJobs.length} Jobs Results</h2>
              <p className="text-gray-600 text-sm">
                {selectedCategory !== "All" && `in ${categories.find((c) => c._id === selectedCategory)?.name || "Category"} • `}
                {selectedFilters.length > 0 && `${selectedFilters.join(", ")} • `}
                {searchQuery && `for "${searchQuery}"`}
                {!searchQuery && selectedFilters.length === 0 && selectedCategory === "All" && "Based on your preferences"}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              {filterOptions.map((filter) => (
                <button
                  key={filter}
                  onClick={() => toggleFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                    selectedFilters.includes(filter)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
              <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">
                {sortOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Jobs Grid */}
          {loading && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-gray-600 mb-6">
              Loading jobs...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedJobs.map((job) => {
              const posterId = job.jobPoster?._id || job.jobPoster?.id;
              const isOwnJob = !!authUserId && !!posterId && posterId === authUserId;

              return (
              <div
                key={job._id}
                onClick={() => navigate(`/dashboard/job-details/${job._id}`)}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xl">
                    {job.title.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm mb-1">{job.title}</h3>
                    {job.jobPoster && (
                      <p className="text-xs text-gray-500 mb-1">
                        Posted by {job.jobPoster.firstName} {job.jobPoster.lastName}
                      </p>
                    )}
                    <p className="text-green-600 font-bold text-sm">{job.salary}</p>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
                    {job.category?.name || "Uncategorized"}
                  </span>
                  {job.urgent ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                      Urgent
                    </span>
                  ) : null}
                </div>

                {/* Description */}
                <p className="text-gray-700 text-sm mb-4 line-clamp-3">{job.description}</p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600 text-xs">
                    <span>📍 {job.location}</span>
                    <span>•</span>
                    <span>{job.jobType}</span>
                  </div>
                  {!isOwnJob && (
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            );
            })}
          </div>

          {/* Empty State */}
          {!loading && displayedJobs.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Jobs Found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or search terms to find more jobs.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilters([]);
                  setSelectedCategory("All");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition"
              >
                Clear All Filters
              </button>
            </div>
          )}
      </div>
    </div>
  );
};

export default FindJobs;
