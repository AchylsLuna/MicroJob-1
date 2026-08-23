import type { TFunction } from "i18next";
import {
  getFullNameValidationMessage,
  getPhoneValidationMessage,
  isValidFullName,
  isValidPhone,
} from "./authValidation";

export const PROFILE_LIMITS = {
  name: 30,
  city: 100,
  province: 100,
  barangay: 100,
  address: 300,
  companyName: 120,
  jobPosition: 100,
  about: 2000,
  url: 300,
  skillName: 80,
  skillDescription: 500,
  experienceTitle: 100,
  experienceCompany: 120,
  experienceLocation: 120,
  experienceDescription: 1000,
} as const;

export const MAX_PROFILE_UPLOAD_BYTES = 5 * 1024 * 1024;

const AVATAR_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const RESUME_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type ProfileFile = Pick<File, "name" | "size" | "type">;

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() || "";

export function validateAvatarFile(file: ProfileFile): string | null {
  const extension = extensionOf(file.name);
  if (!AVATAR_EXTENSIONS.has(extension) || !AVATAR_MIME_TYPES.has(file.type.toLowerCase())) {
    return "Choose a JPG, PNG, GIF, or WEBP image.";
  }
  if (file.size > MAX_PROFILE_UPLOAD_BYTES) {
    return "Profile photos must be 5 MB or smaller.";
  }
  return null;
}

export function validateResumeFile(file: ProfileFile): string | null {
  const extension = extensionOf(file.name);
  if (!RESUME_MIME_BY_EXTENSION[extension] || file.type.toLowerCase() !== RESUME_MIME_BY_EXTENSION[extension]) {
    return "Choose a PDF, DOC, or DOCX résumé.";
  }
  if (file.size > MAX_PROFILE_UPLOAD_BYTES) {
    return "Résumés must be 5 MB or smaller.";
  }
  return null;
}

export function isValidOptionalProfileUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  if (raw.length > PROFILE_LIMITS.url) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return false;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    return parsed.protocol === "https:" || localHttp;
  } catch {
    return false;
  }
}

export type ProfileValidationField =
  | "firstName"
  | "lastName"
  | "phone"
  | "companyName"
  | "jobPosition"
  | "about"
  | "address"
  | "linkedin"
  | "website";

export type ProfileValidationIssue = { field: ProfileValidationField; message: string };

export function validateProfileDetails(
  values: Record<ProfileValidationField, string>,
  options: { employer: boolean },
  t: TFunction,
): ProfileValidationIssue | null {
  if (!values.firstName || !isValidFullName(values.firstName)) {
    return { field: "firstName", message: getFullNameValidationMessage(t) };
  }
  if (!values.lastName || !isValidFullName(values.lastName)) {
    return { field: "lastName", message: getFullNameValidationMessage(t) };
  }
  if (values.phone && !isValidPhone(values.phone)) {
    return { field: "phone", message: getPhoneValidationMessage(t) };
  }
  if (options.employer && !values.companyName) {
    return { field: "companyName", message: "Company name is required for an employer profile." };
  }

  const lengthChecks: Array<[ProfileValidationField, string, number, string]> = [
    ["jobPosition", values.jobPosition, PROFILE_LIMITS.jobPosition, "Professional headline"],
    ["about", values.about, PROFILE_LIMITS.about, "About"],
    ["companyName", values.companyName, PROFILE_LIMITS.companyName, "Company name"],
    ["address", values.address, PROFILE_LIMITS.address, "Address"],
  ];
  const invalidLength = lengthChecks.find(([, value, maxLength]) => value.length > maxLength);
  if (invalidLength) {
    return {
      field: invalidLength[0],
      message: `${invalidLength[3]} must be ${invalidLength[2]} characters or fewer.`,
    };
  }
  if (!isValidOptionalProfileUrl(values.linkedin)) {
    return { field: "linkedin", message: "LinkedIn must be a valid HTTPS URL." };
  }
  if (!isValidOptionalProfileUrl(values.website)) {
    return { field: "website", message: "Website must be a valid HTTPS URL." };
  }
  return null;
}
