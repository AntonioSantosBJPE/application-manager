import { writeFileSync } from 'node:fs';
import { readSeedSkills } from './global-skills.js';
import { buildSeedSql, SEED_MIGRATION_PATH } from './seed-sql.js';

// Entrypoint of `pnpm --filter @am/api seed:generate`: rewrites the seed migration from the JSON list.
const skills = readSeedSkills();
writeFileSync(SEED_MIGRATION_PATH, buildSeedSql(skills));
