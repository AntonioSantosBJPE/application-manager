import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { getContainerRuntimeClient } from 'testcontainers';

/** The same major as production (PostgreSQL 18, required by `uuidv7()`), pinned to a minor. */
export const postgresImage = 'postgres:18.6-alpine';

export function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(postgresImage).start();
}

/** Docker handle for pause/unpause/inspect, which the Testcontainers wrapper does not expose. */
export async function dockerContainer(id: string) {
  const client = await getContainerRuntimeClient();
  return client.container.getById(id);
}
