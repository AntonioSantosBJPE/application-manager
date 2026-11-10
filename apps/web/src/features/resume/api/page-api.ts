import type { ResumeSection } from '@am/contracts';
import type { Outcome } from '../../../lib/bff';
import { createSkill, searchSkills } from '../../skills';
import type { ResumePageApi } from '../components/ResumePage';
import {
  createBullet,
  createResumeItem,
  deleteBullet,
  deleteResumeItem,
  getResume,
  saveProfile,
  updateBullet,
  updateResumeItem,
  type ItemOf,
} from './server-functions';

/** The page's api bound to the server functions, as the browser calls them; module level, so it is the same on every render. */
export const resumePageApi: ResumePageApi = {
  load: () => getResume(),
  saveProfile: (body) => saveProfile({ data: body }),
  createItem: (section, body) =>
    createResumeItem({ data: { section, body } }) as Promise<Outcome<ItemOf[typeof section & ResumeSection]>>,
  updateItem: (section, id, body) =>
    updateResumeItem({ data: { section, id, body } }) as Promise<Outcome<ItemOf[typeof section & ResumeSection]>>,
  deleteItem: (section, id) => deleteResumeItem({ data: { section, id } }),
  createBullet: (section, id, body) => createBullet({ data: { section, id, body } }),
  updateBullet: (section, id, bulletId, body) => updateBullet({ data: { section, id, bulletId, body } }),
  deleteBullet: (section, id, bulletId) => deleteBullet({ data: { section, id, bulletId } }),
  skills: {
    search: (q) => searchSkills({ data: { q } }),
    create: (body) => createSkill({ data: body }),
  },
};
