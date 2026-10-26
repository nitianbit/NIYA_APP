import { expect, test, type Page } from '@playwright/test';
import type { Overview } from '../src/lib/api';

const bearer = 'browser-test-access-token';
const employee: Overview['profile'] = {
  id: 'employee-1', fullName: 'Priya Example', employeeCode: 'EX-001',
  email: 'priya@example.test', phone: '+919000000001', gender: 'Female',
  dateOfBirth: 19900110, department: 'Operations', dateOfJoining: 20200115,
  corporateName: 'Example Industries',
};
const father = {
  id: 'dependent-1', fullName: 'Ravi Example', relation: 'Father',
  gender: 'Male', dateOfBirth: 19600220,
};
const overview: Overview = {
  profile: employee,
  family: [father],
  covers: [{
    id: 'base-1', name: 'Example Base GMI', type: 'base',
    periodStart: 20260101, periodEnd: 20261231,
    sumInsured: 500000, parentCoverLimit: 300000,
    members: [{ ...employee, relation: 'Self' }, father],
  }, {
    id: 'topup-1', name: 'Example Optional Top-up', type: 'topup',
    periodStart: 20260101, periodEnd: 20261231,
    sumInsured: 1000000, parentCoverLimit: 400000,
    members: [{ ...employee, relation: 'Self' }, father],
  }],
};

async function mockApi(page: Page, data: Overview = overview) {
  const state = { unauthorized: false, wrongCode: false, requests: 0, verifications: 0, reads: 0 };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/employee/app/auth/otp/request') {
      state.requests += 1;
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({ identifier: employee.email });
      await route.fulfill({ json: { cooldownSeconds: 60 } });
      return;
    }
    if (path === '/api/employee/app/auth/otp/verify') {
      state.verifications += 1;
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({ identifier: employee.email, code: '123456' });
      await route.fulfill(state.wrongCode
        ? { status: 400, json: { message: 'The verification code is not correct.' } }
        : { json: { accessToken: bearer } });
      return;
    }
    if (path === '/api/employee/app/overview') {
      state.reads += 1;
      expect(request.headers().authorization).toBe(`Bearer ${bearer}`);
      await route.fulfill(state.unauthorized
        ? { status: 401, json: { message: 'Your session has expired. Please sign in again.' } }
        : { json: data });
      return;
    }
    throw new Error(`Unexpected employee-app request: ${request.method()} ${path}`);
  });
  return state;
}

async function enterCode(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email or mobile number', { exact: true }).fill(employee.email);
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
}

async function signIn(page: Page) {
  await enterCode(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Priya', exact: true })).toBeVisible();
}

test('employee signs in, sees their family and separate covers, and signs out', async ({ page }) => {
  const state = await mockApi(page);
  await signIn(page);
  await expect(page.getByText('Example Industries', { exact: true })).toBeVisible();
  await expect(page.getByText('2 covered members', { exact: true })).toBeVisible();
  await expect(page.locator('a, button').filter({ hasText: /apply for claim|find hospitals|e-card|services/i })).toHaveCount(0);

  await page.getByRole('link', { name: /Your family.*View family/ }).click();
  const fatherCard = page.locator('section').filter({ has: page.getByRole('heading', { name: father.fullName, exact: true }) });
  await expect(fatherCard.getByText('20 Feb 1960', { exact: true })).toBeVisible();
  await expect(fatherCard.getByText('Male', { exact: true })).toBeVisible();
  await expect(page.getByText('This is your family roster.', { exact: false })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Cover', exact: true }).click();
  const base = page.getByRole('region', { name: 'Example Base GMI', exact: true });
  const topup = page.getByRole('region', { name: 'Example Optional Top-up', exact: true });
  await expect(base.getByText('₹5,00,000', { exact: true })).toBeVisible();
  await expect(topup.getByText('₹10,00,000', { exact: true })).toBeVisible();
  await expect(base.getByText('Lower limit for parents or in-laws: ₹3,00,000', { exact: true })).toBeVisible();
  await expect(topup.getByText('Lower limit for parents or in-laws: ₹4,00,000', { exact: true })).toBeVisible();
  await expect(base.getByText('One amount shared by all covered members, rather than a separate amount for each person.', { exact: true })).toBeVisible();
  await expect(base.getByText(father.fullName, { exact: true })).toBeVisible();
  await expect(topup.getByText(father.fullName, { exact: true })).toBeVisible();
  await expect(page.getByText(/premium/i)).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByText(employee.email, { exact: true })).toBeVisible();
  await expect(page.getByText('10 Jan 1990', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Your cover', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send verification code', exact: true })).toBeVisible();
  await expect(page.getByText(employee.fullName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  expect(state).toMatchObject({ requests: 1, verifications: 1, reads: 1 });
});

test('incorrect OTP keeps the entered details and blocks duplicate requests during cooldown', async ({ page }) => {
  const state = await mockApi(page);
  state.wrongCode = true;
  await enterCode(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The verification code is not correct.');
  await expect(page.getByLabel('Verification code', { exact: true })).toHaveValue('123456');
  await expect(page.getByLabel('Email or mobile number', { exact: true })).toHaveValue(employee.email);
  await expect(page.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Change details', exact: true }).click();
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await expect(page.getByText('Use the code already requested for this email or number.', { exact: true })).toBeVisible();
  expect(state.requests).toBe(1);
  state.wrongCode = false;
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Priya', exact: true })).toBeVisible();
  expect(state.verifications).toBe(2);
});

test('browser login never persists the bearer token or employee data and reload requires sign-in', async ({ page }) => {
  const state = await mockApi(page);
  await signIn(page);
  const storedValues = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)]);
  expect(storedValues.join('\n')).not.toContain(bearer);
  expect(storedValues.join('\n')).not.toContain(employee.email);
  expect(storedValues.join('\n')).not.toContain(father.fullName);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Send verification code', exact: true })).toBeVisible();
  await expect(page.getByText(employee.fullName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  expect(state.reads).toBe(1);
});

test('an expired session on refresh removes private screens and asks the employee to sign in', async ({ page }) => {
  const state = await mockApi(page);
  await signIn(page);
  state.unauthorized = true;
  await page.getByRole('button', { name: 'Refresh your details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send verification code', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Your session has expired. Please sign in again.');
  await expect(page.getByText('Example Base GMI', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.goto('/#/family');
  await expect(page.getByText(father.fullName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send verification code', exact: true })).toBeVisible();
});

test('missing roster details and no current cover remain useful without inventing policy data', async ({ page }) => {
  const empty: Overview = {
    profile: { ...employee, dateOfBirth: null, gender: '', phone: '', dateOfJoining: null },
    family: [], covers: [],
  };
  await mockApi(page, empty);
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'No current cover to show', exact: true })).toBeVisible();
  await expect(page.getByText(/Your P&C team can help if you expected a policy here/)).toBeVisible();
  await page.getByRole('link', { name: /Your family.*View family/ }).click();
  await expect(page.getByRole('heading', { name: 'No dependents on your roster', exact: true })).toBeVisible();
  await expect(page.getByText('Not on file', { exact: true })).toHaveCount(2);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Cover', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No current cover to show', exact: true })).toBeVisible();
  await expect(page.getByText(/ask your P&C team to check your enrolment/)).toBeVisible();
  await expect(page.getByText('Shared family sum insured', { exact: true })).toHaveCount(0);
});
