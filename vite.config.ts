import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // IMPORTANT: Replace 'nexus-pos' with your actual GitHub repository name if different
    base: '/nexus-pos/', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    }
  };
});