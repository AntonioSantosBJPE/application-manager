// Root Drizzle schema: drizzle-kit reads this file to generate the migrations.
// Each module owns a Postgres schema; this file only re-exports the tables of every module.
export * from '../../modules/identity/infra/schema.js';
export * from '../../modules/skills/infra/schema.js';
export * from '../../modules/applications/infra/schema.js';
export * from '../../modules/resume/infra/schema.js';
