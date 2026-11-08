import axe from 'axe-core';

/**
 * Runs axe-core on a rendered subtree in the real browser and returns the violations as readable
 * lines, so a test fails with the rule and the element instead of a bare count (SKL-52).
 */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const { violations } = await axe.run(root);
  return violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  );
}
