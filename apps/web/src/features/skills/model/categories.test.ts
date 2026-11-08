import { skillCategorySchema } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, CATEGORY_ORDER } from './categories';

describe('categories', () => {
  it('SKL-38 labels the seven categories as the PageSkills card does, with "Linguagem" alone (AD-015)', () => {
    expect(CATEGORY_LABELS).toEqual({
      language: 'Linguagem',
      framework: 'Framework',
      database: 'Banco de dados',
      cloud_devops: 'Cloud/DevOps',
      tool: 'Ferramenta',
      practice: 'Prática',
      soft_skill: 'Soft skill',
    });
  });

  it('SKL-38 orders the seven chips as the card does and misses no category of the contract', () => {
    expect(CATEGORY_ORDER.map((category) => CATEGORY_LABELS[category])).toEqual([
      'Linguagem',
      'Framework',
      'Banco de dados',
      'Cloud/DevOps',
      'Ferramenta',
      'Prática',
      'Soft skill',
    ]);
    expect([...CATEGORY_ORDER].sort()).toEqual([...skillCategorySchema.options].sort());
  });
});
