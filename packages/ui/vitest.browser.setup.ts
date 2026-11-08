/// <reference types="vite/client" />
// The browser project renders with the design tokens, as the app and the Storybook do.
import './src/styles/tokens.css';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { page, userEvent } from 'vitest/browser';

/**
 * Each test starts with the pointer in the bottom-right corner of the viewport, away from what it
 * renders. Otherwise the pointer stays where the previous test left it, and a control drawn under it
 * shows its hover colors instead of the ones at rest.
 */
beforeEach(async () => {
  const corner = document.createElement('div');
  corner.dataset.testid = 'pointer-rest';
  corner.style.cssText = 'position:fixed;right:0;bottom:0;width:4px;height:4px';
  document.body.append(corner);
  await userEvent.hover(page.getByTestId('pointer-rest'));
  corner.remove();
});

afterEach(cleanup);
