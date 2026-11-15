import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
const backend = 'http://127.0.0.1:4176';
const dateInput = (value: number) => String(value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
test('employee reimbursement includes originals, additional documents and simulated settlement', async ({ page, request }, info) => {
  test.setTimeout(120000);
  await page.context().route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const fixture = await (await request.get(`${backend}/__test/fixture`)).json();
  const claims = await (await request.post(`${backend}/__test/claims/demo`)).json();
  await request.post(`${backend}/__test/reset-auth-limits`);
  await page.goto('/');
  await page.getByLabel('Email or mobile number', { exact: true }).fill(fixture.email);
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  const messages = await (await request.get(`${backend}/__test/mail`)).json();
  await page.getByLabel('Verification code', { exact: true }).fill(messages.filter((mail: { to: string }) => mail.to === fixture.email).at(-1).text.match(/\b\d{6}\b/)[0]);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'View claims' }).click();
  await page.getByRole('button', { name: 'New claim', exact: true }).click();
  await page.getByLabel('Claim journey').selectOption('reimbursement');
  const form = page.getByRole('form', { name: 'Reimbursement draft' });
  await form.getByLabel('Admission date').fill(dateInput(claims.today));
  await form.getByLabel('Policy', { exact: true }).selectOption(claims.policyId);
  await form.getByLabel('Covered family member').selectOption(claims.employeeId);
  await form.getByLabel('Hospital name').fill(`Reimbursement ${info.project.name} hospital`);
  await form.getByLabel('Hospital city').fill('Synthetic City');
  await form.getByLabel('Reason for admission').fill('Synthetic demo admission');
  await form.getByLabel('Discharge date').fill(dateInput(claims.today));
  await form.getByLabel('Claim amount (₹)').fill('12345.50');
  await form.getByLabel('Hospital address').fill('100 Synthetic Road');
  await form.getByLabel('Diagnosis / disease').fill('Synthetic diagnosis');
  await form.getByLabel('Contact phone').fill('9999999999');
  await form.getByLabel('Contact email').fill('alice@example.test');
  const blank = page.waitForEvent('download');
  await form.getByRole('button', { name: 'Download blank claim form' }).click();
  expect((await blank).suggestedFilename()).toContain('claim-form.pdf');
  await page.screenshot({ path: `/tmp/niya-reimbursement-form-${info.project.name}.png`, fullPage: true });
  await form.getByRole('button', { name: 'Save draft', exact: true }).click();
  const detail = page.getByRole('region', { name: 'Reimbursement claim details' });
  const documents = detail.getByRole('region', { name: 'Claim documents' });
  await expect(detail.getByRole('button', { name: 'Submit test claim', exact: true })).toBeDisabled();
  for (const category of ['claim_form', 'discharge_summary', 'hospital_bill', 'receipt']) {
    await documents.getByLabel('Document category').selectOption(category);
    const slowForm = category === 'claim_form' && info.project.name === 'desktop';
    const cdp = slowForm ? await page.context().newCDPSession(page) : null;
    if (cdp) {
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 125_000 });
    }
    const started = Date.now();
    try {
      const buffer = slowForm ? await readFile(new URL('../../niya_backend/assets/claims/mediassist-reimbursement-form.pdf', import.meta.url)) : Buffer.from(`%PDF-1.4\nSynthetic ${category} ${info.project.name}`);
      await documents.getByLabel('Add document', { exact: true }).setInputFiles({ name: `${category}.pdf`, mimeType: 'application/pdf', buffer });
      await expect(documents.getByText(`${category}.pdf`, { exact: true })).toBeVisible({ timeout: 90_000 });
      if (slowForm) expect(Date.now() - started).toBeGreaterThan(30_000);
    } finally {
      if (cdp) {
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        await cdp.detach();
      }
    }
  }
  const downloaded = page.waitForEvent('download');
  await documents.getByRole('button', { name: 'Open', exact: true }).first().click();
  expect((await downloaded).suggestedFilename()).toBe('claim_form.pdf');
  await detail.getByRole('checkbox').check();
  await detail.getByRole('button', { name: 'Submit test claim', exact: true }).click();
  await expect(detail.getByText('Waiting to send', { exact: true })).toBeVisible();
  await request.post(`${backend}/__test/claims/drain`);
  await detail.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(detail.getByText('Test received', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Refresh demo status', exact: true }).click();
  await expect(detail.getByText('Simulated status: Documents requested')).toBeVisible();
  await documents.getByLabel('Document category').selectOption('receipt');
  await documents.getByLabel('Add document', { exact: true }).setInputFiles({ name: 'additional.pdf', mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\nAdditional ${info.project.name}`) });
  await expect(documents.getByText('additional.pdf', { exact: true })).toBeVisible();
  await detail.getByRole('checkbox').check();
  await detail.getByRole('button', { name: 'Submit test document response', exact: true }).click();
  await expect(detail.getByText('Waiting to send', { exact: true })).toBeVisible();
  await request.post(`${backend}/__test/claims/drain`);
  await detail.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await detail.getByRole('button', { name: 'Refresh demo status', exact: true }).click();
  await expect(detail.getByText('Simulated status: Approved')).toBeVisible();
  await detail.getByRole('button', { name: 'Refresh demo status', exact: true }).click();
  await expect(detail.getByText('Simulated status: Paid')).toBeVisible();
  await expect(detail.getByText('Claim submitted', { exact: true })).toBeVisible();
  await expect(detail.getByText('Document response submitted', { exact: true })).toBeVisible();
  await expect(page.getByText(/premium/i)).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic diagnosis');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `/tmp/niya-reimbursement-paid-${info.project.name}.png`, fullPage: true });
});
