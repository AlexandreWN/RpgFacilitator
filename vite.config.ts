import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.RPG_API_PORT ?? 3001}` },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
