import { test, expect } from '@playwright/test';
const backend = 'http://127.0.0.1:4176';
test('an unenrolled employee signs in, sees only their e-cards and downloads a private PDF', async ({ page, request }, info) => {
  await page.context().route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await request.post(`${backend}/__test/reset-auth-limits`);
  const fixture = await (await request.get(`${backend}/__test/ecards/fixture`)).json();
  const login = await request.post(`${backend}/api/auth/login`, { data: { email: 'broker_admin@example.test', password: 'Synthetic-F25-password-72!' } });
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
  const title = `Family PDF ${info.project.name}`;
  const saved = await request.post(`${backend}/api/ecards/file`, { headers, multipart: {
    corporateId: fixture.corporateId, employeeId: fixture.employeeId, title, expectedVersion: '0',
    file: { name: 'card.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF') },
  } }); expect(saved.status()).toBe(201);
  const link = await request.post(`${backend}/api/ecards`, { headers, data: { corporateId: fixture.corporateId,
    employeeId: fixture.employeeId, title: `Family link ${info.project.name}`, url: 'https://example.com/private-card', expectedVersion: 0 } }); expect(link.status()).toBe(201);
  await page.goto('/'); await page.getByLabel('Email or mobile number', { exact: true }).fill(fixture.email);
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  const mail = await (await request.get(`${backend}/__test/mail`)).json();
  const otp = mail.filter((item: { to: string }) => item.to === fixture.email).at(-1).text.match(/\b\d{6}\b/)[0];
  await page.getByLabel('Verification code', { exact: true }).fill(otp); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No current cover to show' })).toBeVisible();
  await page.getByRole('link', { name: 'View e-cards', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your e-cards', exact: true })).toBeVisible();
  const card = page.locator('.ecard-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const pending = page.waitForEvent('download'); await card.getByRole('button', { name: 'Download e-card' }).click();
  const downloaded = await pending; expect(downloaded.suggestedFilename()).toBe('niya-ecard.pdf'); expect(await downloaded.failure()).toBeNull();
  await expect(page.getByRole('link', { name: 'Open e-card' }).first()).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/niya-ecards/app-${info.project.name}.png`, fullPage: false });
});
