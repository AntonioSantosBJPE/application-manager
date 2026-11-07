// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoAccessScreen, UnavailableScreen } from './AccessScreens';

describe('NoAccessScreen', () => {
  it('says the member has no access and links to the home', () => {
    render(<NoAccessScreen />);

    expect(screen.getByRole('main')).toHaveTextContent('Você não tem acesso a esta área.');
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
  });
});

describe('UnavailableScreen', () => {
  it('says the service is unavailable without offering the login', () => {
    render(<UnavailableScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
