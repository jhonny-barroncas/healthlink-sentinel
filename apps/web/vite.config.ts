import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const keyPath = resolve(process.cwd(), '.certs/localhost-key.pem');
const certPath = resolve(process.cwd(), '.certs/localhost.pem');
const localHttps = existsSync(keyPath) && existsSync(certPath);

export default defineConfig({
  plugins: [react()],
  ...(localHttps ? { server: { https: { key: readFileSync(keyPath), cert: readFileSync(certPath) } } } : {}),
});
