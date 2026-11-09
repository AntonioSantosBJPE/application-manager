import type { PostingSkill } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { rowSkills } from './row-skills';

const skill = (n: number, requirement: PostingSkill['requirement']): PostingSkill => ({
  id: `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`,
  name: `Skill Fictícia ${n}`,
  scope: 'global',
  requirement,
});

describe('rowSkills', () => {
  it('APP-44 takes the first two required skills in the order received, even with nice to have ones before them', () => {
    const skills = [skill(1, 'nice_to_have'), skill(2, 'required'), skill(3, 'required'), skill(4, 'required')];
    expect(rowSkills(skills).map((item) => item.name)).toEqual(['Skill Fictícia 2', 'Skill Fictícia 3']);
  });

  it('APP-44 takes the first two nice to have skills when there is no required one', () => {
    const skills = [skill(1, 'nice_to_have'), skill(2, 'nice_to_have'), skill(3, 'nice_to_have')];
    expect(rowSkills(skills).map((item) => item.name)).toEqual(['Skill Fictícia 1', 'Skill Fictícia 2']);
  });

  it('APP-44 shows the single required skill alone, without filling the second place with a nice to have one', () => {
    const skills = [skill(1, 'nice_to_have'), skill(2, 'required')];
    expect(rowSkills(skills).map((item) => item.name)).toEqual(['Skill Fictícia 2']);
  });

  it('APP-44 shows nothing for a posting with no skills', () => {
    expect(rowSkills([])).toEqual([]);
  });
});
