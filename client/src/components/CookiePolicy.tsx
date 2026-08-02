import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { LEGAL_INFO } from "../constants/legal";
import { ROUTES } from "../utils/routes";

const { brandName, legalEntity, supportEmail, supportPhone, supportPhoneHref, governingLaw, effectiveDate } =
  LEGAL_INFO;

const cookieSections = [
  {
    title: "1. What Cookies Are",
    paragraphs: [
      "Cookies are small text files stored on your device to help websites remember preferences and improve performance.",
    ],
  },
  {
    title: "2. How We Use Cookies on Micro Jobs",
    paragraphs: [
      "We use essential cookies for login sessions, security, and account functionality.",
      "We may also use analytics cookies to understand feature usage and improve user experience.",
    ],
  },
  {
    title: "3. Cookie Choices",
    paragraphs: [
      "You can control cookies through your browser settings, including blocking or deleting existing cookies.",
      "Some features may not function properly if essential cookies are disabled.",
    ],
  },
  {
    title: "4. Updates and Contact",
    paragraphs: [
      `This policy is maintained by ${legalEntity} and interpreted in line with applicable laws in the ${governingLaw}.`,
      `We may update this policy as ${brandName} evolves and legal requirements change.`,
      `For cookie-related questions, contact ${supportEmail} or ${supportPhone}.`,
    ],
  },
] as const;

export function CookiePolicy() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(ROUTES.home);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8 flex flex-col gap-4 border-b border-[#E5E7EB] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-[30px] font-bold leading-tight text-[#111827]">Cookie Policy</h1>
              <p className="mt-2 text-[14px] text-[#6B7280]">Effective date: {effectiveDate}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <Link
                to={ROUTES.privacy}
                className="inline-flex items-center justify-center rounded-lg bg-[#1C4D8D] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          <div className="space-y-7">
            {cookieSections.map((section) => (
              <section key={section.title}>
                <h2 className="text-[19px] font-semibold text-[#111827]">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-[15px] leading-7 text-[#4B5563]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <h3 className="text-[15px] font-semibold text-[#111827]">Cookie Contact</h3>
            <div className="mt-2 flex flex-wrap gap-3 text-[14px]">
              <a className="font-medium text-[#1C4D8D] hover:opacity-80" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              <a className="font-medium text-[#1C4D8D] hover:opacity-80" href={supportPhoneHref}>
                {supportPhone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
