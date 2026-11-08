import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { Alert } from './alert';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('Alert in the browser', () => {
  it('PRU-02 AC06 fills danger, info and warning with their subtle tokens, in both themes', async () => {
    render(
      <div>
        <Alert intent="danger">E-mail ou senha incorretos.</Alert>
        <Alert intent="info">Este link só aparece desta vez.</Alert>
        <Alert intent="warning">Sem atividade há 21 dias.</Alert>
      </div>,
    );

    const fills = [
      { role: 'alert', name: 'E-mail ou senha incorretos.', token: 'danger-subtle' },
      { role: 'status', name: 'Este link só aparece desta vez.', token: 'info-subtle' },
      { role: 'status', name: 'Sem atividade há 21 dias.', token: 'warning-subtle' },
    ];
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const { name, token } of fills) {
        const alert = screen.getByText(name).parentElement!;
        await settle(alert);
        expect(getComputedStyle(alert).backgroundColor, `${token}, ${theme}`).toBe(
          tokenColor(token),
        );
        expect(getComputedStyle(alert).borderRadius, `radius-md, ${token}`).toBe('6px');
      }
    }
  });

  it('PRU-02 AC08 places the action at the right end of the alert', () => {
    render(
      <div style={{ width: 560 }}>
        <Alert
          intent="warning"
          action={
            <Button intent="secondary" size="sm">
              Marcar sem retorno
            </Button>
          }
        >
          Sem atividade há 21 dias.
        </Alert>
      </div>,
    );

    const alert = screen.getByRole('status').getBoundingClientRect();
    const action = screen.getByRole('button', { name: 'Marcar sem retorno' }).getBoundingClientRect();
    const message = screen.getByText('Sem atividade há 21 dias.').getBoundingClientRect();

    // Right end: only the border (1px) and the padding (space-3, 12px) after the action.
    expect(alert.right - action.right).toBe(13);
    expect(action.left).toBeGreaterThanOrEqual(message.right);
  });
});
