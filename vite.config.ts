import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    // Use the repo name only when building for production (GitHub Pages)
    // Otherwise use root '/' for local development
    base: command === 'build' ? '/nexus-pos/' : '/', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    }
  };
});