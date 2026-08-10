const parseExperienceDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}(?:-\d{2}(?:T.*)?)?$/.test(raw)) return null;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeExperience = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Work experience must be a JSON object' };
  }
  for (const requiredField of ['title', 'company', 'startDate']) {
    if (typeof payload[requiredField] !== 'string' && !(requiredField === 'startDate' && payload[requiredField] instanceof Date)) {
      return { error: `${requiredField} must be a string` };
    }
  }
  for (const optionalField of ['location', 'description']) {
    if (payload[optionalField] !== undefined && payload[optionalField] !== null && typeof payload[optionalField] !== 'string') {
      return { error: `${optionalField} must be a string` };
    }
  }
  if (![true, false, 'true', 'false'].includes(payload.current)) {
    return { error: 'current must be a boolean' };
  }
  if (
    payload.endDate !== undefined &&
    payload.endDate !== null &&
    typeof payload.endDate !== 'string' &&
    !(payload.endDate instanceof Date)
  ) {
    return { error: 'endDate must be a string' };
  }
  const title = String(payload.title || '').trim();
  const company = String(payload.company || '').trim();
  const location = String(payload.location || '').trim();
  const description = String(payload.description || '').trim();
  const startDate = parseExperienceDate(payload.startDate);
  const current = payload.current === true || payload.current === 'true';
  const endDate = current ? null : parseExperienceDate(payload.endDate);

  if (!title) return { error: 'Job title is required' };
  if (!company) return { error: 'Company or client name is required' };
  if (title.length > 100) return { error: 'Job title must be 100 characters or fewer' };
  if (company.length > 120) return { error: 'Company or client name must be 120 characters or fewer' };
  if (location.length > 120) return { error: 'Location must be 120 characters or fewer' };
  if (description.length > 1000) return { error: 'Description must be 1000 characters or fewer' };
  if (!startDate) return { error: 'A valid start date is required' };
  if (!current && !endDate) return { error: 'End date is required unless this is your current role' };
  if (endDate && endDate < startDate) return { error: 'End date cannot be before start date' };
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (startDate > endOfToday) return { error: 'Start date cannot be in the future' };
  if (endDate && endDate > endOfToday) return { error: 'End date cannot be in the future' };

  return {
    value: { title, company, location, description, startDate, endDate, current },
  };
};
