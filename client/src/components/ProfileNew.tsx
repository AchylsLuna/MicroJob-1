import { useState } from "react";
import { 
  User, 
  Settings, 
  Calendar,
  FileText,
  LayoutDashboard,
  Clock,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "../lib/toast";

export function ProfileNew() {
  const [activeMenu, setActiveMenu] = useState<string>("User Profile");
  
  const [formData, setFormData] = useState({
    firstName: "Cameron",
    lastName: "Williamson",
    country: "Spain",
    city: "Plaza del Rey No. 1",
    location: "Remote",
    zipCode: "28004",
    email: "cameron_williamson@gmail.com",
    team: "Product & IT",
    currentPassword: "",
    newPassword: "",
    language: "English (US)",
    timezone: "GMT+07:00"
  });

  const [connectedAccounts] = useState([
    { name: "Slack account", url: "www.slack.com", icon: "slack" },
    { name: "Trello account", url: "www.trello.com", icon: "trello" }
  ]);

  const menuItems = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
    { icon: <User className="w-4 h-4" />, label: "User Profile", badge: false },
    { icon: <FileText className="w-4 h-4" />, label: "Documents" },
    { icon: <Settings className="w-4 h-4" />, label: "Setting", badge: true },
    { icon: <Calendar className="w-4 h-4" />, label: "Schedule" },
    { icon: <Clock className="w-4 h-4" />, label: "Report" },
  ];

  const handleSaveGeneral = () => {
    toast.success("General information saved successfully!");
  };

  const handleSavePassword = () => {
    toast.success("Password updated successfully!");
  };

  const handleSaveSettings = () => {
    toast.success("Settings saved successfully!");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <div className="w-[220px] bg-white border-r border-gray-200 p-6 flex flex-col">
        {/* User Info */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 mx-auto mb-3 flex items-center justify-center overflow-hidden">
            <User className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-[15px] text-gray-900 mb-1">Cameron Williamson</h3>
          <p className="text-[12px] text-gray-500">cameron_williamson@gmail.com</p>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveMenu(item.label)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] transition-colors relative ${
                activeMenu === item.label
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge && (
                <span className="absolute right-3 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          ))}
        </nav>

        {/* Add New Project Button */}
          <button className="mt-auto flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-[13px] text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center">
            <span className="text-lg">&gt;</span>
          </div>
          <span className="font-medium">Add New Project</span>
        </button>

        {/* Current Projects */}
        <div className="mt-6">
          <p className="text-[12px] text-gray-500 mb-3">Current Projects</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-white">
                  WD
                </div>
                <span className="text-[13px] text-gray-900">Web Design</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">25%</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-800 rounded-full" style={{ width: "25%" }}></div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                  DS
                </div>
                <span className="text-[13px] text-gray-900">Design System</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">50%</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-800 rounded-full" style={{ width: "50%" }}></div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                  WF
                </div>
                <span className="text-[13px] text-gray-900">Web flow Development</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">75%</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-800 rounded-full" style={{ width: "75%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* General Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-[18px] font-semibold text-gray-900 mb-6">General Information</h2>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">Country</label>
              <select
                value={formData.country}
                onChange={(e) => handleChange("country", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option>Spain</option>
                <option>Philippines</option>
                <option>United States</option>
                <option>United Kingdom</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">Location</label>
              <select
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option>Remote</option>
                <option>Office</option>
                <option>Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">ZIP Code</label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => handleChange("zipCode", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">Team</label>
              <input
                type="text"
                value={formData.team}
                onChange={(e) => handleChange("team", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveGeneral}
              className="px-6 py-2.5 bg-black text-white text-[14px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save all
            </button>
          </div>
        </div>

        {/* Password Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-[18px] font-semibold text-gray-900 mb-6">Password Information</h2>
          
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">Current Password*</label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => handleChange("currentPassword", e.target.value)}
                placeholder="Enter your Current Password"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[13px] text-gray-700 mb-2">New Password*</label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => handleChange("newPassword", e.target.value)}
                placeholder="Enter Your New Password"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-6 text-[12px] text-gray-500">
            <p className="mb-1">*Password requirements:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>At least 8 characters and up to 12 characters</li>
              <li>At least one lowercase character</li>
              <li>Password must include at least one uppercase character</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePassword}
              className="px-6 py-2.5 bg-black text-white text-[14px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save all
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[320px] bg-white border-l border-gray-200 p-6">
        {/* Profile Summary */}
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[15px] text-gray-900 mb-0.5">Cameron Williamson</h3>
              <p className="text-[13px] text-gray-500">Lead Product Design</p>
            </div>
          </div>
          <button className="text-[13px] text-blue-600 hover:text-blue-700 font-medium">
            Change Avatar
          </button>
        </div>

        {/* Language / Timezone */}
        <div className="mb-8">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Language | Timezone</h3>
          
          <div className="mb-4">
            <label className="block text-[13px] text-gray-700 mb-2">Select language</label>
            <select
              value={formData.language}
              onChange={(e) => handleChange("language", e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option>English (US)</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] text-gray-700 mb-2">Select timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option>GMT+07:00</option>
              <option>GMT+08:00</option>
              <option>GMT+00:00</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Team Account */}
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Team Account</h3>
          
          <div className="space-y-3 mb-4">
            {connectedAccounts.map((account) => (
              <div key={account.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center">
                    <LinkIcon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-gray-900">{account.name}</p>
                    <p className="text-[11px] text-gray-500">{account.url}</p>
                  </div>
                </div>
                <button className="text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
