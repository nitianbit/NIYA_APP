import { test, expect } from '@playwright/test';
const backend = 'http://127.0.0.1:4176';
test('employee UAT screen waits for verified mapping and distinguishes provider settlement from payment', async ({ page, request }) => {
  await page.context().route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const fixture = await (await request.get(`${backend}/__test/fixture`)).json();
  const cover = await (await request.post(`${backend}/__test/claims/demo`)).json();
  await request.post(`${backend}/__test/reset-auth-limits`);
  await page.route('**/api/employee/app/overview', async route => {
    const response = await route.fetch(); const json = await response.json(); json.claims.mode = 'mediassist_uat';
    return route.fulfill({ json });
  });
  const claim = { id: '000000000000000000000001', memberId: cover.employeeId, memberName: 'Alice Example', relation: 'Self',
    policyId: cover.policyId, policyName: 'Synthetic UAT Policy', treatmentDate: cover.today, hospitalName: 'UAT Hospital',
    state: 'draft', mode: 'mediassist_uat', version: 1, claimType: 'reimbursement', providerReady: false, providerReference: null,
    providerStatus: null, insuranceStatus: null, approvedAmount: null, paidAmount: null,
    details: { hospitalName: 'UAT Hospital', hospitalCity: 'Synthetic City', admissionType: 'planned', reason: 'Synthetic admission' }, documents: [] };
  await page.route('**/api/employee/app/claims**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/employee/app/claims') return route.fulfill({ json: { availability: { enabled: true }, cases: [claim], total: 1 } });
    return route.fulfill({ json: { claim, history: [] } });
  });
  await page.goto('/'); await page.getByLabel('Email or mobile number', { exact: true }).fill(fixture.email);
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  const messages = await (await request.get(`${backend}/__test/mail`)).json();
  await page.getByLabel('Verification code', { exact: true }).fill(messages.filter((m: { to: string }) => m.to === fixture.email).at(-1).text.match(/\b\d{6}\b/)[0]);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByRole('link', { name: 'View claims' }).click();
  await page.getByRole('button').filter({ hasText: 'UAT Hospital' }).click();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Submit to Medi Assist (UAT)' })).toBeDisabled();
  await expect(page.getByText('Broker Admin must verify', { exact: false })).toBeVisible();
  Object.assign(claim, { providerReady: true, state: 'accepted', providerReference: 'UAT-001', insuranceStatus: 'settled', providerStatus: 'Settled' });
  await page.getByRole('button', { name: 'Back to claims' }).click();
  await page.getByRole('button').filter({ hasText: 'UAT Hospital' }).click();
  await expect(page.getByText('TPA received (UAT)', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provider (UAT): Settled' })).toBeVisible();
  await expect(page.getByText('Approved: Not reported · Paid: Not reported')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh provider status', exact: true })).toBeVisible();
  await expect(page.getByText(/Simulated status/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
