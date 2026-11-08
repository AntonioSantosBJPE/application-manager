/// <reference types="vite/client" />
// The browser project renders with the design tokens, as the app and the Storybook do.
import './src/styles/tokens.css';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
