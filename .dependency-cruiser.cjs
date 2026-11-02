// Module boundaries checked by `pnpm lint:boundaries` (GUARD-06..08).
// SPEC_DEVIATION: the design runs `depcruise apps packages`; the script runs `depcruise .`
// and `includeOnly` limits the graph to apps/ and packages/.
// Reason: depcruise exits 1 on a path that does not exist, and apps/ only appears in T11.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [],
  options: {
    includeOnly: '^(apps|packages)/',
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|storybook-static|coverage)/' },
  },
};
