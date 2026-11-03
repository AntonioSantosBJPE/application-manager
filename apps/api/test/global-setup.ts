import type { TestProject } from 'vitest/node';
import { startPostgres } from './postgres.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    databaseContainerId: string;
  }
}

/** One PostgreSQL 18 container for the integration run (GUARD-04), removed at the end. */
export default async function setup(project: TestProject) {
  const container = await startPostgres();
  project.provide('databaseUrl', container.getConnectionUri());
  project.provide('databaseContainerId', container.getId());
  return async () => {
    await container.stop();
  };
}
