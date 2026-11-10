import type { MasterResume } from '@am/contracts';
import type { PageSection } from './sections';

/** The number of items in each section, for the index; the profile is one record, so it has none to count (RES-37). */
export function sectionCounts(resume: MasterResume): Record<PageSection, number> {
  return {
    profile: 0,
    experiences: resume.experiences.length,
    projects: resume.projects.length,
    educations: resume.educations.length,
    certifications: resume.certifications.length,
    languages: resume.languages.length,
  };
}

/** The bullets of experiences and projects that name no skill; they stay out of the relevance order (RES-38). */
export function bulletsWithoutSkill(resume: MasterResume): number {
  const bullets = [...resume.experiences, ...resume.projects].flatMap((item) => item.bullets);
  return bullets.filter((bullet) => bullet.skillIds.length === 0).length;
}

/** The warning of the index, or `null` when every bullet has a skill (RES-38). */
export function missingSkillMessage(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 bullet sem skill não entra na ordenação por relevância.'
    : `${count} bullets sem skill não entram na ordenação por relevância.`;
}
