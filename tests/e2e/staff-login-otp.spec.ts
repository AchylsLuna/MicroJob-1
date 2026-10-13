import { expect, test, type Page, type Locator } from '@playwright/test';
import { ROUTES } from '../../client/src/utils/routes';

const baseUser = { id: '507f1f77bcf86cd799439011', email: 'primary@example.com', firstName: 'Test', lastName: 'Admin', role: 'superadmin', systemRole: 'superadmin', staffRole: 'superadmin', status: 'active', isVerified: true };

async function mockStaff(page: Page, options: { otp?: boolean; failCode?: boolean; signedIn?: boolean } = {}) {
  const user = { ...baseUser, otpEnabled: Boolean(options.otp) };
  const mutations: Array<{ path: string; body: unknown }> = [];
  let verified = false;
  await page.addInitScript(({ account, signedIn }) => {
    if (signedIn) {
      localStorage.setItem('auth_user', JSON.stringify(account));
      localStorage.setItem('current_user', JSON.stringify(account));
    }
  }, { account: user, signedIn: options.signedIn });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/me') || path.endsWith('/auth/profile')) body = { data: user };
    if (path.endsWith('/admin/users')) body = [
      { _id: '507f1f77bcf86cd799439012', firstName: 'Enabled', lastName: 'Moderator', email: 'moderator@example.com', role: 'admin', staffRole: 'moderator', status: 'active', otpEnabled: true },
      { _id: '507f1f77bcf86cd799439013', firstName: 'Pending', lastName: 'Support', email: 'support@example.com', role: 'admin', staffRole: 'support_staff', status: 'active', otpEnabled: false },
      { _id: '507f1f77bcf86cd799439014', firstName: 'Regular', lastName: 'Worker', email: 'worker@example.com', role: 'work', status: 'active' },
    ];
    if (path.endsWith('/admin/stats') || path.endsWith('/admin/wallets')) body = {};
    if (path.endsWith('/admin/analytics-data')) body = { stats: {}, users: [], jobs: [], transactions: [] };
    if (path.endsWith('/auth/secondary-email')) body = { email: verified || options.otp ? 'secondary@example.com' : '', verified: verified || Boolean(options.otp) };
    if (req.method() === 'POST') {
      const payload = req.postDataJSON();
      if (/\/auth\/(login|secondary-email)/.test(path)) mutations.push({ path, body: payload });
      if (path.endsWith('/auth/login')) body = options.otp
        ? { data: { otpRequired: true, otpToken: 'first-challenge', deliveryEmail: 'secondary@example.com', staffLogin: true } }
        : { data: { user, token: 'test-token' } };
      if (path.endsWith('/login/otp/verify')) {
        if (options.failCode && payload.code !== '654321') { status = 401; body = { message: 'Invalid or expired OTP code.' }; }
        else body = { data: { user, token: 'test-token' } };
      }
      if (path.endsWith('/login/otp/resend')) body = { data: { otpRequired: true, otpToken: 'renewed-challenge', deliveryEmail: 'secondary@example.com', staffLogin: true } };
      if (path.endsWith('/secondary-email/request')) body = { message: 'OTP sent' };
      if (path.endsWith('/secondary-email/confirm')) { verified = true; body = { email: payload.email, verified: true }; }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return mutations;
}

async function signIn(page: Page) {
  await page.goto(ROUTES.adminSignIn);
  const rejectCookies = page.getByRole('button', { name: 'Reject all', exact: true });
  if (await rejectCookies.isVisible()) await rejectCookies.click();
  await page.getByLabel('Primary Email').fill('primary@example.com');
  await page.getByLabel('Password', { exact: true }).fill('CurrentPass1!');
  await page.getByRole('button', { name: 'Sign In as Admin', exact: true }).click();
}

async function enterCode(dialog: Locator, code: string) {
  for (let index = 0; index < code.length; index++) await dialog.locator('input').nth(index).fill(code[index]);
}

test('primary email credentials open secondary-email OTP, then authenticate into the admin dashboard', async ({ page }) => {
  const mutations = await mockStaff(page, { otp: true });
  await signIn(page);
  const dialog = page.getByRole('dialog', { name: 'Verify your sign-in' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('secondary@example.com');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('auth_user'))).toBeNull();
  await enterCode(dialog, '123456');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('dialog', { name: 'Set up secondary email and OTP verification' })).toHaveCount(0);
  expect(mutations).toEqual([
    { path: '/api/auth/login', body: { emailOrUsername: 'primary@example.com', password: 'CurrentPass1!', staffOnly: true } },
    { path: '/api/auth/login/otp/verify', body: { otpToken: 'first-challenge', code: '123456', rememberDevice: false } },
  ]);
});

test('OTP Off permits dashboard access and prompts setup; dismissal lasts until the next sign-in', async ({ page }) => {
  await mockStaff(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const warning = page.getByRole('dialog', { name: 'Set up secondary email and OTP verification' });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('OTP verification is off');
  await warning.getByRole('button', { name: 'Remind me next sign-in' }).click();
  await page.reload();
  await expect(warning).toHaveCount(0);
  await page.evaluate(() => { localStorage.removeItem('auth_user'); localStorage.removeItem('current_user'); });
  await signIn(page);
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: 'Set up secondary email', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\?tab=personal$/);
  await expect(page.getByRole('textbox', { name: 'Secondary Email', exact: true })).toBeVisible();
});

test('invalid OTP can be retried; resend uses the renewed token and stays on secondary-email verification', async ({ page }) => {
  await page.clock.install();
  const mutations = await mockStaff(page, { otp: true, failCode: true });
  await signIn(page);
  const dialog = page.getByRole('dialog', { name: 'Verify your sign-in' });
  await enterCode(dialog, '123456');
  await expect(page.getByText('Invalid or expired OTP code.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(dialog.locator('input').first()).toHaveValue('');
  await page.clock.runFor(61_000);
  await dialog.getByRole('button', { name: /Resend/ }).click();
  await expect(page.getByText('New OTP sent!', { exact: true })).toBeVisible();
  await page.getByRole('status').filter({ hasText: 'New OTP sent!' }).getByRole('button', { name: 'Dismiss notification' }).click();
  await enterCode(dialog, '654321');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(mutations.at(-1)).toEqual({ path: '/api/auth/login/otp/verify', body: { otpToken: 'renewed-challenge', code: '654321', rememberDevice: false } });
});

test('Admins table shows OTP On/Off tags on desktop and phone; Users tab has no OTP column', async ({ page }) => {
  await mockStaff(page, { otp: true, signedIn: true });
  await page.goto('/admin/user-management');
  await expect(page.getByRole('columnheader', { name: 'OTP', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Admins', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'OTP', exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /Enabled Moderator/ }).getByLabel('OTP On')).toBeVisible();
  await expect(page.getByRole('row', { name: /Pending Support/ }).getByLabel('OTP Off')).toBeVisible();
  await page.getByRole('button', { name: 'Reject all', exact: true }).click();
  await page.getByRole('table').screenshot({ path: '.agent/staff-otp-table-desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel('OTP On').filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel('OTP Off').filter({ visible: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('div[aria-label="Users"]').screenshot({ path: '.agent/staff-otp-table-phone.png' });
});

test('phone login warning is accessible and directs the staff member to secondary-email setup', async ({ page }) => {
  await mockStaff(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  const warning = page.getByRole('dialog', { name: 'Set up secondary email and OTP verification' });
  await expect(warning).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.agent/staff-otp-warning-phone.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(warning).toHaveCount(0);
});

test('phone secondary-email OTP fits the screen and cancel leaves the staff member signed out', async ({ page }) => {
  const mutations = await mockStaff(page, { otp: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  const dialog = page.getByRole('dialog', { name: 'Verify your sign-in' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.agent/staff-login-otp-phone.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Cancel verification' }).click();
  await expect(dialog).toHaveCount(0);
  expect(mutations).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('auth_user'))).toBeNull();
});
