import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    // Use relative paths so the app works on any subdirectory (e.g. GitHub Pages)
    base: './', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    }
  };
});