/**
 * Calculate profile completion percentage based on filled fields
 */
export interface ProfileData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  profilePhotoName?: string;
  about?: string;
  city?: string;
  country?: string;
  province?: string;
  address?: string;
  experience?: any[];
  education?: any[];
  resumeUrl?: string;
  resumeFileName?: string;
  skills?: any[];
  phoneNumber?: string;
  linkedin?: string;
  email?: string;
  jobPosition?: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
}

export interface CompletionStatus {
  percentage: number;
  completedFields: string[];
  incompleteFields: string[];
  totalFields: number;
  completedCount: number;
}

const PROFILE_FIELDS = [
  { key: 'firstName', label: 'First Name', weight: 1 },
  { key: 'lastName', label: 'Last Name', weight: 1 },
  { key: ['avatarUrl', 'profilePhotoName'], label: 'Profile Picture', weight: 1 },
  { key: 'phoneNumber', label: 'Phone Number', weight: 1 },
  { key: ['city', 'province'], label: 'Location', weight: 1 },
  { key: 'country', label: 'Country', weight: 1 },
  { key: 'address', label: 'Address', weight: 1 },
  { key: 'about', label: 'Bio/About', weight: 1 },
  { key: 'linkedin', label: 'LinkedIn Profile', weight: 1 },
  { key: ['jobPosition', 'companyName', 'startDate', 'endDate'], label: 'Work Experience', weight: 1.5 },
  { key: 'education', label: 'Education', weight: 1.5 },
  { key: ['resumeUrl', 'resumeFileName'], label: 'CV/Resume', weight: 1.5 },
  { key: 'skills', label: 'Skills', weight: 1 },
];

/**
 * Check if a field is filled
 */
const isFieldFilled = (value: any): boolean => {
  // Null, undefined, or empty string
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    // Trim whitespace and check if empty
    return value.trim().length > 0;
  }

  // For arrays, check if at least one item exists
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  // For objects, check if it has content
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  // For other types (number, boolean), they're filled if not null/undefined
  return true;
};

/**
 * Calculate profile completion percentage
 */
export const calculateProfileCompletion = (profile: ProfileData): CompletionStatus => {
  const completedFields: string[] = [];
  const incompleteFields: string[] = [];
  let totalWeight = 0;
  let completedWeight = 0;

  PROFILE_FIELDS.forEach((field) => {
    const keys = Array.isArray(field.key) ? field.key : [field.key];
    const values = keys.map(k => profile[k as keyof ProfileData]);
    const isFilled = values.some(v => isFieldFilled(v));

    totalWeight += field.weight;

    if (isFilled) {
      completedFields.push(field.label);
      completedWeight += field.weight;
    } else {
      incompleteFields.push(field.label);
    }
  });

  const percentage = Math.round((completedWeight / totalWeight) * 100);

  return {
    percentage: Math.min(percentage, 100),
    completedFields,
    incompleteFields,
    totalFields: PROFILE_FIELDS.length,
    completedCount: completedFields.length,
  };
};

/**
 * Get color based on completion percentage
 */
export const getCompletionColor = (percentage: number): string => {
  if (percentage >= 80) return '#10b981'; // Green
  if (percentage >= 60) return '#3b82f6'; // Blue
  if (percentage >= 40) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
};

/**
 * Get completion message
 */
export const getCompletionMessage = (percentage: number): string => {
  if (percentage === 100) return 'Profile Complete! 🎉';
  if (percentage >= 80) return 'Almost there!';
  if (percentage >= 60) return 'Good progress';
  if (percentage >= 40) return 'Getting started';
  return 'Just getting started';
};
