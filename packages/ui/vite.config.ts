import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Shared by Storybook and by the Vitest projects (`extends: true`).
export default defineConfig({
  plugins: [tailwindcss()],
});
