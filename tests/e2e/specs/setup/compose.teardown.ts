import { test } from '@playwright/test';
import { composeOk } from '../../support/compose.js';

test.describe('compose', () => {
  test('is removed with its volumes after the run', () => {
    composeOk(['down', '--volumes', '--remove-orphans']);
  });
});
