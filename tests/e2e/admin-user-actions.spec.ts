import { expect, test, type Page } from '@playwright/test';

const workerId = '507f1f77bcf86cd799439012';
const staffId = '507f1f77bcf86cd799439013';

async function mockUserManagement(page: Page, role = 'support_staff') {
  const account = {
    id: '507f1f77bcf86cd799439011', firstName: 'Signed', lastName: 'In', email: 'staff@example.com',
    role: role === 'superadmin' ? 'superadmin' : 'admin', systemRole: role === 'superadmin' ? 'superadmin' : 'admin',
    staffRole: role, status: 'active', isVerified: true, otpEnabled: true,
  };
  const users = [
    { _id: workerId, firstName: 'Regular', lastName: 'Worker', email: 'worker@example.com', role: 'work', status: 'active', suspiciousFlagged: false, suspiciousFlagReason: '' },
    { _id: staffId, firstName: 'Other', lastName: 'Staff', email: 'other@example.com', role: 'admin', staffRole: 'moderator', status: 'active', otpEnabled: true },
    { ...account, _id: account.id },
  ];
  const mutations: Array<{ path: string; body: unknown }> = [];
  await page.addInitScript((user) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('current_user', JSON.stringify(user));
    localStorage.setItem('cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false }));
  }, account);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (/\/auth\/(me|profile)$/.test(path)) body = { data: account };
    if (path.endsWith('/admin/users')) body = users;
    if (path.endsWith('/admin/stats') || path.endsWith('/admin/wallets')) body = {};
    if (path.endsWith('/admin/analytics-data')) body = { stats: {}, users: [], jobs: [], transactions: [] };
    if (request.method() === 'PATCH') {
      const payload = request.postDataJSON();
      mutations.push({ path, body: payload });
      if (path.endsWith('/suspicious-flag')) {
        users[0].suspiciousFlagged = payload.flagged;
        users[0].suspiciousFlagReason = payload.reason || '';
      }
      if (path.endsWith('/ban')) users[0].status = 'banned';
      if (path.endsWith('/status')) users[0].status = payload.status;
      body = { user: users[0] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/admin/user-management');
  await expect(page.getByRole('row', { name: /Regular Worker/ })).toBeVisible();
  const cookies = page.getByRole('button', { name: 'Reject all', exact: true });
  if (await cookies.isVisible()) await cookies.click();
  return mutations;
}

async function openWorkerMenu(page: Page) {
  await page.getByRole('row', { name: /Regular Worker/ }).getByRole('button', { name: 'Open user actions' }).click();
  return page.getByRole('menu');
}

test('support can view, flag, clear a flag and message users without enforcement actions', async ({ page }) => {
  const mutations = await mockUserManagement(page);
  let menu = await openWorkerMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Suspend User' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: 'Ban', exact: true })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'View Profile', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'User Details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  menu = await openWorkerMenu(page);
  await menu.getByRole('menuitem', { name: 'Flag as Suspicious' }).click();
  await page.locator('#suspicious-flag-reason').fill('Repeated suspicious account activity.');
  await page.getByRole('dialog').getByRole('button', { name: 'Flag user', exact: true }).click();
  menu = await openWorkerMenu(page);
  await menu.getByRole('menuitem', { name: 'Clear Suspicious Flag' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear flag', exact: true }).click();
  expect(mutations.map((item) => item.body)).toEqual([
    { flagged: true, reason: 'Repeated suspicious account activity.' }, { flagged: false },
  ]);
  menu = await openWorkerMenu(page);
  await menu.getByRole('menuitem', { name: 'Message User' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/messages\\?startUser=${workerId}&startName=Regular\\+Worker&source=user-management`));
});

test('full profile opens the selected marketplace account', async ({ page }) => {
  await mockUserManagement(page);
  const menu = await openWorkerMenu(page);
  await menu.getByRole('menuitem', { name: 'View Full Profile' }).click();
  await expect(page).toHaveURL(new RegExp(`/profiles/${workerId}\\?viewAs=worker`));
});

test('finance can flag and message but has no suspend, ban, edit or delete actions', async ({ page }) => {
  await mockUserManagement(page, 'finance_team');
  const menu = await openWorkerMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Flag as Suspicious' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Message User' })).toBeVisible();
  for (const action of ['Suspend User', 'Ban', 'Edit User', 'Delete User']) {
    await expect(menu.getByRole('menuitem', { name: action, exact: true })).toHaveCount(0);
  }
});

for (const role of ['moderator', 'admin_team', 'superadmin']) {
  test(`${role} can suspend, reactivate, and ban with a required reason`, async ({ page }) => {
    const mutations = await mockUserManagement(page, role);
    let menu = await openWorkerMenu(page);
    await menu.getByRole('menuitem', { name: 'Suspend User' }).click();
    await expect(page.getByRole('row', { name: /Regular Worker/ })).toContainText('Disabled');
    menu = await openWorkerMenu(page);
    await menu.getByRole('menuitem', { name: 'Activate User' }).click();
    menu = await openWorkerMenu(page);
    await menu.getByRole('menuitem', { name: 'Ban', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ban account' });
    await expect(dialog.getByRole('button', { name: 'Ban', exact: true })).toBeDisabled();
    await dialog.getByLabel('Reason').fill('Repeated marketplace fraud.');
    await dialog.getByRole('button', { name: 'Ban', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Regular Worker/ })).toContainText('Banned');
    expect(mutations).toEqual([
      { path: `/api/users/${workerId}/status`, body: { status: 'disabled' } },
      { path: `/api/users/${workerId}/status`, body: { status: 'active' } },
      { path: `/api/admin/users/${workerId}/ban`, body: { reason: 'Repeated marketplace fraud.' } },
    ]);
    menu = await openWorkerMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Ban', exact: true })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Activate User' })).toBeVisible();
  });
}

test('menu escapes the table, supports keyboard navigation and closes on outside click', async ({ page }) => {
  await mockUserManagement(page, 'moderator');
  const trigger = page.getByRole('row', { name: /Regular Worker/ }).getByRole('button', { name: 'Open user actions' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem').last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  expect(await menu.evaluate((element) => element.parentElement === document.body)).toBe(true);
  await page.screenshot({ path: '.agent/admin-user-actions-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('heading', { name: 'Manage accounts' }).click();
  await expect(menu).toHaveCount(0);
  await trigger.click();
  await page.getByRole('tab', { name: 'Admins', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await page.getByRole('tab', { name: 'Users', exact: true }).click();
  await trigger.click();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(menu).toHaveCount(0);
});

test('staff targets and the current account remain protected; Admins retains OTP', async ({ page }) => {
  await mockUserManagement(page, 'moderator');
  await page.getByRole('tab', { name: 'Admins', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'OTP', exact: true })).toBeVisible();
  for (const name of ['Other Staff', 'Signed In']) {
    await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Open user actions' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Ban', exact: true })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Suspend User' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

test('phone cards expose moderator enforcement and keep the ban dialog within the screen', async ({ page }) => {
  await mockUserManagement(page, 'moderator');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Ban', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ban account' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.agent/admin-user-ban-phone.png' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
