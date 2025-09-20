import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Set base to the repository name so built assets resolve correctly on GitHub Pages.
  // Replace `IshaanSoni0/frcScoutingApp` if your GitHub repo has a different name.
  base: '/frcScoutingApp/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
