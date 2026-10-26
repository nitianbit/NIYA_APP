import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_API_BASE_URL?.trim() || '';
  const development = command === 'serve' || mode === 'development' || mode === 'test';
  let apiOrigin = '';
  if (apiBase) {
    const url = new URL(apiBase);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('VITE_API_BASE_URL must be an origin without credentials or a path.');
    }
    const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(development && local && url.protocol === 'http:')) {
      throw new Error('VITE_API_BASE_URL must use HTTPS outside local development.');
    }
    apiOrigin = url.origin;
  } else if (!development) {
    throw new Error('Set VITE_API_BASE_URL to the HTTPS backend origin before building for release.');
  }
  const connect = ["'self'", apiOrigin, ...(command === 'serve' ? ['ws://127.0.0.1:*', 'ws://localhost:*'] : [])]
    .filter(Boolean).join(' ');
  const policy = [
    "default-src 'self'",
    `script-src 'self'${command === 'serve' ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join('; ');
  return {
    base: './',
    plugins: [react(), {
      name: 'niya-content-security-policy',
      transformIndexHtml() {
        return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
      },
    }],
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
      headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  };
});
