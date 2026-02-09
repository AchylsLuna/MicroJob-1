import React, { useEffect, useMemo, useState } from "react";
import { getUserProfile, updateUserProfile } from "../services/api";

const PROFILE_STORAGE_KEY = "profile_settings";

const PROVINCE_CITIES: Record<string, string[]> = {
  "Metro Manila": ["Manila", "Quezon City", "Makati", "Pasig", "Taguig"],
  Cavite: ["Bacoor", "Dasmarinas", "Imus"],
  Laguna: ["Calamba", "San Pedro", "Santa Rosa"],
  Cebu: ["Cebu City", "Mandaue", "Lapu-Lapu"],
  "Davao del Sur": ["Davao City", "Digos"],
  Abra: ["Bangued"],
  Apayao: ["Kabugao", "Conner"],
  Benguet: ["Baguio City", "La Trinidad", "Itogon"],
  Ifugao: ["Lagawe", "Banaue"],
  Kalinga: ["Tabuk"],
  "Mountain Province": ["Bontoc", "Sagada"],
  "Ilocos Norte": ["Laoag", "Batac"],
  "Ilocos Sur": ["Vigan", "Candon"],
  "La Union": ["San Fernando", "Agoo"],
  Pangasinan: ["Dagupan", "Urdaneta", "Alaminos"],
  Batanes: ["Basco", "Itbayat"],
  Cagayan: ["Tuguegarao", "Aparri"],
  Isabela: ["Ilagan", "Cauayan", "Santiago"],
  "Nueva Vizcaya": ["Bayombong", "Solano"],
  Quirino: ["Cabarroguis"],
  Aurora: ["Baler"],
  Bataan: ["Balanga", "Mariveles"],
  "Nueva Ecija": ["Cabanatuan", "Gapan", "San Jose"],
  Pampanga: ["San Fernando", "Angeles", "Mabalacat"],
  Tarlac: ["Tarlac City", "Concepcion"],
  Zambales: ["Olongapo", "Iba"],
  Batangas: ["Batangas City", "Lipa", "Tanauan"],
  Quezon: ["Lucena", "Tayabas"],
  Rizal: ["Antipolo", "Taytay", "Cainta"],
  Marinduque: ["Boac"],
  "Occidental Mindoro": ["Mamburao", "San Jose"],
  "Oriental Mindoro": ["Calapan", "Naujan"],
  Palawan: ["Puerto Princesa", "El Nido"],
  Romblon: ["Romblon", "Odiongan"],
  Albay: ["Legazpi", "Tabaco"],
  "Camarines Norte": ["Daet"],
  "Camarines Sur": ["Naga", "Iriga"],
  Catanduanes: ["Virac"],
  Masbate: ["Masbate City"],
  Sorsogon: ["Sorsogon City"],
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("personal");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    city: "",
    province: "",
    address: "",
    phoneNumber: "",
    email: "",
    facebook: "",
    profilePhoto: null as File | null,
    profilePhotoName: "",
    profilePhotoPreview: "",
  });

  const [experience, setExperience] = useState({
    jobPosition: "",
    companyName: "",
    startDate: "",
    endDate: "",
    logo: null as File | null,
    logoName: "",
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvFileName, setCvFileName] = useState("");
  const [showProvinceList, setShowProvinceList] = useState(false);
  const [showCityList, setShowCityList] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveNoticeType, setSaveNoticeType] = useState<"success" | "error">("success");
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");

  useEffect(() => {
    const authRaw = localStorage.getItem("auth_user");
    if (authRaw) {
      try {
        const authUser = JSON.parse(authRaw) as {
          firstName?: string;
          lastName?: string;
          email?: string;
          phoneNumber?: string;
        };

        setFormData((prev) => ({
          ...prev,
          firstName: authUser.firstName || prev.firstName,
          lastName: authUser.lastName || prev.lastName,
          email: authUser.email || prev.email,
          phoneNumber: authUser.phoneNumber || prev.phoneNumber,
        }));
      } catch (err) {
        console.warn("Failed to parse auth_user", err);
      }
    }

    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          personal?: typeof formData;
          experience?: typeof experience;
          resume?: { fileName?: string };
        };

        if (parsed.personal) {
          setFormData((prev) => ({
            ...prev,
            ...parsed.personal,
            profilePhoto: null,
          }));
          if (parsed.personal.profilePhotoPreview) {
            setProfilePhotoPreview(parsed.personal.profilePhotoPreview);
          }
        }
        if (parsed.experience) {
          setExperience((prev) => ({
            ...prev,
            ...parsed.experience,
            logo: null,
          }));
        }
        if (parsed.resume?.fileName) {
          setCvFileName(parsed.resume.fileName);
        }
      } catch (err) {
        console.warn("Failed to parse profile settings", err);
      }
    }

    const loadProfile = async () => {
      try {
        const response = await getUserProfile();
        const profile = response.profile || {};
        let storedPreview = "";
        try {
          const storedRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
          const stored = storedRaw ? JSON.parse(storedRaw) : {};
          storedPreview = stored.personal?.profilePhotoPreview || "";
        } catch {
          storedPreview = "";
        }

        setFormData((prev) => ({
          ...prev,
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          city: profile.city || "",
          province: profile.province || "",
          address: profile.address || "",
          phoneNumber: profile.phoneNumber || "",
          email: profile.email || "",
          facebook: profile.facebook || "",
          profilePhotoName: profile.profilePhotoName || prev.profilePhotoName,
          profilePhotoPreview: prev.profilePhotoPreview,
          profilePhoto: null,
        }));

        setExperience((prev) => ({
          ...prev,
          jobPosition: profile.jobPosition || "",
          companyName: profile.companyName || "",
          startDate: profile.startDate || "",
          endDate: profile.endDate || "",
          logoName: profile.logoName || prev.logoName,
          logo: null,
        }));

        if (profile.resumeFileName) {
          setCvFileName(profile.resumeFileName);
        }

        saveProfileSettings({
          personal: {
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            city: profile.city || "",
            province: profile.province || "",
            address: profile.address || "",
            phoneNumber: profile.phoneNumber || "",
            email: profile.email || "",
            facebook: profile.facebook || "",
            profilePhotoName: profile.profilePhotoName || "",
            profilePhotoPreview: storedPreview,
            profilePhoto: null,
          },
          experience: {
            jobPosition: profile.jobPosition || "",
            companyName: profile.companyName || "",
            startDate: profile.startDate || "",
            endDate: profile.endDate || "",
            logoName: profile.logoName || "",
            logo: null,
          },
          resume: { fileName: profile.resumeFileName || "" },
        });
      } catch (err) {
        console.warn("Failed to load profile from backend", err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    if (!saveNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSaveNotice(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "province" ? { city: "" } : null),
    }));
  };

  const handleExperienceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setExperience((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      profilePhoto: file,
      profilePhotoName: file?.name || prev.profilePhotoName,
    }));
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setProfilePhotoPreview(reader.result);
          saveProfileSettings({
            personal: {
              ...formData,
              profilePhoto: null,
              profilePhotoName: file.name,
              profilePhotoPreview: reader.result,
            },
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setExperience((prev) => ({
      ...prev,
      logo: file,
      logoName: file?.name || prev.logoName,
    }));
  };

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCvFile(file);
    setCvFileName(file?.name || cvFileName);
  };

  const saveProfileSettings = (payload: {
    personal?: typeof formData;
    experience?: typeof experience;
    resume?: { fileName?: string };
  }) => {
    const existingRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const next = { ...existing, ...payload };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("profile_settings_updated"));
  };

  const handleSavePersonal = async () => {
    try {
      const response = await updateUserProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        city: formData.city,
        province: formData.province,
        address: formData.address,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        facebook: formData.facebook,
        profilePhotoName: formData.profilePhotoName,
      });
      const updatedPhotoName = response.profile.profilePhotoName || formData.profilePhotoName;
      saveProfileSettings({
        personal: {
          ...formData,
          profilePhoto: null,
          profilePhotoName: updatedPhotoName,
          profilePhotoPreview,
        },
      });
      setSaveNoticeType("success");
      setSaveNotice("PROFILE UPDATED!");
    } catch (err) {
      console.warn("Failed to save personal info", err);
      setSaveNoticeType("error");
      setSaveNotice(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    }
  };

  const handleSaveExperience = async () => {
    try {
      const response = await updateUserProfile({
        jobPosition: experience.jobPosition,
        companyName: experience.companyName,
        startDate: experience.startDate,
        endDate: experience.endDate,
        logoName: experience.logoName,
      });
      saveProfileSettings({ experience: { ...experience, logo: null, logoName: response.profile.logoName || experience.logoName } });
      setSaveNoticeType("success");
      setSaveNotice("PROFILE UPDATED!");
    } catch (err) {
      console.warn("Failed to save experience", err);
      setSaveNoticeType("error");
      setSaveNotice(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    }
  };

  const handleSaveResume = async () => {
    try {
      const response = await updateUserProfile({
        resumeFileName: cvFileName,
      });
      saveProfileSettings({ resume: { fileName: response.profile.resumeFileName || cvFileName } });
      setSaveNoticeType("success");
      setSaveNotice("PROFILE UPDATED!");
    } catch (err) {
      console.warn("Failed to save resume", err);
      setSaveNoticeType("error");
      setSaveNotice(err instanceof Error ? err.message : "Failed to update profile. Please try again.");
    }
  };

  const provinceOptions = useMemo(() => {
    const options = Object.keys(PROVINCE_CITIES);
    if (formData.province && !options.includes(formData.province)) {
      return [formData.province, ...options];
    }
    return options;
  }, [formData.province]);

  const cityOptions = useMemo(() => {
    const options = PROVINCE_CITIES[formData.province] || [];
    if (formData.city && !options.includes(formData.city)) {
      return [formData.city, ...options];
    }
    return options;
  }, [formData.city, formData.province]);

  const provinceMatches = useMemo(() => {
    const query = formData.province.trim().toLowerCase();
    if (!query) {
      return provinceOptions;
    }
    return provinceOptions.filter((province) => province.toLowerCase().includes(query));
  }, [formData.province, provinceOptions]);

  const cityMatches = useMemo(() => {
    const query = formData.city.trim().toLowerCase();
    if (!query) {
      return cityOptions;
    }
    return cityOptions.filter((city) => city.toLowerCase().includes(query));
  }, [formData.city, cityOptions]);

  return (
    <div>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-20 w-40 h-40 bg-white rounded-full"></div>
            <div className="absolute top-5 right-32 text-4xl">✦ ✦ ✦</div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-400 rounded-full opacity-20"></div>
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2">Settings</h1>
            <p className="text-blue-100">Manage your profile and account settings</p>
          </div>
      </div>

      {/* Content */}
      <div className="px-8 pb-20">
        {saveNotice && (
          <div className="sticky top-6 z-50 flex justify-end">
            <div
              className={`max-w-xs rounded-lg border px-4 py-3 text-sm shadow-lg transition ${
                saveNoticeType === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {saveNotice}
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("personal")}
                className={`flex-1 py-4 px-6 text-center font-semibold transition ${
                  activeTab === "personal"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Personal Information
              </button>
              <button
                onClick={() => setActiveTab("experience")}
                className={`flex-1 py-4 px-6 text-center font-semibold transition ${
                  activeTab === "experience"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Experience
              </button>
              <button
                onClick={() => setActiveTab("cv")}
                className={`flex-1 py-4 px-6 text-center font-semibold transition ${
                  activeTab === "cv"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                CV/Resume
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              {/* Personal Information Tab */}
              {activeTab === "personal" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic details</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">First name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="Enter your first name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Last name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Enter your last name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="block text-gray-700 font-semibold mb-2">Province</label>
                      <input
                        type="text"
                        name="province"
                        value={formData.province}
                        onChange={handleInputChange}
                        placeholder="Type to search province"
                        onFocus={() => setShowProvinceList(true)}
                        onBlur={() => {
                          window.setTimeout(() => setShowProvinceList(false), 150);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                      {showProvinceList && provinceMatches.length > 0 && (
                        <div className="absolute left-0 right-0 bottom-full mb-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                          {provinceMatches.map((province) => (
                            <button
                              key={province}
                              type="button"
                              onMouseDown={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  province,
                                  city: "",
                                }));
                                setShowProvinceList(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              {province}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <label className="block text-gray-700 font-semibold mb-2">City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        disabled={!formData.province}
                        placeholder={formData.province ? "Type to search city" : "Select province first"}
                        onFocus={() => setShowCityList(true)}
                        onBlur={() => {
                          window.setTimeout(() => setShowCityList(false), 150);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                      />
                      {showCityList && formData.province && cityMatches.length > 0 && (
                        <div className="absolute left-0 right-0 bottom-full mb-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                          {cityMatches.map((city) => (
                            <button
                              key={city}
                              type="button"
                              onMouseDown={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  city,
                                }));
                                setShowCityList(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-gray-700 font-semibold mb-2">Address</label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Enter your address"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Phone number</label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder="Enter your phone number"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Enter your email"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Facebook profile</label>
                    <input
                      type="text"
                      name="facebook"
                      value={formData.facebook}
                      onChange={handleInputChange}
                      placeholder="Enter your Facebook profile URL"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button
                      onClick={() => document.getElementById("photo-input")?.click()}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                    >
                      ➕ Upload your photo
                    </button>
                    <input
                      id="photo-input"
                      type="file"
                      accept=".jpg,.png,.jpeg"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <span className="text-gray-600 text-sm">(jpg/png format)</span>
                    {formData.profilePhotoName && (
                      <span className="text-gray-500 text-sm">{formData.profilePhotoName}</span>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleSavePersonal}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Save Personal Info
                    </button>
                  </div>
                </div>
              )}

              {/* Experience Tab */}
              {activeTab === "experience" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Experience</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Job position</label>
                      <input
                        type="text"
                        name="jobPosition"
                        value={experience.jobPosition}
                        onChange={handleExperienceChange}
                        placeholder="Enter job position"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Company name</label>
                      <input
                        type="text"
                        name="companyName"
                        value={experience.companyName}
                        onChange={handleExperienceChange}
                        placeholder="Enter company name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">Start date</label>
                      <input
                        type="date"
                        name="startDate"
                        value={experience.startDate}
                        onChange={handleExperienceChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">End date</label>
                      <input
                        type="date"
                        name="endDate"
                        value={experience.endDate}
                        onChange={handleExperienceChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-8 pt-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => document.getElementById("logo-input")?.click()}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                      >
                        ➕ Upload your logo
                      </button>
                      <input
                        id="logo-input"
                        type="file"
                        accept=".jpg,.png,.jpeg"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <span className="text-gray-600 text-sm">(jpg/png format/ optional)</span>
                    </div>
                    <button
                      onClick={handleSaveExperience}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Add Experience
                    </button>
                  </div>
                </div>
              )}

              {/* CV/Resume Tab */}
              {activeTab === "cv" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">CV/Resume</h2>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Upload your CV/Resume</label>
                    <div
                      onClick={() => document.getElementById("cv-input")?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
                    >
                      <input
                        id="cv-input"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleCvUpload}
                        className="hidden"
                      />
                      <p className="text-gray-600 font-semibold">
                        {cvFile ? cvFile.name : cvFileName || "Click to upload or drag and drop"}
                      </p>
                      <p className="text-gray-500 text-sm mt-2">PDF, DOC, or DOCX (max. 5MB)</p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleSaveResume}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Save CV/Resume
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
