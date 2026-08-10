import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecommendableJob, scoreJobForWorker } from '../../lib/jobMatching.js';

test('job matching ranks aligned skills, categories, experience, and location highly', () => {
  const categoryId = '507f1f77bcf86cd799439011';
  const worker = {
    skills: [{ name: 'Electrical Repair' }, { name: 'Wiring' }, { name: 'Maintenance' }],
    workExperience: [{ title: 'Electrician', description: 'Installed wiring and repaired circuits.' }],
    jobPosition: 'Electrical technician',
    city: 'Quezon City',
    preferredCategories: [{ _id: categoryId, name: 'Electrical' }],
    jobPreferences: ['installation and repair work'],
  };
  const strongJob = {
    title: 'Electrician Needed',
    description: 'Install and repair circuits.',
    location: 'Batasan Hills, Quezon City, Metro Manila',
    skills: ['Wiring', 'Electrical Repair', 'Installation'],
    requirements: ['Electrical maintenance'],
    category: { _id: categoryId, name: 'Electrical' },
  };
  const unrelatedJob = {
    title: 'Garden Landscaper',
    description: 'Maintain lawns and plants.',
    location: 'Cebu City, Cebu',
    skills: ['Gardening', 'Landscaping'],
    requirements: ['Plant care'],
    category: { _id: '507f191e810c19729de860ea', name: 'Landscaping' },
  };

  const strong = scoreJobForWorker(strongJob, worker);
  const unrelated = scoreJobForWorker(unrelatedJob, worker);
  assert.ok(strong.percentage >= 75, `expected a high match, got ${strong.percentage}`);
  assert.ok(strong.percentage > unrelated.percentage);
  assert.ok(strong.reasons.includes('Preferred category'));
});

test('recommendations exclude unavailable and expired jobs', () => {
  const now = new Date('2026-08-11T00:00:00.000Z');
  assert.equal(isRecommendableJob({ status: 'Available', deadline: '2026-08-12T00:00:00.000Z' }, now), true);
  assert.equal(isRecommendableJob({ status: 'Completed', deadline: '2026-08-12T00:00:00.000Z' }, now), false);
  assert.equal(isRecommendableJob({ status: 'Available', deadline: '2026-08-10T00:00:00.000Z' }, now), false);
});

