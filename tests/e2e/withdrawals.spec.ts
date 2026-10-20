import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function mockWallet(page: Page, employer: boolean, requiresReview = false, unverifiedDestination = false) {
  const user = { id: '507f1f77bcf86cd799439012', _id: '507f1f77bcf86cd799439012', email: 'wallet@example.com', firstName: 'Wallet', lastName: 'User', role: employer ? 'hire' : 'work', systemRole: employer ? 'hire' : 'work', accountType: employer ? 'employer' : 'worker', accountOptions: [employer ? 'employer' : 'worker'], status: 'active', isVerified: true, employerBalance: 500, workerBalance: 500 };
  await page.addInitScript((value) => { localStorage.setItem('auth_user', JSON.stringify(value)); localStorage.setItem('current_user', JSON.stringify(value)); }, user);
  let confirmed = 0; let previews = 0; let requests: Array<Record<string, unknown>> = []; let paid = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname; let body: unknown = [];
    if (path.endsWith('/auth/me')) body = { data: { ...user, employerBalance: confirmed ? 400 : 500, workerBalance: confirmed ? 400 : 500 } };
    else if (path.endsWith('/payment/transactions')) body = { transactions: [] };
    else if (path.endsWith('/payment/payout-requests')) body = { payoutRequests: requests.map((item) => ({ ...item, status: paid ? 'paid' : item.status })) };
    else if (path.endsWith('/withdrawals/policy')) body = { minimum: 100, maximum: employer ? 50000 : null, reviewThreshold: requiresReview ? 50 : 50000 };
    else if (path.endsWith('/withdrawals/institutions')) body = { institutions: [{ bic: 'TESTPH', name: 'Test Bank' }] };
    else if (path.endsWith('/withdrawals/preview')) {
      previews += 1; const payload = req.postDataJSON();
      body = { reviewReason: requiresReview ? 'This withdrawal exceeds the configured review threshold and requires Finance approval before transfer.' : undefined, reviewCodes: requiresReview ? ['threshold'] : unverifiedDestination ? ['ownership'] : employer ? [] : ['worker', 'ownership'], reviewThreshold: requiresReview ? 50 : 50000, requiresReview: requiresReview || unverifiedDestination || !employer, expiresAt: new Date(Date.now() + 300000).toISOString(), previewToken: `preview-${previews}`, sourceWallet: employer ? 'EMPLOYER' : 'WORKER', amount: Number(payload.amount), fee: 0, totalDebit: Number(payload.amount), remainingBalance: 500 - Number(payload.amount), destination: { institutionName: 'Test Bank', accountName: payload.destinationSnapshot.accountName, accountNumberMasked: `•••• ${payload.destinationSnapshot.accountNumber.slice(-4)}` } };
    } else if (path.endsWith('/withdrawals/confirm')) {
      confirmed += 1; expect(req.postDataJSON().detailsConfirmed).toBe(true);
      const item = { _id: '507f1f77bcf86cd799439099', amount: 100, sourceWallet: employer ? 'EMPLOYER' : 'WORKER', processingMode: employer && !requiresReview && !unverifiedDestination ? 'automatic' : 'manual', status: employer && !requiresReview && !unverifiedDestination ? 'processing' : 'requested', providerTransferId: employer && !unverifiedDestination ? 'tr_test' : undefined, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test Bank', accountName: 'Wallet User', accountNumberMasked: '•••• 5678' } };
      requests = [item]; body = { payoutRequest: item };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(employer ? '/employer/e-wallet' : '/worker/e-wallet');
  const panel = page.locator('#withdrawal');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Amount (PHP)').fill('100');
  if (employer) await panel.getByLabel('Bank or e-wallet').selectOption('TESTPH');
  else await panel.getByLabel('Bank or e-wallet').fill('Test Bank');
  await panel.getByLabel('Account name', { exact: true }).fill('Wallet User');
  await panel.getByLabel('Account number', { exact: true }).fill('12345678');
  return { panel, confirmed: () => confirmed, previews: () => previews, markPaid: () => { paid = true; } };
}

test('worker withdrawal requires both confirmations and preserves funds when dismissed', async ({ page }) => {
  const wallet = await mockWallet(page, false);
  await wallet.panel.getByRole('button', { name: 'Withdraw', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Are you sure you want to withdraw?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Go back', exact: true }).click();
  expect(wallet.confirmed()).toBe(0);
  await wallet.panel.getByLabel('Amount (PHP)').fill('150');
  await wallet.panel.getByRole('button', { name: 'Withdraw', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Verify withdrawal details' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm withdrawal', exact: true })).toBeDisabled();
  await expect(dialog.getByText('Test Bank · Wallet User · •••• 5678')).toBeVisible();
  await expect(dialog.getByText('12345678', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(wallet.confirmed()).toBe(0); expect(wallet.previews()).toBe(2);
});

test('employer with a verified destination confirms unused-fund withdrawal and sees provider processing', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 375, height: 900 });
  const wallet = await mockWallet(page, true);
  await wallet.panel.getByRole('button', { name: 'Withdraw', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'I confirm that the amount and destination are correct.' }).check();
  const violations = (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations;
  expect(violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Confirm withdrawal', exact: true }).dblclick();
  await expect(dialog).toBeHidden(); expect(wallet.confirmed()).toBe(1);
  await expect(wallet.panel.getByRole('status')).toBeVisible();
  await expect(wallet.panel.getByRole('button', { name: 'Cancel withdrawal', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  wallet.markPaid(); await page.clock.fastForward(15001);
  await expect(wallet.panel.getByRole('status')).toContainText('Paid');
});

test('large employer withdrawals explain Finance review before confirmation', async ({ page }) => {
  const wallet = await mockWallet(page, true, true);
  await expect(wallet.panel.getByText('Amounts above', { exact: false })).toContainText('Finance review');
  await wallet.panel.getByRole('button', { name: 'Withdraw', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('requires Finance approval');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirm withdrawal', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(wallet.confirmed()).toBe(1);
  await expect(wallet.panel.getByRole('status')).toContainText('Withdrawal under review');
});

test('unverified employer destination shows ownership review and preview expiry before confirmation', async ({ page }) => {
  const wallet = await mockWallet(page, true, false, true);
  await expect(wallet.panel.getByLabel('Amount (PHP)')).toHaveAttribute('min', '100');
  await wallet.panel.getByRole('button', { name: 'Withdraw', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('verify ownership');
  await expect(dialog.getByText('Preview expires at', { exact: false })).toBeVisible();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirm withdrawal', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(wallet.panel.getByRole('status')).toContainText('Withdrawal under review');
  expect(wallet.confirmed()).toBe(1);
});
