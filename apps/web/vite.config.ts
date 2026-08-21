import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: readFileSync(resolve(process.cwd(), '.certs/localhost-key.pem')),
      cert: readFileSync(resolve(process.cwd(), '.certs/localhost.pem')),
    },
  },
});
