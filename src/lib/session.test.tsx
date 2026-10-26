import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, type Overview } from './api';
import { SessionProvider, useSession } from './session';

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  storage: {
    setKeyPrefix: vi.fn(), setSynchronize: vi.fn(), setDefaultKeychainAccess: vi.fn(),
    getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(),
  },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: mocks.storage, KeychainAccess: { whenUnlockedThisDeviceOnly: 1 },
}));
vi.mock('./api', () => ({ api: vi.fn() }));

const mockedApi = vi.mocked(api);
const overview: Overview = {
  profile: {
    id: 'a', fullName: 'Employee A', employeeCode: 'NIYA-1', email: 'a@example.test',
    phone: '9000000000', gender: '', dateOfBirth: null, department: '', dateOfJoining: null,
    corporateName: 'Example',
  },
  family: [], covers: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function session() {
  const result = renderHook(() => useSession(), { wrapper: SessionProvider });
  await waitFor(() => expect(result.result.current.loading).toBe(false));
  return result;
}

async function login(result: { current: ReturnType<typeof useSession> }, token = 'token-a', data = overview) {
  mockedApi.mockResolvedValueOnce({ accessToken: token }).mockResolvedValueOnce(data);
  await act(async () => { await result.current.verifyCode('employee@example.test', '123456'); });
}

beforeEach(() => {
  mockedApi.mockReset();
  mocks.native.mockReturnValue(false);
  for (const operation of Object.values(mocks.storage)) operation.mockReset().mockResolvedValue(undefined);
  mocks.storage.getItem.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps browser sessions in memory and never calls persistent storage', async () => {
  const getItem = vi.spyOn(Storage.prototype, 'getItem');
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
  const first = await session();
  await login(first.result);
  expect(first.result.current.token).toBe('token-a');
  first.unmount();
  const next = await session();
  expect(next.result.current.token).toBeNull();
  for (const operation of Object.values(mocks.storage)) expect(operation).not.toHaveBeenCalled();
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
  expect(removeItem).not.toHaveBeenCalled();
});

it('restores native sessions with device-only keychain storage', async () => {
  mocks.native.mockReturnValue(true);
  mocks.storage.getItem.mockResolvedValue('native-token');
  mockedApi.mockResolvedValueOnce(overview);
  const hook = await session();
  expect(hook.result.current.token).toBe('native-token');
  expect(hook.result.current.overview).toEqual(overview);
  expect(mocks.storage.setKeyPrefix).toHaveBeenCalledWith('niya-auth_');
  expect(mocks.storage.setSynchronize).toHaveBeenCalledWith(false);
  expect(mocks.storage.setDefaultKeychainAccess).toHaveBeenCalledWith(1);
});

it.each([401, 403])('clears native token, data, and saved credentials on HTTP %s', async (status) => {
  mocks.native.mockReturnValue(true);
  const hook = await session();
  await login(hook.result);
  mocks.storage.removeItem.mockClear();
  mockedApi.mockRejectedValueOnce(Object.assign(new Error('Sign-in expired'), { status }));
  await act(async () => { await expect(hook.result.current.refresh()).rejects.toThrow('Sign-in expired'); });
  expect(hook.result.current.token).toBeNull();
  expect(hook.result.current.overview).toBeNull();
  expect(mocks.storage.removeItem).toHaveBeenCalledWith('employee_token');
  expect(hook.result.current.error).toBe('Sign-in expired');
});

it('ignores an overview response arriving after sign-out', async () => {
  const hook = await session();
  await login(hook.result);
  const old = deferred<Overview>();
  mockedApi.mockReturnValueOnce(old.promise);
  let refresh!: Promise<void>;
  act(() => { refresh = hook.result.current.refresh(); });
  await act(async () => { await hook.result.current.signOut(); });
  await act(async () => { old.resolve(overview); await refresh; });
  expect(hook.result.current.token).toBeNull();
  expect(hook.result.current.overview).toBeNull();
});

it('ignores an earlier account response after switching accounts', async () => {
  const hook = await session();
  await login(hook.result);
  const old = deferred<Overview>();
  mockedApi.mockReturnValueOnce(old.promise);
  let refresh!: Promise<void>;
  act(() => { refresh = hook.result.current.refresh(); });
  const accountB = { ...overview, profile: { ...overview.profile, id: 'b', fullName: 'Employee B' } };
  await login(hook.result, 'token-b', accountB);
  await act(async () => { old.resolve(overview); await refresh; });
  expect(hook.result.current.token).toBe('token-b');
  expect(hook.result.current.overview?.profile.id).toBe('b');
});

it('shares one in-flight refresh instead of racing two requests', async () => {
  const hook = await session();
  await login(hook.result);
  mockedApi.mockClear();
  const pending = deferred<Overview>();
  mockedApi.mockReturnValueOnce(pending.promise);
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => { first = hook.result.current.refresh(); second = hook.result.current.refresh(); });
  expect(first).toBe(second);
  expect(mockedApi).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(overview); await first; });
});

it('clears memory and reports when native sign-out cannot remove saved credentials', async () => {
  mocks.native.mockReturnValue(true);
  const hook = await session();
  await login(hook.result);
  mocks.storage.removeItem.mockRejectedValueOnce(new Error('Keychain unavailable'));
  await act(async () => { await hook.result.current.signOut(); });
  expect(hook.result.current.token).toBeNull();
  expect(hook.result.current.overview).toBeNull();
  expect(hook.result.current.error).toContain('saved sign-in could not be removed');
});

it('fails native login closed on storage failure and permits a successful retry', async () => {
  mocks.native.mockReturnValue(true);
  const hook = await session();
  mocks.storage.setItem.mockRejectedValueOnce(new Error('Keychain unavailable'));
  mockedApi.mockResolvedValueOnce({ accessToken: 'token-a' }).mockResolvedValueOnce(overview);
  await act(async () => {
    await expect(hook.result.current.verifyCode('employee@example.test', '123456')).rejects.toThrow('Could not save your sign-in securely');
  });
  expect(hook.result.current.token).toBeNull();
  expect(hook.result.current.overview).toBeNull();
  await login(hook.result);
  expect(hook.result.current.token).toBe('token-a');
});

it('removes a pending native login write before sign-out finishes', async () => {
  mocks.native.mockReturnValue(true);
  const hook = await session();
  const saved = deferred<void>();
  mocks.storage.setItem.mockReturnValueOnce(saved.promise);
  mockedApi.mockResolvedValueOnce({ accessToken: 'token-a' }).mockResolvedValueOnce(overview);
  let signingIn!: Promise<void>;
  let signingOut!: Promise<void>;
  act(() => { signingIn = hook.result.current.verifyCode('employee@example.test', '123456'); });
  await waitFor(() => expect(mocks.storage.setItem).toHaveBeenCalled());
  act(() => { signingOut = hook.result.current.signOut(); });
  await act(async () => { saved.resolve(); await Promise.all([signingIn, signingOut]); });
  expect(hook.result.current.token).toBeNull();
  expect(hook.result.current.overview).toBeNull();
  expect(mocks.storage.removeItem).toHaveBeenCalledTimes(2);
});
