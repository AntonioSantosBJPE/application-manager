// Module boundaries checked by `pnpm lint:boundaries` (GUARD-06..08).
// The `err` reporter prints `error <rule>: <file> → <import>` for each violation.
// SPEC_DEVIATION: the design runs `depcruise apps packages`; the script runs `depcruise .`
// and `includeOnly` limits the graph to apps/ and packages/.
// Reason: depcruise exits 1 on a path that does not exist, and apps/ only appears in T11.
// Fixtures in tooling/guardrails/fixtures stay outside the real lint for the same reason.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-app',
      comment: 'An app never imports from another app (GUARD-06). Share code through packages/.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'no-feature-internals',
      comment: 'A web feature imports another feature only through its index.ts (GUARD-07).',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/',
        pathNot: ['^apps/web/src/features/$1/', '^apps/web/src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'no-module-internals',
      comment: 'An api module imports another module only through its index.ts (GUARD-08).',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/',
        pathNot: ['^apps/api/src/modules/$1/', '^apps/api/src/modules/[^/]+/index\\.ts$'],
      },
    },
  ],
  options: {
    includeOnly: '^(apps|packages)/',
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|storybook-static|coverage)/' },
  },
};
