import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['amber.jiujianian-dev-world.win'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
