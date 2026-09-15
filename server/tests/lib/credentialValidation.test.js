import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCertificate, normalizeInternship } from '../../lib/profileValidation.js';

// --- Certificates ---------------------------------------------------------

test('certificate validation normalizes and trims valid input', () => {
  const result = normalizeCertificate({
    name: '  AWS Solutions Architect ',
    issuer: ' Amazon Web Services ',
    issueDate: '2024-03',
    expiryDate: '2027-03',
    credentialId: ' ABC-123 ',
    credentialUrl: 'https://verify.example.com/abc123',
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.name, 'AWS Solutions Architect');
  assert.equal(result.value.issuer, 'Amazon Web Services');
  assert.equal(result.value.credentialId, 'ABC-123');
  assert.equal(result.value.issueDate.toISOString(), '2024-03-01T00:00:00.000Z');
  assert.equal(result.value.expiryDate.toISOString(), '2027-03-01T00:00:00.000Z');
});

test('certificate validation treats a missing expiry as "never expires" rather than an error', () => {
  for (const expiryDate of [undefined, null, '']) {
    const result = normalizeCertificate({
      name: 'First Aid',
      issuer: 'Red Cross',
      issueDate: '2023-06',
      expiryDate,
    });
    assert.equal(result.error, undefined, `expiry ${JSON.stringify(expiryDate)} should be accepted`);
    assert.equal(result.value.expiryDate, null);
  }
});

test('certificate validation requires name, issuer, and a valid issue date', () => {
  assert.match(
    normalizeCertificate({ name: '   ', issuer: 'Red Cross', issueDate: '2023-06' }).error,
    /name is required/i,
  );
  assert.match(
    normalizeCertificate({ name: 'First Aid', issuer: '  ', issueDate: '2023-06' }).error,
    /issuing organization is required/i,
  );
  // A malformed date must be rejected outright, not silently coerced to Invalid Date.
  assert.match(
    normalizeCertificate({ name: 'First Aid', issuer: 'Red Cross', issueDate: 'not-a-date' }).error,
    /valid issue date/i,
  );
});

test('certificate validation rejects an expiry before issue, and a future issue date', () => {
  assert.match(
    normalizeCertificate({
      name: 'First Aid',
      issuer: 'Red Cross',
      issueDate: '2024-06',
      expiryDate: '2023-06',
    }).error,
    /expiry date cannot be before/i,
  );

  const nextYear = new Date();
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
  const futureMonth = `${nextYear.getUTCFullYear()}-01`;
  assert.match(
    normalizeCertificate({ name: 'First Aid', issuer: 'Red Cross', issueDate: futureMonth }).error,
    /issue date cannot be in the future/i,
  );
});

test('certificate validation accepts a future expiry date', () => {
  const nextYear = new Date();
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
  const result = normalizeCertificate({
    name: 'First Aid',
    issuer: 'Red Cross',
    issueDate: '2024-01',
    expiryDate: `${nextYear.getUTCFullYear()}-01`,
  });
  assert.equal(result.error, undefined);
  assert.ok(result.value.expiryDate instanceof Date);
});

test('certificate validation enforces per-field length caps', () => {
  assert.match(
    normalizeCertificate({ name: 'a'.repeat(121), issuer: 'Red Cross', issueDate: '2024-01' }).error,
    /120 characters or fewer/i,
  );
  assert.match(
    normalizeCertificate({ name: 'First Aid', issuer: 'b'.repeat(121), issueDate: '2024-01' }).error,
    /120 characters or fewer/i,
  );
  assert.match(
    normalizeCertificate({
      name: 'First Aid',
      issuer: 'Red Cross',
      issueDate: '2024-01',
      credentialId: 'c'.repeat(81),
    }).error,
    /80 characters or fewer/i,
  );
});

test('certificate validation refuses non-https credential URL schemes', () => {
  for (const credentialUrl of ['javascript:alert(1)', 'data:text/html,<script>', 'ftp://example.com/x']) {
    const result = normalizeCertificate({
      name: 'First Aid',
      issuer: 'Red Cross',
      issueDate: '2024-01',
      credentialUrl,
    });
    assert.match(result.error || '', /valid https link/i, `${credentialUrl} should be refused`);
  }
});

test('certificate validation upgrades a bare host to https and keeps an empty URL empty', () => {
  const bare = normalizeCertificate({
    name: 'First Aid',
    issuer: 'Red Cross',
    issueDate: '2024-01',
    credentialUrl: 'verify.example.com/abc',
  });
  assert.equal(bare.error, undefined);
  assert.equal(bare.value.credentialUrl.startsWith('https://'), true);

  const blank = normalizeCertificate({
    name: 'First Aid',
    issuer: 'Red Cross',
    issueDate: '2024-01',
    credentialUrl: '',
  });
  assert.equal(blank.error, undefined);
  assert.equal(blank.value.credentialUrl, '');
});

test('certificate validation rejects non-object and wrong-typed payloads', () => {
  assert.match(normalizeCertificate(null).error, /JSON object/i);
  assert.match(normalizeCertificate([]).error, /JSON object/i);
  assert.match(
    normalizeCertificate({ name: 42, issuer: 'Red Cross', issueDate: '2024-01' }).error,
    /must be a string/i,
  );
});

// --- Internships ----------------------------------------------------------
// normalizeInternship is normalizeExperience by design (identical field set),
// so these assert the aliasing holds rather than re-testing every date rule.

test('internship validation accepts a valid entry and normalizes it', () => {
  const result = normalizeInternship({
    title: '  Design Intern ',
    company: ' Acme ',
    location: ' Manila ',
    startDate: '2024-01',
    endDate: '2024-06',
    current: false,
    description: ' Shadowed the product team. ',
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.title, 'Design Intern');
  assert.equal(result.value.company, 'Acme');
  assert.equal(result.value.location, 'Manila');
  assert.equal(result.value.current, false);
});

test('internship validation requires an end date unless current, and rejects reversed ranges', () => {
  assert.match(
    normalizeInternship({ title: 'Intern', company: 'Acme', startDate: '2024-01', current: false }).error,
    /end date is required/i,
  );

  const current = normalizeInternship({
    title: 'Intern',
    company: 'Acme',
    startDate: '2024-01',
    current: true,
  });
  assert.equal(current.error, undefined);
  assert.equal(current.value.endDate, null);

  assert.match(
    normalizeInternship({
      title: 'Intern',
      company: 'Acme',
      startDate: '2024-06',
      endDate: '2024-01',
      current: false,
    }).error,
    /end date cannot be before start date/i,
  );
});
