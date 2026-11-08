import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloudOff, Link2Off } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { Alert } from './alert';

describe('Alert', () => {
  it('announces a danger alert as an error with the danger token', () => {
    render(<Alert intent="danger">E-mail ou senha incorretos.</Alert>);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
    expect(alert).toHaveClass('border-danger', 'text-danger');
    expect(alert).not.toHaveClass('bg-surface-raised');
  });

  it('announces an info alert politely with the surface token', () => {
    render(<Alert intent="info">O link aparece uma única vez.</Alert>);

    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent('O link aparece uma única vez.');
    expect(alert).toHaveClass('border-border', 'bg-surface-raised', 'text-text');
    expect(alert).not.toHaveClass('text-danger');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Alert in the Prumo', () => {
  it('PRU-02 AC06 leads each intent with its own icon and fills danger and warning with their subtle token', () => {
    render(
      <>
        <Alert intent="danger">Não foi possível carregar os convites.</Alert>
        <Alert intent="info">Sua sessão expirou. Entre de novo para continuar.</Alert>
        <Alert intent="warning">Sem atividade há 21 dias.</Alert>
      </>,
    );

    const danger = screen.getByText('Não foi possível carregar os convites.').closest('[role]')!;
    const info = screen.getByText('Sua sessão expirou. Entre de novo para continuar.').closest('[role]')!;
    const warning = screen.getByText('Sem atividade há 21 dias.').closest('[role]')!;

    expect(danger.querySelector('svg')).toHaveClass('lucide-circle-alert');
    expect(info.querySelector('svg')).toHaveClass('lucide-info');
    expect(warning.querySelector('svg')).toHaveClass('lucide-clock');
    for (const alert of [danger, info, warning]) {
      expect(alert.querySelectorAll('svg')).toHaveLength(1);
      expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    expect(danger).toHaveClass('bg-danger-subtle', 'text-danger');
    expect(warning).toHaveClass('bg-warning-subtle', 'text-warning');
  });

  it('PRU-02 AC07 gives danger role alert and info and warning role status', () => {
    render(
      <>
        <Alert intent="danger">E-mail ou senha incorretos.</Alert>
        <Alert intent="info">Este link só aparece desta vez.</Alert>
        <Alert intent="warning">Sem atividade há 21 dias.</Alert>
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual([
      'Este link só aparece desta vez.',
      'Sem atividade há 21 dias.',
    ]);
  });

  it('PRU-02 AC08 shows the action after the message, inside the alert, and runs it on click', async () => {
    const onMark = vi.fn();
    render(
      <Alert
        intent="warning"
        action={
          <Button intent="secondary" size="sm" onClick={onMark}>
            Marcar sem retorno
          </Button>
        }
      >
        Sem atividade há 21 dias.
      </Alert>,
    );

    const alert = screen.getByRole('status');
    const action = screen.getByRole('button', { name: 'Marcar sem retorno' });
    expect(alert).toContainElement(action);
    // The action comes after the message in the reading order, at the end of the row.
    expect(alert.lastElementChild).toContainElement(action);
    expect(
      screen.getByText('Sem atividade há 21 dias.').compareDocumentPosition(action) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await userEvent.setup().click(action);

    expect(onMark).toHaveBeenCalledTimes(1);
  });

  it('PRU-02 AC08 renders no action area when no action is passed', () => {
    render(<Alert intent="info">Este link só aparece desta vez.</Alert>);

    expect(screen.getByRole('status').children).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('PRU-02 AC06 swaps the icon of the intent for the one the caller passes, keeping the intent', () => {
    render(
      <>
        <Alert intent="danger" icon={Link2Off}>
          Este convite expirou ou já foi usado.
        </Alert>
        <Alert intent="info" icon={CloudOff}>
          O serviço não respondeu.
        </Alert>
      </>,
    );

    const danger = screen.getByRole('alert');
    const info = screen.getByRole('status');
    expect(danger.querySelectorAll('svg')).toHaveLength(1);
    expect(danger.querySelector('svg')).toHaveClass('lucide-link-2-off');
    expect(danger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(danger.querySelector('svg')).toHaveAttribute('width', '16');
    expect(danger).toHaveClass('bg-danger-subtle', 'text-danger');
    expect(info.querySelector('svg')).toHaveClass('lucide-cloud-off', 'text-text-muted');
  });
});
