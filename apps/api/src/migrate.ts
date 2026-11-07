import { fileURLToPath } from 'node:url';
import { loadDatabaseEnv, type DatabaseEnv } from './config/env.js';
import { runMigrations } from './infra/database/migrations.js';

// Entrypoint of the `migrate` service: exits 0 when every migration is applied, 1 otherwise.
// Only the database variables are read: `WEB_PUBLIC_URL` belongs to the API and does not exist here.
let env: DatabaseEnv;
try {
  env = loadDatabaseEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

try {
  await runMigrations({
    databaseUrl: env.databaseUrl,
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  });
  console.log('Migrations applied');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause) console.error(error.cause);
  process.exit(1);
}
