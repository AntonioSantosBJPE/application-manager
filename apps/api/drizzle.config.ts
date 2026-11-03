import { defineConfig } from 'drizzle-kit';

// Migrations are SQL files in ./drizzle; `drizzle-kit generate` writes them, `migrate` applies them.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/database/schema.ts',
  out: './drizzle',
});
