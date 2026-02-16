import { CombinedLogo, JobPostingIconAlt, CompactJobPostingLogo } from "./CombinedLogo";

export function LogoShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-[48px] font-bold text-gray-900 mb-4">
            Micro Jobs <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#1C4D8D]">Logo Showcase</span>
          </h1>
          <p className="text-[16px] text-gray-600">Professional logos that represent job posting alongside the Micro Jobs brand</p>
        </div>

        {/* Full Combined Logo */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">Full Combined Logo</h2>
          <p className="text-[14px] text-gray-600 mb-8">Main logo with Micro Jobs branding + Job Posting icon (with animation)</p>
          <div className="flex items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-[16px]">
            <CombinedLogo />
          </div>
        </div>

        {/* Without Animation */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">Static Version</h2>
          <p className="text-[14px] text-gray-600 mb-8">Combined logo without animations (for print/static use)</p>
          <div className="flex items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-[16px]">
            <CombinedLogo animate={false} />
          </div>
        </div>

        {/* Without Job Posting Icon */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">Micro Jobs Only</h2>
          <p className="text-[14px] text-gray-600 mb-8">Just the Micro Jobs logo without job posting icon</p>
          <div className="flex items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-[16px]">
            <CombinedLogo showJobPostingIcon={false} />
          </div>
        </div>

        {/* Alternative Job Posting Icon */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">Alternative Job Posting Icon</h2>
          <p className="text-[14px] text-gray-600 mb-8">Document-style job posting icon (square shape)</p>
          <div className="flex items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-[16px]">
            <JobPostingIconAlt />
          </div>
        </div>

        {/* Compact Version */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">Compact Logo</h2>
          <p className="text-[14px] text-gray-600 mb-8">Smaller version for navigation bars and headers</p>
          <div className="flex items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-[16px]">
            <CompactJobPostingLogo />
          </div>
        </div>

        {/* Color Variations */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">On Different Backgrounds</h2>
          <p className="text-[14px] text-gray-600 mb-8">How the logo looks on various backgrounds</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Light Background */}
            <div className="bg-white rounded-[16px] p-8 border border-gray-200">
              <p className="text-[12px] font-semibold text-gray-600 mb-4 text-center">Light Background</p>
              <div className="flex justify-center">
                <CompactJobPostingLogo />
              </div>
            </div>

            {/* Dark Background */}
            <div className="bg-gray-900 rounded-[16px] p-8">
              <p className="text-[12px] font-semibold text-white mb-4 text-center">Dark Background</p>
              <div className="flex justify-center">
                <CompactJobPostingLogo />
              </div>
            </div>

            {/* Gradient Background */}
            <div className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] rounded-[16px] p-8">
              <p className="text-[12px] font-semibold text-white mb-4 text-center">Brand Gradient</p>
              <div className="flex justify-center">
                <CompactJobPostingLogo />
              </div>
            </div>
          </div>
        </div>

        {/* Logo Specifications */}
        <div className="bg-white rounded-[24px] p-12 shadow-xl border border-gray-100">
          <h2 className="text-[24px] font-bold text-gray-900 mb-6">Logo Specifications</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Colors */}
            <div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-4">Brand Colors</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#4988C4] shadow-md"></div>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">#4988C4</p>
                    <p className="text-[12px] text-gray-600">Primary Blue</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#1C4D8D] shadow-md"></div>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">#1C4D8D</p>
                    <p className="text-[12px] text-gray-600">Dark Blue</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-4">Logo Features</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#4988C4] text-[18px]">✓</span>
                  <span className="text-[14px] text-gray-600">Animated glow effect</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4988C4] text-[18px]">✓</span>
                  <span className="text-[14px] text-gray-600">Briefcase with plus icon</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4988C4] text-[18px]">✓</span>
                  <span className="text-[14px] text-gray-600">Gradient background</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4988C4] text-[18px]">✓</span>
                  <span className="text-[14px] text-gray-600">Responsive hover effects</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#4988C4] text-[18px]">✓</span>
                  <span className="text-[14px] text-gray-600">"Job Posting" label</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Usage Guidelines */}
        <div className="bg-gradient-to-br from-[#4988C4] to-[#1C4D8D] rounded-[24px] p-12 text-white shadow-xl">
          <h2 className="text-[24px] font-bold mb-6">Usage Guidelines</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-6">
              <h3 className="text-[16px] font-bold mb-3">✓ Do</h3>
              <ul className="space-y-2 text-[14px] opacity-90">
                <li>• Use on clean backgrounds</li>
                <li>• Maintain clear space around logo</li>
                <li>• Use official brand colors</li>
                <li>• Scale proportionally</li>
              </ul>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-6">
              <h3 className="text-[16px] font-bold mb-3">✗ Don't</h3>
              <ul className="space-y-2 text-[14px] opacity-90">
                <li>• Distort or stretch</li>
                <li>• Change brand colors</li>
                <li>• Add effects or filters</li>
                <li>• Rotate or skew</li>
              </ul>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-6">
              <h3 className="text-[16px] font-bold mb-3">Best For</h3>
              <ul className="space-y-2 text-[14px] opacity-90">
                <li>• Website headers</li>
                <li>• Landing pages</li>
                <li>• Job posting pages</li>
                <li>• Marketing materials</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
