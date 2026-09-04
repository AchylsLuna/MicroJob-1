/**
 * Every legal document in one place.
 *
 * The section copy below was moved verbatim out of the three former page
 * components (TermsAndConditions / PrivacyPolicy / CookiePolicy), which were
 * near-identical shells around these arrays. `LEGAL_INFO` is interpolated at
 * module scope exactly as it was before.
 */
import { LEGAL_INFO } from "./legal";

const { brandName, legalEntity, supportEmail, supportPhone, governingLaw } = LEGAL_INFO;

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

export type LegalDocId = "terms" | "privacy" | "cookies";

export type LegalDocument = {
  id: LegalDocId;
  /** Short name for the document list. */
  label: string;
  /** Full heading shown above the document. */
  title: string;
  sections: readonly { readonly title: string; readonly paragraphs: readonly string[] }[];
  contactHeading: string;
  /** Cookie Policy never showed the legal entity line. */
  showLegalEntity: boolean;
};

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    id: "terms",
    label: "Terms and Conditions",
    title: "Terms and Conditions",
    sections: termsSections,
    contactHeading: "Legal Contact",
    showLegalEntity: true,
  },
  {
    id: "privacy",
    label: "Privacy Policy",
    title: "Privacy Policy",
    sections: privacySections,
    contactHeading: "Privacy Contact",
    showLegalEntity: true,
  },
  {
    id: "cookies",
    label: "Cookie Policy",
    title: "Cookie Policy",
    sections: cookieSections,
    contactHeading: "Cookie Contact",
    showLegalEntity: false,
  },
] as const;

export const isLegalDocId = (value: unknown): value is LegalDocId =>
  value === "terms" || value === "privacy" || value === "cookies";
