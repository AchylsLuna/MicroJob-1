import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  hasValidAvatarFileSignature,
  hasValidResumeFileSignature,
  normalizeExperience,
} from '../../routes/authRoutes.js';

const withTemporaryFile = (t, name, bytes) => {
  const directory = mkdtempSync(join(tmpdir(), 'microjobs-profile-validation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, name);
  writeFileSync(path, bytes);
  return { path, originalname: name };
};

test('work experience validation normalizes valid month values', () => {
  const result = normalizeExperience({
    title: '  Product Designer ',
    company: ' Acme ',
    location: ' Remote ',
    startDate: '2024-01',
    endDate: '2024-12',
    current: false,
    description: ' Designed mobile flows. ',
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.title, 'Product Designer');
  assert.equal(result.value.company, 'Acme');
  assert.equal(result.value.startDate.toISOString(), '2024-01-01T00:00:00.000Z');
  assert.equal(result.value.endDate.toISOString(), '2024-12-01T00:00:00.000Z');
});

test('work experience validation rejects invalid types and date ranges', () => {
  const invalidBoolean = normalizeExperience({
    title: 'Designer',
    company: 'Acme',
    startDate: '2024-01',
    endDate: '2024-12',
    current: 1,
  });
  assert.match(invalidBoolean.error, /current must be a boolean/i);

  const reversedDates = normalizeExperience({
    title: 'Designer',
    company: 'Acme',
    startDate: '2024-12',
    endDate: '2024-01',
    current: false,
  });
  assert.match(reversedDates.error, /End date cannot be before start date/i);

  const nextYear = new Date().getUTCFullYear() + 1;
  const futureDate = normalizeExperience({
    title: 'Designer',
    company: 'Acme',
    startDate: `${nextYear}-01`,
    current: true,
  });
  assert.match(futureDate.error, /Start date cannot be in the future/i);
});

test('resume validation checks file content instead of trusting the extension', (t) => {
  const validPdf = withTemporaryFile(t, 'resume.pdf', Buffer.from('%PDF-1.7 test'));
  const forgedPdf = withTemporaryFile(t, 'forged.pdf', Buffer.from('MZ executable'));
  const validDoc = withTemporaryFile(
    t,
    'resume.doc',
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  );

  assert.equal(hasValidResumeFileSignature(validPdf), true);
  assert.equal(hasValidResumeFileSignature(forgedPdf), false);
  assert.equal(hasValidResumeFileSignature(validDoc), true);
});

test('avatar validation checks image signatures and rejects renamed files', (t) => {
  const validPng = withTemporaryFile(
    t,
    'avatar.png',
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  const forgedJpeg = withTemporaryFile(t, 'avatar.jpg', Buffer.from('not an image'));

  assert.equal(hasValidAvatarFileSignature(validPng), true);
  assert.equal(hasValidAvatarFileSignature(forgedJpeg), false);
});
