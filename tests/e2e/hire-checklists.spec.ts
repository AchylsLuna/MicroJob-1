import { expect, test, type Page } from '@playwright/test';

const employer = { id: '507f1f77bcf86cd799439011', firstName: 'Test', lastName: 'Employer', email: 'employer@example.com', role: 'hire', systemRole: 'hire', accountType: 'employer', accountOptions: ['employer'], isVerified: true };
const worker = { ...employer, id: '507f1f77bcf86cd799439012', firstName: 'Maria', lastName: 'Santos', role: 'work', systemRole: 'work', accountType: 'worker', accountOptions: ['worker'] };
const job = { _id: '507f1f77bcf86cd799439013', title: 'Park cleanup', description: 'Clean the park grounds', location: 'Pasig', salary: 500, status: 'In Progress', positionsNeeded: 2, hiredCount: 2, reservedOfferCount: 0, recruitmentOpen: false, canDelete: false };

async function mockChecklist(page: Page, asWorker = false, withChecklist = true) {
  const user = asWorker ? worker : employer;
  const applications = [worker, { ...worker, id: '507f1f77bcf86cd799439014', firstName: 'Juan' }].map((applicant, index) => ({
    _id: `assignment-${index}`, status: 'Hired', employerHidden: index === 1, job, applicant: { ...applicant, _id: applicant.id }, workStatus: 'In Progress', paymentStatus: 'Secured',
    hireChecklist: withChecklist ? [{ _id: `task-${index}`, description: index === 0 ? 'Sweep the path' : 'Collect the litter', completed: false }] : [],
  }));
  const writes: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript((current) => { localStorage.setItem('auth_user', JSON.stringify(current)); localStorage.setItem('current_user', JSON.stringify(current)); }, user);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.endsWith('/auth/me')) body = { data: user };
    if (url.pathname.endsWith('/jobs/mine')) body = [job];
    if (url.pathname === '/api/applications') body = [applications[0]];
    if (url.pathname.endsWith('/applications/assignment-0/lifecycle')) body = { application: applications[0], job, cancellations: [], disputes: [], canFileNonpayment: false };
    if (url.pathname.endsWith('/applications/employer')) {
      if (url.searchParams.has('jobId')) {
        expect(url.searchParams.get('jobId')).toBe(job._id);
        expect(url.searchParams.get('includeHidden')).toBe('true');
      }
      body = applications;
    }
    if (url.pathname.endsWith('/messages/conversations')) body = [{ conversationId: `${employer.id}:${job._id}`, otherUserId: employer.id, otherUserName: 'Test Employer', jobId: job._id, jobTitle: job.title, lastMessage: `Work checklist for ${job.title}`, lastMessageAt: '2026-10-18T08:00:00Z', unreadCount: 1 }];
    if (url.pathname.includes('/messages/conversation/')) body = [
      { _id: 'checklist-message', sender: { _id: employer.id }, receiver: { _id: worker.id }, job, content: `Work checklist for ${job.title}`, createdAt: '2026-10-18T08:00:00Z', attachment: { type: 'hire_checklist', jobTitle: job.title, checklist: ['Sweep the path', 'Wash the benches'] } },
      { _id: 'proof-message', sender: { _id: worker.id }, receiver: { _id: employer.id }, job, content: `Work proof for ${job.title}`, createdAt: '2026-10-18T09:00:00Z', attachment: { type: 'completion_evidence', application: 'assignment-0', jobTitle: job.title, images: [] } },
    ];
    if (request.method() === 'PATCH' && url.pathname.includes('/checklist/')) {
      writes.push({ path: url.pathname, body: request.postDataJSON() });
      const application = applications.find((item) => url.pathname.includes(item._id))!;
      application.hireChecklist[0].completed = request.postDataJSON().completed;
      body = { checklist: application.hireChecklist };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { writes, setWorkStatus: (status: string) => { applications[0].workStatus = status; } };
}

test('job details keeps each worker checklist separate and persists employer completion marks', async ({ page }) => {
  const { writes } = await mockChecklist(page);
  await page.goto('/employer/jobs');
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Park cleanup', exact: true });
  const checklists = details.locator('section').filter({ has: page.getByRole('heading', { name: 'Hired workers and checklists' }) });
  await expect(checklists).toContainText('Maria Santos');
  await expect(checklists).toContainText('Juan Santos');
  await expect(checklists.getByRole('checkbox')).toHaveCount(2);
  await checklists.getByRole('checkbox').first().click();
  await expect(checklists.getByRole('checkbox').first()).toBeChecked();
  await expect(checklists.getByRole('checkbox').last()).not.toBeChecked();
  expect(writes).toEqual([{ path: '/api/applications/assignment-0/checklist/task-0', body: { completed: true } }]);
  await details.getByRole('button', { name: 'Close job details', exact: true }).click();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(checklists.getByRole('checkbox').first()).toBeChecked();
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await checklists.getByRole('checkbox').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.agent/worker-checklists-phone.png' });
});

test('worker chat displays the hire checklist as a description table without checkboxes', async ({ page }) => {
  await mockChecklist(page, true);
  await page.goto('/worker/messages');
  const checklist = page.getByRole('table', { name: 'Work checklist' });
  await expect(checklist).toContainText('Sweep the path');
  await expect(checklist).toContainText('Wash the benches');
  await expect(checklist.getByRole('checkbox')).toHaveCount(0);
  await expect(checklist.getByRole('columnheader')).toHaveText(['#', 'Description']);
  await expect(page.getByText('Proof sent for employer review.', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.agent/worker-checklist-chat.png' });
});

for (const withChecklist of [true, false]) {
  test(`worker Assignment Details shows the job description ${withChecklist ? 'and assigned tasks' : 'with an empty checklist state'}`, async ({ page }) => {
    const { writes } = await mockChecklist(page, true, withChecklist);
    await page.goto('/worker/applied-jobs');
    await page.getByRole('button', { name: 'Assignment details', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Park cleanup', exact: true });
    await expect(details.getByRole('heading', { name: 'Job description', exact: true })).toBeVisible();
    await expect(details.getByText('Clean the park grounds', { exact: true })).toBeVisible();
    await expect(details.getByRole('heading', { name: 'Work checklist', exact: true })).toBeVisible();
    if (withChecklist) {
      await expect(details.getByRole('table', { name: 'Work checklist' })).toContainText('Sweep the path');
      await expect(details).not.toContainText('Collect the litter');
    } else await expect(details).toContainText('No checklist provided.');
    await expect(details.getByRole('checkbox')).toHaveCount(0);
    expect(writes).toHaveLength(0);
    await page.setViewportSize({ width: 375, height: 667 });
    expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (withChecklist) await page.screenshot({ path: '.agent/worker-assignment-details-phone.png' });
  });
}

test('worker application actions share one row and use the requested assignment and proof colors', async ({ page }) => {
  const state = await mockChecklist(page, true);
  await page.goto('/worker/applied-jobs');
  await page.getByRole('button', { name: 'Reject all', exact: true }).click();
  const details = page.getByRole('button', { name: 'Assignment details', exact: true });
  const proof = page.getByRole('button', { name: 'Submit proof', exact: true });
  const view = page.getByRole('button', { name: 'View details', exact: true });
  await expect(details).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(details).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(details).toHaveCSS('border-color', 'rgb(0, 0, 0)');
  await expect(proof).toHaveCSS('background-color', 'rgb(4, 120, 87)');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 800 });
    const bounds = await Promise.all([details, proof, view].map((button) => button.boundingBox()));
    const centers = bounds.map((bound) => bound!.y + bound!.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await proof.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await proof.locator('..').screenshot({ path: `.agent/application-proof-actions-${width}.png` });
  }
  await proof.click();
  const proofDialog = page.getByRole('dialog', { name: 'Submit proof', exact: true });
  await expect(proofDialog.getByRole('button', { name: 'Submit proof', exact: true })).toHaveCSS('background-color', 'rgb(4, 120, 87)');
  await proofDialog.getByRole('button', { name: /close/i }).click();
  state.setWorkStatus('Not started');
  await details.click();
  const assignment = page.getByRole('dialog', { name: 'Park cleanup', exact: true });
  await expect(assignment.getByRole('button', { name: 'Start work', exact: true })).toHaveCSS('background-color', 'rgb(4, 120, 87)');
  await expect(assignment.getByRole('button', { name: 'Request cancellation', exact: true })).toHaveCSS('background-color', 'rgb(185, 28, 28)');
  await expect(assignment.getByRole('button', { name: 'Open financial dispute', exact: true })).toHaveCSS('background-color', 'rgb(28, 77, 141)');
  await page.screenshot({ path: '.agent/assignment-action-colors-phone.png' });
  await assignment.getByRole('button', { name: /close/i }).click();
  state.setWorkStatus('Submitted');
  await page.reload();
  const dispute = page.getByRole('button', { name: 'Open payment dispute', exact: true });
  await expect(dispute).toBeVisible();
  const submittedBounds = await Promise.all([details, dispute, view].map((button) => button.boundingBox()));
  const centers = submittedBounds.map((bound) => bound!.y + bound!.height / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
  await view.scrollIntoViewIfNeeded();
  await expect(view).toBeInViewport();
  await view.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await view.locator('..').screenshot({ path: '.agent/application-actions-phone.png' });
});
