import { Link } from "react-router-dom";
import { LEGAL_INFO } from "../constants/legal";
import { ROUTES } from "../utils/routes";

const { brandName, legalEntity, supportEmail, supportPhone, supportPhoneHref, governingLaw, effectiveDate } =
  LEGAL_INFO;

const termsSections = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      `By creating an account, browsing, or using ${brandName}, you agree to these Terms and Conditions and our Privacy Policy.`,
      "If you do not agree with these terms, you must stop using the platform.",
    ],
  },
  {
    title: "2. Eligibility and Account Responsibilities",
    paragraphs: [
      "You must provide accurate information when creating an account and keep your login credentials secure.",
      "You are responsible for all activity under your account, including content, job applications, postings, and wallet actions.",
    ],
  },
  {
    title: "3. Platform Role",
    paragraphs: [
      `${brandName} is a marketplace that connects workers and employers. ${brandName} is not an employer, agency, or labor contractor for jobs posted by users.`,
      "Each worker and employer is solely responsible for their own offers, applications, communications, and agreements.",
    ],
  },
  {
    title: "4. Job Posts, Applications, and Communication",
    paragraphs: [
      "Employers must post lawful, accurate, and non-misleading job descriptions.",
      "Workers must submit truthful applications and qualifications.",
      "Both parties must keep communication respectful and professional. Harassment, spam, impersonation, and discriminatory conduct are prohibited.",
    ],
  },
  {
    title: "5. Payments and E-Wallet",
    paragraphs: [
      "Any payout, balance, or transaction features are provided as platform tools and may be subject to verification, compliance checks, and processing delays.",
      "Users are responsible for correct payment details, applicable fees, and taxes required by law.",
    ],
  },
  {
    title: "6. Prohibited Use",
    paragraphs: [
      "You agree not to use the platform for fraud, phishing, malware, unauthorized data collection, illegal content, or unlawful hiring activities.",
      "Attempts to bypass security controls, abuse APIs, manipulate ranking, or disrupt service availability are strictly prohibited.",
    ],
  },
  {
    title: "7. Content and Intellectual Property",
    paragraphs: [
      `You retain ownership of content you submit (for example profile details, job posts, and messages), but grant ${brandName} a limited license to host and display that content to operate the service.`,
      `All platform branding, interface design, and software are owned by ${brandName} or its licensors and may not be copied without permission.`,
    ],
  },
  {
    title: "8. Service Availability and Changes",
    paragraphs: [
      "We may update, suspend, or discontinue parts of the service to improve reliability, security, and compliance.",
      "We may modify these terms when necessary. Continued use after updates means you accept the revised terms.",
    ],
  },
  {
    title: "9. Account Suspension and Termination",
    paragraphs: [
      `${brandName} may restrict or suspend accounts that violate these terms, present security risks, or are required to be restricted by law.`,
      "You may stop using the service at any time. Certain legal obligations survive account closure.",
    ],
  },
  {
    title: "10. Disclaimers and Limitation of Liability",
    paragraphs: [
      "The platform is provided on an \"as is\" and \"as available\" basis without guarantees of uninterrupted operation, job outcomes, or hiring success.",
      `To the maximum extent allowed by law, ${brandName} is not liable for indirect, incidental, or consequential damages arising from use of the service.`,
    ],
  },
  {
    title: "11. Governing Law",
    paragraphs: [
      `These terms are governed by the laws of the ${governingLaw}.`,
      "Any legal interpretation or enforcement of these terms will follow applicable local laws and regulations.",
    ],
  },
  {
    title: "12. Contact Information",
    paragraphs: [
      `Policy owner: ${legalEntity}.`,
      `For legal questions about these terms, contact ${supportEmail} or ${supportPhone}.`,
      "You may also review related policies in the Privacy Policy and Cookie Policy.",
    ],
  },
] as const;

export function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8 flex flex-col gap-4 border-b border-[#E5E7EB] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[30px] font-bold leading-tight text-[#111827]">Terms and Conditions</h1>
              <p className="mt-2 text-[14px] text-[#6B7280]">Effective date: {effectiveDate}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={ROUTES.signUp}
                className="rounded-lg border border-[#D1D5DB] px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
              >
                Back to Sign Up
              </Link>
              <Link
                to={ROUTES.privacy}
                className="rounded-lg bg-[#1C4D8D] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#153d70]"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          <div className="space-y-7">
            {termsSections.map((section) => (
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
            <h3 className="text-[15px] font-semibold text-[#111827]">Legal Contact</h3>
            <p className="mt-2 text-[14px] text-[#4B5563]">
              {legalEntity}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-[14px]">
              <a className="font-medium text-[#1C4D8D] hover:text-[#153d70]" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              <a className="font-medium text-[#1C4D8D] hover:text-[#153d70]" href={supportPhoneHref}>
                {supportPhone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
