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

/**
 * An internship carries the same field set as a work experience (minus media),
 * so it reuses `normalizeExperience` outright rather than duplicating ~50 lines
 * of near-identical date/length rules that would then drift apart.
 */
export const normalizeInternship = normalizeExperience;

// Mirrors normalizeProfileUrl in UserController.js: https only (plus loopback
// http for local dev), and any other scheme -- javascript:, data: -- is refused
// outright rather than stored and rendered as a link later.
const parseCredentialUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const isLocalHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocalHttp) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const normalizeCertificate = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Certificate must be a JSON object' };
  }
  for (const requiredField of ['name', 'issuer', 'issueDate']) {
    if (typeof payload[requiredField] !== 'string' && !(requiredField === 'issueDate' && payload[requiredField] instanceof Date)) {
      return { error: `${requiredField} must be a string` };
    }
  }
  for (const optionalField of ['credentialId', 'credentialUrl']) {
    if (payload[optionalField] !== undefined && payload[optionalField] !== null && typeof payload[optionalField] !== 'string') {
      return { error: `${optionalField} must be a string` };
    }
  }
  if (
    payload.expiryDate !== undefined &&
    payload.expiryDate !== null &&
    typeof payload.expiryDate !== 'string' &&
    !(payload.expiryDate instanceof Date)
  ) {
    return { error: 'expiryDate must be a string' };
  }

  const name = String(payload.name || '').trim();
  const issuer = String(payload.issuer || '').trim();
  const credentialId = String(payload.credentialId || '').trim();
  const issueDate = parseExperienceDate(payload.issueDate);
  // Absent expiry is meaningful here -- most certifications never expire -- so
  // an empty value stays null instead of failing validation.
  const expiryDate = parseExperienceDate(payload.expiryDate);

  if (!name) return { error: 'Certificate name is required' };
  if (!issuer) return { error: 'Issuing organization is required' };
  if (name.length > 120) return { error: 'Certificate name must be 120 characters or fewer' };
  if (issuer.length > 120) return { error: 'Issuing organization must be 120 characters or fewer' };
  if (credentialId.length > 80) return { error: 'Credential ID must be 80 characters or fewer' };
  if (!issueDate) return { error: 'A valid issue date is required' };

  const rawExpiry = payload.expiryDate;
  const expiryProvided = rawExpiry !== undefined && rawExpiry !== null && String(rawExpiry).trim() !== '';
  if (expiryProvided && !expiryDate) return { error: 'Enter a valid expiry date or leave it blank' };
  if (expiryDate && expiryDate < issueDate) return { error: 'Expiry date cannot be before the issue date' };

  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  // An expiry date may legitimately be in the future; an issue date may not.
  if (issueDate > endOfToday) return { error: 'Issue date cannot be in the future' };

  const credentialUrlRaw = String(payload.credentialUrl || '').trim();
  const credentialUrl = parseCredentialUrl(credentialUrlRaw);
  if (credentialUrl === null) return { error: 'Credential URL must be a valid https link' };
  if (credentialUrl.length > 500) return { error: 'Credential URL must be 500 characters or fewer' };

  return {
    value: { name, issuer, issueDate, expiryDate, credentialId, credentialUrl },
  };
};
