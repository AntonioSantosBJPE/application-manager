import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './components/empty-state';
import { Kbd } from './components/kbd';
import { PipelineStatus } from './components/pipeline-status';
import { SkillTag } from './components/skill-tag';
import { DetailPage } from './layouts/detail-page';
import { FormPage } from './layouts/form-page';

/** Every attribute a screen reader or a tooltip would turn into words. */
const wordAttributes = ['aria-label', 'aria-description', 'title', 'alt', 'placeholder'];

function words(container: HTMLElement): string[] {
  return [container, ...container.querySelectorAll<HTMLElement>('*')].flatMap((element) =>
    wordAttributes.flatMap((name) => element.getAttribute(name) ?? []),
  );
}

describe('the components of the future phases ship no product copy (PRU-07 AC11)', () => {
  it('PRU-07 AC11 renders no text and no label when the caller passes none', () => {
    const { container } = render(
      <div>
        <Kbd />
        <EmptyState.Root>
          <EmptyState.Action />
        </EmptyState.Root>
        <PipelineStatus status="accepted" label="" />
        <PipelineStatus status="rejected" label="" iconOnly />
        <SkillTag variant="required">{''}</SkillTag>
        <SkillTag variant="nice" onRemove={() => {}} removeLabel="">
          {''}
        </SkillTag>
        <DetailPage.Root>
          <DetailPage.Main />
          <DetailPage.Sidebar aria-label="">
            <DetailPage.Properties>
              <DetailPage.Property name="">{''}</DetailPage.Property>
            </DetailPage.Properties>
          </DetailPage.Sidebar>
        </DetailPage.Root>
        <FormPage.Root>
          <FormPage.Index aria-label="" />
          <FormPage.Content>
            <FormPage.Section title="" />
          </FormPage.Content>
          <FormPage.Actions />
        </FormPage.Root>
      </div>,
    );

    expect(container.textContent).toBe('');
    expect(words(container).filter((word) => word !== '')).toEqual([]);
  });

  it('PRU-07 AC11 renders exactly the text and the labels the caller passes, in every component', () => {
    const { container } = render(
      <div>
        <Kbd>k1</Kbd>
        <EmptyState.Root>
          <p>e1</p>
          <EmptyState.Action>e2</EmptyState.Action>
        </EmptyState.Root>
        <PipelineStatus status="saved" label="p1" />
        <PipelineStatus status="ghosted" label="p2" iconOnly />
        <SkillTag variant="private" onRemove={() => {}} removeLabel="s2">
          s1
        </SkillTag>
        <SkillTag variant="match">s3</SkillTag>
        <DetailPage.Root>
          <DetailPage.Main>d1</DetailPage.Main>
          <DetailPage.Sidebar aria-label="d2">
            <DetailPage.Properties>
              <DetailPage.Property name="d3">d4</DetailPage.Property>
            </DetailPage.Properties>
          </DetailPage.Sidebar>
        </DetailPage.Root>
        <FormPage.Root>
          <FormPage.Index aria-label="f1">f2</FormPage.Index>
          <FormPage.Content>
            <FormPage.Section title="f3" actions="f4">
              f5
            </FormPage.Section>
          </FormPage.Content>
          <FormPage.Actions>f6</FormPage.Actions>
        </FormPage.Root>
      </div>,
    );

    // The only text on the screen is the text passed in, in order; "·" is the glyph of a private skill.
    expect(container.textContent).toBe('k1e1e2p1s1·s3d1d3d4f2f3f4f5f6');
    expect(words(container).sort()).toEqual(['d2', 'f1', 'p2', 's2']);
  });
});
