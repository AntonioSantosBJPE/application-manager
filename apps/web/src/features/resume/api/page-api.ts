import type { ResumeSection } from '@am/contracts';
import type { Outcome } from '../../../lib/bff';
import type { ResumePageApi } from '../components/ResumePage';
import { createResumeItem, getResume, saveProfile, updateResumeItem, type ItemOf } from './server-functions';

/** The page's api bound to the server functions, as the browser calls them; module level, so it is the same on every render. */
export const resumePageApi: ResumePageApi = {
  load: () => getResume(),
  saveProfile: (body) => saveProfile({ data: body }),
  createItem: (section, body) =>
    createResumeItem({ data: { section, body } }) as Promise<Outcome<ItemOf[typeof section & ResumeSection]>>,
  updateItem: (section, id, body) =>
    updateResumeItem({ data: { section, id, body } }) as Promise<Outcome<ItemOf[typeof section & ResumeSection]>>,
};
