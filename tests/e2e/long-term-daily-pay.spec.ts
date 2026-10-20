import { expect, test, type Page } from '@playwright/test';

const employer = { id: '507f1f77bcf86cd799439011', email: 'daily@example.com', firstName: 'Test', lastName: 'Employer', role: 'hire', systemRole: 'hire', accountType: 'employer', accountOptions: ['employer'], isVerified: true, companyName: 'Test Employer', avatarUrl: '/uploads/test.png' };
async function signIn(page: Page) {
  await page.addInitScript((user) => { localStorage.setItem('auth_user', JSON.stringify(user)); localStorage.setItem('current_user', JSON.stringify(user)); }, employer);
}

test('long-term calendar supports multiple independent dates, toggling and a two-day minimum', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/auth/me') ? { data: employer } : path.endsWith('/categories') ? [{ _id: 'category-one', name: 'Local services' }] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/employer/post-job');
  await page.getByRole('main').getByRole('button', { name: 'Post a Job', exact: true }).first().click();
  await page.locator('#job-title').fill('Daily local work');
  await page.locator('#job-category').selectOption('category-one');
  await page.locator('#job-description').fill('Work on the dates selected by the employer.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: /Recruiting/ }).click();
  await page.getByLabel('Start work time', { exact: true }).fill('08:00');
  await page.getByLabel('End work time', { exact: true }).fill('17:00');
  await expect(page.locator('[data-field="workTime"]')).toContainText('8am–5pm');
  await expect(page.locator('[data-field="workTime"]')).toContainText('9h 0m per day');
  await page.getByRole('button', { name: 'Select work dates (0 selected)', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Work dates (Asia/Manila)', exact: true });
  const days = calendar.locator('button[aria-pressed]:not([disabled])');
  await days.nth(0).click();
  await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(calendar.getByRole('button', { name: 'Use selected dates' })).toBeDisabled();
  await days.nth(2).click();
  await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(days.nth(2)).toHaveAttribute('aria-pressed', 'true');
  const latestLabel = await days.nth(2).getAttribute('aria-label');
  const latest = new Date(latestLabel!);
  const latestValue = `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}-${String(latest.getDate()).padStart(2, '0')}`;
  await calendar.getByRole('button', { name: 'Use selected dates' }).click();
  await expect(page.locator('input[data-field="deadline"]')).toHaveValue(latestValue);
  await expect(page.locator('[data-field="workDates"] button[aria-label^="Remove"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select work dates (2 selected)', exact: true }).click();
  await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await days.nth(2).click();
  await expect(days.nth(2)).toHaveAttribute('aria-pressed', 'false');
  await expect(calendar.getByRole('button', { name: 'Use selected dates' })).toBeDisabled();
  const remainingLabel = await days.nth(0).getAttribute('aria-label');
  const remaining = new Date(remainingLabel!);
  const remainingValue = `${remaining.getFullYear()}-${String(remaining.getMonth() + 1).padStart(2, '0')}-${String(remaining.getDate()).padStart(2, '0')}`;
  await calendar.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('input[data-field="deadline"]')).toHaveValue(remainingValue);
});

test('daily listings show both rates, truncated hourly cents and the selected shift', async ({ page }) => {
  const worker = { ...employer, role: 'work', systemRole: 'work', accountType: 'worker', accountOptions: ['worker'] };
  const job = { _id: 'daily-listing', title: 'Daily timed work', location: 'Pasig', salary: 500, jobType: 'Recruiting', paymentMode: 'daily', workDates: ['2026-10-20', '2026-10-21'], workStartTime: '08:00', workEndTime: '11:00', category: { _id: 'local', name: 'Local services' }, createdAt: new Date().toISOString() };
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript((user) => { localStorage.setItem('auth_user', JSON.stringify(user)); localStorage.setItem('current_user', JSON.stringify(user)); }, worker);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/auth/me') ? { data: worker } : path === '/api/jobs' ? [job] : path.endsWith('/daily-listing') ? job : [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/worker/find-jobs');
  const listing = page.getByRole('button', { name: /^View Daily timed work/ });
  await expect(listing).toContainText('₱500 /day');
  await expect(listing).toContainText('₱166.66/hour');
  await expect(listing).toContainText('8am–11am');
  await expect(listing).toContainText('3h 0m per day');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('daily chat proof requires confirmation and sends only the selected work date for payment', async ({ page }) => {
  await signIn(page);
  const submittedAt = '2026-10-19T08:30:00.000Z';
  let paymentCalls = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/me')) body = { data: employer };
    if (path.endsWith('/messages/conversations')) body = [{ conversationId: 'worker-one:daily-job', otherUserId: 'worker-one', otherUserName: 'Maria Santos', jobId: 'daily-job', jobTitle: 'Daily local work', lastMessage: 'Daily proof', lastMessageAt: submittedAt, unreadCount: 1 }];
    if (path.includes('/messages/conversation/worker-one')) body = [{ _id: 'daily-proof-one', sender: { _id: 'worker-one', firstName: 'Maria', lastName: 'Santos' }, receiver: { _id: employer.id, firstName: 'Test', lastName: 'Employer' }, job: { _id: 'daily-job', title: 'Daily local work' }, content: 'Daily proof', createdAt: submittedAt, attachment: { type: 'completion_evidence', jobTitle: 'Daily local work', workDate: '2026-10-19', dailyAmount: 480, submittedAt, images: [], application: { _id: 'daily-application', workStatus: 'In Progress', paymentStatus: 'Secured', dailyPayments: [{ workDate: '2026-10-19', amount: 480, submittedAt }] } } }];
    if (path.endsWith('/daily-application/payment/settle')) {
      expect(route.request().postDataJSON()).toEqual({ confirmed: true, submittedAt, workDate: '2026-10-19' });
      paymentCalls += 1;
      body = { message: 'Worker paid successfully.', job: { status: 'In Progress' } };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/employer/messages');
  await page.getByText('Maria Santos', { exact: true }).first().click();
  await expect(page.getByText('Work date: 2026-10-19', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm and Pay', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm and Pay', exact: true });
  await expect(confirmation).toContainText('Release PHP 480');
  expect(paymentCalls).toBe(0);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(paymentCalls).toBe(0);
  await page.getByRole('button', { name: 'Confirm and Pay', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect.poll(() => paymentCalls).toBe(1);
  await expect(page.getByText('Daily payment released', { exact: true })).toBeVisible();
});
