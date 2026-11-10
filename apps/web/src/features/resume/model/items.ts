import type { Certification, Education, Experience, Language, Project } from '@am/contracts';

/** An item as the cache `['resume']` holds it: experiences and projects with their bullets. */
export interface CachedItemOf {
  experiences: Experience;
  projects: Project;
  educations: Education;
  certifications: Certification;
  languages: Language;
}
