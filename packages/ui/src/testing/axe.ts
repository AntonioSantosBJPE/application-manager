import axe from 'axe-core';

/** A component test has no page around it, so the landmark rule has nothing to judge. */
const PAGE_LEVEL_RULES = { region: { enabled: false } };

/**
 * Runs axe-core on a rendered subtree in the real browser and returns the violations as readable
 * lines, so a test fails with the rule and the element instead of a bare count (SKL-52).
 */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const { violations } = await axe.run(root, { rules: PAGE_LEVEL_RULES });
  return violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  );
}
