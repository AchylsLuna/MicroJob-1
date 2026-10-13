import { expect, test, type Page } from '@playwright/test';

async function mockSettings(page: Page, role = 'admin', staffRole: string | null = 'support_staff', options: { verified?: boolean; failSend?: boolean; failVerify?: boolean } = {}) {
  const user = { id: '507f1f77bcf86cd799439011', email: 'staff@example.com', firstName: 'Test', lastName: 'Staff', role, systemRole: role, staffRole, status: 'active', isVerified: true };
  let secondary = { email: options.verified ? 'verified@example.com' : '', verified: Boolean(options.verified) };
  const mutations: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript((account) => {
    localStorage.setItem('auth_user', JSON.stringify(account));
    localStorage.setItem('current_user', JSON.stringify(account));
  }, user);
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let body: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/me')) body = { data: user };
    if (path.endsWith('/auth/profile')) body = { user };
    if (path.endsWith('/auth/secondary-email')) body = secondary;
    if (path.endsWith('/auth/mfa/status')) body = { enabled: false };
    if (path.endsWith('/verification-status')) body = { steps: [], completionPercent: 0 };
    if (req.method() === 'POST') {
      if (/\/(secondary-email|password-change)\//.test(path)) mutations.push({ path, body: req.postDataJSON() });
      if (path.endsWith('/secondary-email/request')) {
        body = { message: 'OTP sent' };
        if (options.failSend) { status = 500; body = { message: 'Email delivery failed.' }; }
      }
      if (path.endsWith('/secondary-email/confirm')) {
        if (options.failVerify) { status = 400; body = { message: 'Verification code is invalid or expired.' }; }
        else { secondary = { email: req.postDataJSON().email, verified: true }; body = secondary; }
      }
      if (path.endsWith('/password-change/request')) body = { message: 'OTP sent' };
      if (path.endsWith('/password-change/confirm')) body = { message: 'Password changed successfully.' };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return mutations;
}

test('staff verifies a secondary email before changing their password, retains it after reload', async ({ page }) => {
  const mutations = await mockSettings(page);
  await page.goto('/settings?tab=security');
  await expect(page.getByRole('button', { name: 'Send OTP', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Set up secondary email' }).click();
  await page.getByRole('textbox', { name: 'Secondary Email', exact: true }).fill('secondary@example.com');
  await page.getByLabel('Current password to verify secondary email').fill('CurrentPass1!');
  await page.getByRole('button', { name: 'Send verification OTP', exact: true }).click();
  await expect(page.getByLabel('Secondary email OTP')).toBeVisible();
  await page.getByLabel('Secondary email OTP').fill('123456');
  await page.getByRole('button', { name: 'Verify secondary email', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Secondary email verified' }).first()).toBeVisible();
  expect(mutations.slice(0, 2)).toEqual([
    { path: '/api/auth/secondary-email/request', body: { email: 'secondary@example.com', currentPassword: 'CurrentPass1!' } },
    { path: '/api/auth/secondary-email/confirm', body: { email: 'secondary@example.com', code: '123456' } },
  ]);
  await page.goto('/settings?tab=security');
  await expect(page.getByText('Your password change OTP will be sent to secondary@example.com.')).toBeVisible();
  await page.getByLabel('Current Password', { exact: true }).fill('CurrentPass1!');
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  await page.getByLabel('Password change verification code').fill('654321');
  await page.getByLabel('New Password', { exact: true }).fill('UpdatedPass2!');
  await page.getByLabel('Confirm Password', { exact: true }).fill('UpdatedPass2!');
  await page.getByRole('button', { name: 'Save New Password' }).click();
  await expect(page.getByText(/Password changed successfully/)).toBeVisible();
  expect(mutations.at(-1)).toEqual({ path: '/api/auth/password-change/confirm', body: { currentPassword: 'CurrentPass1!', code: '654321', newPassword: 'UpdatedPass2!' } });
});

test('all staff roles see Secondary Email; worker and employer settings do not', async ({ page }) => {
  for (const [role, staffRole] of [['superadmin', null], ['admin', 'admin_team'], ['admin', 'moderator'], ['admin', 'support_staff'], ['admin', 'analytics_team'], ['admin', 'finance_team']]) {
    await mockSettings(page, role!, staffRole);
    await page.goto('/settings');
    await expect(page.getByRole('textbox', { name: 'Secondary Email', exact: true })).toBeVisible();
  }
  for (const role of ['work', 'hire']) {
    await mockSettings(page, role, null);
    await page.goto(role === 'work' ? '/worker/settings' : '/employer/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true }).last()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Secondary Email', exact: true })).toHaveCount(0);
  }
});

test('failed verification keeps staff password changes blocked; editing the candidate resets OTP entry', async ({ page }) => {
  await mockSettings(page, 'admin', 'moderator', { failVerify: true });
  await page.goto('/settings');
  await page.getByRole('textbox', { name: 'Secondary Email', exact: true }).fill('candidate@example.com');
  await page.getByLabel('Current password to verify secondary email').fill('CurrentPass1!');
  await page.getByRole('button', { name: 'Send verification OTP', exact: true }).click();
  await page.getByLabel('Secondary email OTP').fill('123456');
  await page.getByRole('button', { name: 'Verify secondary email', exact: true }).click();
  await expect(page.getByText('Verification code is invalid or expired.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Secondary Email', exact: true }).fill('different@example.com');
  await expect(page.getByLabel('Secondary email OTP')).toHaveCount(0);
  await page.goto('/settings?tab=security');
  await expect(page.getByRole('button', { name: 'Send OTP', exact: true })).toBeDisabled();
});

test('verified secondary email stays active during replacement and fits phone layouts', async ({ page }) => {
  await mockSettings(page, 'admin', 'finance_team', { verified: true, failSend: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/settings');
  await expect(page.getByRole('textbox', { name: 'Secondary Email', exact: true })).toHaveValue('verified@example.com');
  await page.getByRole('textbox', { name: 'Secondary Email', exact: true }).fill('replacement@example.com');
  await page.getByLabel('Current password to verify secondary email').fill('CurrentPass1!');
  await page.getByRole('button', { name: 'Send verification OTP', exact: true }).click();
  await expect(page.getByText('Email delivery failed.', { exact: true })).toBeVisible();
  await expect(page.getByText('Verified address for password changes: verified@example.com')).toBeVisible();
  await expect(page.getByLabel('Secondary email OTP')).toHaveCount(0);
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await page.getByRole('button', { name: 'Reject all', exact: true }).click();
  await page.getByRole('region', { name: 'Secondary Email', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.agent/staff-secondary-email-phone.png', fullPage: true });
});
