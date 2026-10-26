import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.niyacovr.employee',
  appName: 'NIYA',
  webDir: 'dist',
  backgroundColor: '#F8FAF9',
  loggingBehavior: 'debug',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
