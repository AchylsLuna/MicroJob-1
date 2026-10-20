import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkMinutes, getHourlyPay, normalizeWorkTimes, workTimeSummary } from '../../lib/workTime.js';
import { serializePublicJob } from '../../lib/jobDiscovery.js';

test('work hours include partial hours and overnight shifts, rejecting missing or equal times', () => {
  assert.equal(getWorkMinutes('08:00', '17:00'), 540);
  assert.equal(getWorkMinutes('08:15', '15:45'), 450);
  assert.equal(getWorkMinutes('22:00', '06:00'), 480);
  for (const [start, end] of [[undefined, '17:00'], ['08:00', '08:00'], ['24:00', '06:00'], ['8am', '17:00'], ['08:60', '17:00']]) {
    assert.equal(getWorkMinutes(start, end), null);
    assert.throws(() => normalizeWorkTimes(start, end), { status: 400 });
  }
});

test('hourly pay truncates fractional cents instead of rounding up', () => {
  assert.equal(getHourlyPay(480, 540), 53.33);
  assert.equal(getHourlyPay(500, 180), 166.66);
  assert.equal(getHourlyPay(480, 450), 64);
  assert.equal(getHourlyPay(480.50, 480), 60.06);
  for (const rate of [undefined, 'invalid', 0, -480, Infinity]) assert.equal(getHourlyPay(rate, 480), null);
  assert.equal(getHourlyPay(480, null), null);
});

test('public daily listings derive duration and hourly pay without inventing times for legacy jobs', () => {
  const job = { _id: 'daily-job', paymentMode: 'daily', salary: 500, workStartTime: '08:00', workEndTime: '11:00' };
  const listing = serializePublicJob(job);
  assert.equal(listing.workStartTime, '08:00');
  assert.equal(listing.workEndTime, '11:00');
  assert.equal(listing.workMinutes, 180);
  assert.equal(listing.workHours, 3);
  assert.equal(listing.hourlyPay, 166.66);
  assert.deepEqual(workTimeSummary({ paymentMode: 'daily', salary: 480 }), {});
  assert.deepEqual(workTimeSummary({ ...job, paymentMode: 'assignment' }), {});
});
