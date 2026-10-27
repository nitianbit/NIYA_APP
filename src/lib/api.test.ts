import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, dateLabel, rupees } from './api';
import { validateApiBaseUrl } from './config';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

beforeEach(() => {
  vi.stubEnv('PROD', false);
  vi.stubEnv('VITE_API_BASE_URL', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('API configuration', () => {
  it('uses the Vite proxy only for unconfigured browser development', () => {
    expect(validateApiBaseUrl('', false, false)).toBe('');
    expect(() => validateApiBaseUrl('', true, false)).toThrow('VITE_API_BASE_URL');
    expect(() => validateApiBaseUrl('', false, true)).toThrow('VITE_API_BASE_URL');
    expect(validateApiBaseUrl('https://api.niya.test/', true, true)).toBe('https://api.niya.test');
  });
  it('permits HTTP only for approved browser development hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '10.0.2.2']) {
      expect(validateApiBaseUrl(`http://${host}:4000`, false, false)).toBe(`http://${host}:4000`);
    }
    for (const url of ['http://api.niya.test', 'https://api.niya.test/api',
      'https://user:pass@api.niya.test', 'https://api.niya.test/?secret=x']) {
      expect(() => validateApiBaseUrl(url, false, false)).toThrow('HTTPS API origin');
    }
    expect(() => validateApiBaseUrl('http://localhost:4000', true, false)).toThrow();
    expect(() => validateApiBaseUrl('http://10.0.2.2:4000', false, true)).toThrow();
  });
  it('refuses an unconfigured production request before contacting a server', async () => {
    vi.stubEnv('PROD', true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/api/employee/app/overview')).rejects.toThrow('VITE_API_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('API requests', () => {
  it('uses the exact API path, omits cookies and caches, and sends the token only in a header', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    vi.stubGlobal('fetch', fetchMock);
    await api('/api/employee/app/overview', { token: 'private-token' });
    expect(fetchMock).toHaveBeenCalledWith('/api/employee/app/overview', expect.objectContaining({
      credentials: 'omit', cache: 'no-store', signal: expect.any(AbortSignal),
      headers: { Accept: 'application/json', Authorization: 'Bearer private-token' },
    }));
    expect(fetchMock.mock.calls[0][0]).not.toContain('private-token');
  });
  it('encodes scoped date queries and supports versioned PATCH without moving credentials into URLs', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    vi.stubGlobal('fetch', fetchMock);
    await api('/api/employee/app/claims/options', { token: 'private-token', query: { on: 20261026, search: 'A & B', omitted: undefined } });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/employee/app/claims/options?on=20261026&search=A+%26+B');
    await api('/api/employee/app/claims/example', { method: 'PATCH', token: 'private-token', body: { expectedVersion: 2 } });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: '{"expectedVersion":2}' });
    await expect(api('/api/employee/app/claims?token=bad')).rejects.toThrow('Invalid NIYA API path');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('keeps date, pagination and encoded filters without URLSearchParams.size', async () => {
    class OlderSearchParams extends URLSearchParams {}
    Object.defineProperty(OlderSearchParams.prototype, 'size', { get: () => undefined });
    vi.stubGlobal('URLSearchParams', OlderSearchParams);
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    vi.stubGlobal('fetch', fetchMock);
    await api('/api/employee/app/claims/options', { query: { on: 20261020, search: 'A & B', omitted: undefined } });
    await api('/api/employee/app/claims', { query: { page: 2 } });
    await api('/api/employee/app/claims', { query: {} });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      '/api/employee/app/claims/options?on=20261020&search=A+%26+B',
      '/api/employee/app/claims?page=2', '/api/employee/app/claims',
    ]);
  });
  it('sends a stable draft creation key in a header', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    vi.stubGlobal('fetch', fetchMock);
    await api('/api/employee/app/claims', { method: 'POST', token: 'private-token',
      idempotencyKey: 'stable-creation-key', body: { hospitalName: 'Synthetic Hospital' } });
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('stable-creation-key');
    expect(fetchMock.mock.calls[0][0]).not.toContain('stable-creation-key');
  });
  it('preserves the server error message and HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Expired sign-in' }), { status: 401 })));
    await expect(api('/api/employee/app/overview')).rejects.toMatchObject({ message: 'Expired sign-in', status: 401 });
  });
  it('aborts requests after a finite timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const failure = expect(api('/api/employee/app/overview')).rejects.toThrow('too long');
    await vi.advanceTimersByTimeAsync(15_000);
    await failure;
  });
});

it('validates calendar dates without rolling invalid days into another month', () => {
  expect(dateLabel(20240229)).toBe('29 Feb 2024');
  for (const value of [20230229, 20241301, 20240431, 20240001, 20240100, 20240101.5, NaN, null, undefined]) {
    expect(dateLabel(value)).toBe('Not on file');
  }
  expect(rupees(123456)).toBe('₹1,23,456');
});
