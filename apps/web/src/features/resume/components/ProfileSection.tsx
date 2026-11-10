import { saveProfileRequestSchema, type Profile, type SaveProfileRequest } from '@am/contracts';
import { Field } from '@am/ui';
import { useId } from 'react';
import type { Outcome } from '../../../lib/bff';
import { useAutosaveField } from '../hooks/use-autosave-field';
import { type ProfileApi, useProfileSave } from '../hooks/use-profile-save';
import { messageFor } from '../model/field-errors';
import { PROFILE_LABELS } from '../model/messages';
import { LinksField } from './LinksField';

export interface ProfileSectionProps {
  profile: Profile;
  api: ProfileApi;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

type TextField = 'fullName' | 'headline' | 'email' | 'phone' | 'location' | 'summary';

/** The value an empty optional field is saved as: no value, not an empty text. */
const OPTIONAL: readonly TextField[] = ['phone', 'location'];

/** One text field of the profile that saves when it is left (RES-44, RES-45, RES-47, RES-48). */
function ProfileTextField({
  name,
  profile,
  save,
  multiline = false,
}: {
  name: TextField;
  profile: Profile;
  save: ReturnType<typeof useProfileSave>;
  multiline?: boolean;
}) {
  const id = useId();
  const stored = (profile[name] ?? '') as string;
  const patchOf = (value: string): Partial<SaveProfileRequest> => ({
    [name]: OPTIONAL.includes(name) && value === '' ? null : value,
  });

  const field = useAutosaveField<string>({
    saved: stored,
    validate: (value) =>
      messageFor(saveProfileRequestSchema, { ...profile, ...patchOf(value.trim()) }, (path) => path[0] === name),
    save: (value) => save(patchOf(value)),
  });

  const leave = () => {
    const trimmed = field.value.trim();
    field.setValue(trimmed);
    void field.commit(trimmed);
  };
  const common = {
    id,
    value: field.value,
    onChange: (event: { target: { value: string } }) => field.setValue(event.target.value),
    onBlur: leave,
  };

  return (
    <Field.Root invalid={field.error !== null}>
      <Field.Label htmlFor={id}>{PROFILE_LABELS[name]}</Field.Label>
      {multiline ? <Field.Textarea {...common} rows={5} /> : <Field.Control {...common} />}
      <Field.Error>{field.error}</Field.Error>
    </Field.Root>
  );
}

/**
 * The Perfil section (RES-43): name, headline, e-mail, phone, place, links and summary, each saved when
 * it is left. All fields write the same profile, so `useProfileSave` keeps those writes in line.
 */
export function ProfileSection({ profile, api, onExpired }: ProfileSectionProps) {
  const save = useProfileSave(api, onExpired);
  return (
    <div className="flex flex-col gap-4">
      <ProfileTextField name="fullName" profile={profile} save={save} />
      <ProfileTextField name="headline" profile={profile} save={save} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProfileTextField name="email" profile={profile} save={save} />
        <ProfileTextField name="phone" profile={profile} save={save} />
      </div>
      <ProfileTextField name="location" profile={profile} save={save} />
      <LinksField profile={profile} save={save} />
      <ProfileTextField name="summary" profile={profile} save={save} multiline />
    </div>
  );
}
