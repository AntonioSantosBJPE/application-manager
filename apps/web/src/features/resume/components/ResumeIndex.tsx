import type { MasterResume } from '@am/contracts';
import { Alert, FormPage } from '@am/ui';
import { TriangleAlert } from 'lucide-react';
import type { MouseEvent } from 'react';
import { bulletsWithoutSkill, missingSkillMessage, sectionCounts } from '../model/counts';
import { RESUME_MESSAGES } from '../model/messages';
import { PAGE_SECTIONS, SECTION_LABELS, sectionHref, type PageSection } from '../model/sections';

export interface ResumeIndexProps {
  resume: MasterResume;
  /** The section the page shows, marked in the index (RES-35). */
  section: PageSection;
  onSelect: (section: PageSection) => void;
}

/** A plain click is the page's to handle; a click with a modifier keeps the browser's own (new tab, new window). */
const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * The index of the page: a link per section with its number of items in `mono`, none for an empty section,
 * and, under them, the warning of the bullets that name no skill (RES-35, RES-37, RES-38). Both numbers are
 * counted on the resume the page already holds.
 */
export function ResumeIndex({ resume, section, onSelect }: ResumeIndexProps) {
  const counts = sectionCounts(resume);
  const missing = missingSkillMessage(bulletsWithoutSkill(resume));

  return (
    <FormPage.Index aria-label={RESUME_MESSAGES.indexLabel}>
      {PAGE_SECTIONS.map((target) => (
        <FormPage.IndexLink
          key={target}
          href={sectionHref(target)}
          current={target === section}
          count={counts[target]}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onSelect(target);
          }}
        >
          {SECTION_LABELS[target]}
        </FormPage.IndexLink>
      ))}
      {missing === null ? null : (
        <Alert intent="warning" icon={TriangleAlert} className="mt-3 text-caption">
          {missing}
        </Alert>
      )}
    </FormPage.Index>
  );
}
