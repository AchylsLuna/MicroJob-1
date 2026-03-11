/**
 * Calculate profile completion percentage based on filled fields
 */
export interface ProfileData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  about?: string;
  city?: string;
  totalExperience?: string;
  resumeUrl?: string;
  skills?: any[];
  phoneNumber?: string;
  linkedin?: string;
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
  { key: 'avatarUrl', label: 'Profile Picture', weight: 1 },
  { key: 'phoneNumber', label: 'Phone Number', weight: 1 },
  { key: 'city', label: 'City', weight: 1 },
  { key: 'about', label: 'Bio/About', weight: 1 },
  { key: 'linkedin', label: 'LinkedIn Profile', weight: 1 },
  { key: 'totalExperience', label: 'Work Experience', weight: 1.5 },
  { key: 'resumeUrl', label: 'CV/Resume', weight: 1.5 },
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
    const value = profile[field.key as keyof ProfileData];
    const isFilled = isFieldFilled(value);
    
    totalWeight += field.weight;

    if (isFilled) {
      completedFields.push(field.label);
      completedWeight += field.weight;
      console.log(`✅ ${field.label}: filled (value: ${JSON.stringify(value).substring(0, 50)})`);
    } else {
      incompleteFields.push(field.label);
      console.log(`❌ ${field.label}: empty (value: ${JSON.stringify(value).substring(0, 50)})`);
    }
  });

  const percentage = Math.round((completedWeight / totalWeight) * 100);

  console.log(`\n📊 Profile Completion: ${percentage}% (${completedFields.length}/${PROFILE_FIELDS.length} fields)`);
  console.log(`Completed: ${completedFields.join(', ')}`);
  console.log(`Incomplete: ${incompleteFields.join(', ')}\n`);

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
