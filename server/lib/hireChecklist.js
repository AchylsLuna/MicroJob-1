import { httpError } from './lifecyclePolicy.js';

export function normalizeHireChecklist(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw httpError(400, 'The optional checklist must contain at most 20 descriptions.');
  return value.map((item) => {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 500) throw httpError(400, 'Each checklist description must contain 1–500 characters.');
    return { description: item.trim(), completed: false };
  });
}
