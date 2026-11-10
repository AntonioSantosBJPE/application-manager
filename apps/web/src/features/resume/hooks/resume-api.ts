import type { SkillsFieldApi } from '../../skills';
import type { BulletsApi } from './use-bullet-writes';
import type { ItemsApi } from './use-item-form';
import type { ProfileApi } from './use-profile-save';
import type { ReorderApi } from './use-reorder';

/**
 * Everything the page needs from the BFF, one function per use: the loader's read (also the read after a
 * refused order), the profile, the items, the bullets, the order and the skills of the field of a bullet.
 * The route binds the server functions; a test binds the api over MSW.
 */
export interface ResumeApi extends ProfileApi, ItemsApi, BulletsApi, ReorderApi {
  /** The search and the creation of skills, for the field of skills of a bullet. */
  skills: SkillsFieldApi;
}
