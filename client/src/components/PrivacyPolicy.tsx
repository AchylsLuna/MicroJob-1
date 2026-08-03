import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { LEGAL_INFO } from "../constants/legal";
import { ROUTES } from "../utils/routes";

const { brandName, legalEntity, supportEmail, supportPhone, supportPhoneHref, governingLaw, effectiveDate } =
  LEGAL_INFO;

const privacySections = [
  {
    title: "1. Data Controller and Contact",
    paragraphs: [
      `${legalEntity} operates ${brandName} and acts as the platform data controller for account and platform data.`,
      `For privacy requests, contact us at ${supportEmail} or ${supportPhone}.`,
    ],
  },
  {
    title: "2. Information We Collect",
    paragraphs: [
      "We collect account information you provide such as name, email address, profile details, and role type (worker or employer).",
      "We also collect usage information, job activity, communication metadata, and technical data such as browser, device, and IP address to keep the platform secure and reliable.",
    ],
  },
  {
    title: "3. How We Use Your Information",
    paragraphs: [
      "We use your information to operate your account, match workers and employers, process applications, deliver notifications, and provide support.",
      "We also use data to detect fraud, enforce platform policies, improve product performance, and comply with legal obligations.",
    ],
  },
  {
    title: "4. Legal Bases for Processing",
    paragraphs: [
      "Depending on your location, we process personal data based on contract performance, legitimate interests, legal compliance, and your consent where required.",
      "When consent is used, you may withdraw it at any time, subject to legal and operational limitations.",
    ],
  },
  {
    title: "5. Information Sharing",
    paragraphs: [
      "Profile and job-application information is shared with relevant users on the platform to support hiring workflows.",
      "We may share information with service providers that help us host, secure, and maintain the platform under confidentiality and security obligations.",
      "We may disclose data when required by law, regulation, court order, or to protect user safety and platform integrity.",
    ],
  },
  {
    title: "6. Data Retention",
    paragraphs: [
      "We retain personal data only as long as needed for service delivery, dispute resolution, legal compliance, and security monitoring.",
      "Retention periods depend on account activity, legal requirements, and operational needs.",
    ],
  },
  {
    title: "7. Security",
    paragraphs: [
      "We use administrative, technical, and organizational safeguards to protect your information.",
      "No internet-based system is fully secure, but we continuously improve controls to reduce risk and respond quickly to incidents.",
    ],
  },
  {
    title: "8. Your Privacy Rights",
    paragraphs: [
      "You may request access, correction, or deletion of personal information, subject to applicable law.",
      "You may also object to or restrict certain processing, request portability where available, and manage account preferences from settings when supported.",
    ],
  },
  {
    title: "9. Cookies and Similar Technologies",
    paragraphs: [
      "We use cookies and similar technologies for authentication, session management, analytics, and product improvement.",
      "You can manage cookies through browser settings. For more details, see our Cookie Policy.",
    ],
  },
  {
    title: "10. Children's Privacy",
    paragraphs: [
      `${brandName} is not intended for children under the minimum age required by applicable law.`,
      "If we learn that prohibited child data was submitted, we will take reasonable steps to remove it.",
    ],
  },
  {
    title: "11. Jurisdiction and Compliance",
    paragraphs: [
      `This privacy policy is interpreted in line with applicable laws in the ${governingLaw}, including relevant data privacy regulations.`,
      "Where additional regional laws apply, we will comply with those obligations for affected users.",
    ],
  },
  {
    title: "12. Policy Updates and Contact",
    paragraphs: [
      "We may update this policy from time to time to reflect legal, technical, or product changes.",
      `For privacy questions or requests, contact ${supportEmail} or ${supportPhone}.`,
    ],
  },
] as const;

export function PrivacyPolicy() {
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
              <h1 className="text-[30px] font-bold leading-tight text-[#111827]">Privacy Policy</h1>
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
                to={ROUTES.terms}
                className="inline-flex items-center justify-center rounded-lg bg-[#1C4D8D] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-colors"
              >
                Terms and Conditions
              </Link>
              <Link
                to={ROUTES.cookiePolicy}
                className="inline-flex items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                Cookie Policy
              </Link>
            </div>
          </div>

          <div className="space-y-7">
            {privacySections.map((section) => (
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
            <h3 className="text-[15px] font-semibold text-[#111827]">Privacy Contact</h3>
            <p className="mt-2 text-[14px] text-[#4B5563]">
              {legalEntity}
            </p>
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
