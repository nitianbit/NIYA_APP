import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearEcardCache } from './ecards';
import { api, type Overview } from './api';
import { readToken, removeToken, saveToken } from './storage';

type Session = {
  token: string | null;
  overview: Overview | null;
  error: string;
  loading: boolean;
  requestCode: (identifier: string) => Promise<number>;
  verifyCode: (identifier: string, code: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);
const message = (error: unknown): string => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const currentToken = useRef<string | null>(null);
  const refreshRequest = useRef<Promise<void> | null>(null);

  const clearMemory = useCallback(() => {
    generation.current += 1;
    const cleared = generation.current;
    void clearEcardCache().catch(() => { if (generation.current === cleared) setError(previous => `${previous ? previous + ' ' : ''}Could not clear the temporary e-card cache. Restart the app and try again.`); });
    currentToken.current = null;
    refreshRequest.current = null;
    setToken(null);
    setOverview(null);
    setLoading(false);
    return generation.current;
  }, []);

  const handleFailure = useCallback(async (failure: unknown, version: number) => {
    if (generation.current === version) {
      const status = (failure as { status?: number } | null)?.status;
      if (status === 401 || status === 403) {
        const cleared = clearMemory();
        setError(message(failure));
        try { await removeToken(); }
        catch {
          if (generation.current === cleared) setError(`${message(failure)} Saved sign-in could not be removed.`);
        }
      } else setError(message(failure));
    }
  }, [clearMemory]);

  const load = useCallback(async (saved: string, version: number) => {
    try {
      const result = await api<Overview>('/api/employee/app/overview', { token: saved });
      if (generation.current === version) {
        setOverview(result);
        setError('');
      }
    } catch (failure) {
      await handleFailure(failure, version);
      throw failure;
    }
  }, [handleFailure]);

  useEffect(() => {
    const version = ++generation.current;
    void (async () => {
      try {
        await clearEcardCache();
        const saved = await readToken();
        if (generation.current !== version) return;
        if (saved) {
          currentToken.current = saved;
          setToken(saved);
          await load(saved, version);
        }
      } catch (failure) {
        if (generation.current === version) setError(message(failure));
      } finally {
        if (generation.current === version) setLoading(false);
      }
    })();
    return () => { generation.current += 1; };
  }, [load]);

  const verifyCode = useCallback(async (identifier: string, code: string) => {
    const version = clearMemory();
    setError('');
    try {
      await removeToken();
      if (generation.current !== version) return;
      const result = await api<{ accessToken: string }>('/api/employee/app/auth/otp/verify', {
        method: 'POST', body: { identifier, code },
      });
      if (generation.current !== version) return;
      if (!result.accessToken || typeof result.accessToken !== 'string') throw new Error('NIYA returned an invalid sign-in response.');
      const data = await api<Overview>('/api/employee/app/overview', { token: result.accessToken });
      if (generation.current !== version) return;
      // Fail closed: native login is complete only after secure persistence succeeds.
      try { await saveToken(result.accessToken); }
      catch (failure) { throw new Error('Could not save your sign-in securely. Please try again.', { cause: failure }); }
      if (generation.current !== version) return;
      currentToken.current = result.accessToken;
      setToken(result.accessToken);
      setOverview(data);
    } catch (failure) {
      if (generation.current !== version) return;
      let text = message(failure);
      try { await removeToken(); }
      catch { text += ' Saved sign-in could not be removed.'; }
      if (generation.current !== version) return;
      setError(text);
      throw new Error(text, { cause: failure });
    }
  }, [clearMemory]);

  const refresh = useCallback((): Promise<void> => {
    if (!currentToken.current) return Promise.resolve();
    if (refreshRequest.current) return refreshRequest.current;
    const request = load(currentToken.current, generation.current).finally(() => {
      if (refreshRequest.current === request) refreshRequest.current = null;
    });
    refreshRequest.current = request;
    return request;
  }, [load]);

  const signOut = useCallback(async () => {
    const version = clearMemory();
    setError('');
    try { await removeToken(); }
    catch {
      if (generation.current === version) setError('Signed out for now, but saved sign-in could not be removed. Sign-out may not survive restarting the app.');
    }
  }, [clearMemory]);

  const requestCode = useCallback(async (identifier: string): Promise<number> => {
    const version = generation.current;
    try {
      const response = await api<{ cooldownSeconds: number }>('/api/employee/app/auth/otp/request', {
        method: 'POST', body: { identifier },
      });
      if (generation.current === version) setError('');
      return response.cooldownSeconds;
    } catch (failure) {
      await handleFailure(failure, version);
      throw failure;
    }
  }, [handleFailure]);

  const value = useMemo<Session>(() => ({
    token, overview, loading, error, verifyCode, refresh, signOut, requestCode,
  }), [token, overview, loading, error, verifyCode, refresh, signOut, requestCode]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}
