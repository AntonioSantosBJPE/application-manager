import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `vite build` writes dist/client and dist/server; srvx serves them in production (AD-001).
export default defineConfig({
  server: { port: Number(process.env.PORT ?? 3000) },
  // The React plugin must come after the Start plugin.
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
