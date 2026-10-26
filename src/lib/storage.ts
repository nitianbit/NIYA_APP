import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

const TOKEN_KEY = 'employee_token';
let initialized = false;
let pending = Promise.resolve();

function nativeStorage<T>(operation: () => Promise<T>, webValue: T): Promise<T> {
  // The plugin's web fallback is plaintext localStorage; browser sessions stay in memory.
  if (!Capacitor.isNativePlatform()) return Promise.resolve(webValue);
  const result = pending.then(async () => {
    if (!initialized) {
      await SecureStorage.setKeyPrefix('niya-auth_');
      await SecureStorage.setSynchronize(false);
      await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
      initialized = true;
    }
    return operation();
  });
  // Serialize writes/removals so a pending login cannot persist after sign-out.
  pending = result.then(() => {}, () => {});
  return result;
}

export const readToken = (): Promise<string | null> => nativeStorage(() => SecureStorage.getItem(TOKEN_KEY), null);
export const saveToken = (token: string): Promise<void> => nativeStorage(() => SecureStorage.setItem(TOKEN_KEY, token), undefined);
export const removeToken = (): Promise<void> => nativeStorage(() => SecureStorage.removeItem(TOKEN_KEY), undefined);
