import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CopyField } from './copy-field';

const invitationUrl = 'https://app.example.com/invite/abc123';

function renderField(status: 'idle' | 'copied' | 'failed' = 'idle') {
  const onCopy = vi.fn();
  render(
    <CopyField
      value={invitationUrl}
      onCopy={onCopy}
      status={status}
      copyLabel="Copiar"
      copiedLabel="Copiado"
      failureMessage="Não foi possível copiar. Selecione o link."
      valueLabel="Link do convite"
    />,
  );
  return { onCopy };
}

describe('CopyField', () => {
  it('shows the value selectable and copies it on the action', () => {
    const { onCopy } = renderField();

    const value = screen.getByLabelText('Link do convite');
    expect(value).toHaveValue(invitationUrl);
    expect(value).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('selects the whole value when it receives focus', () => {
    renderField();

    const value = screen.getByLabelText('Link do convite') as HTMLInputElement;
    fireEvent.focus(value);

    expect(value.selectionStart).toBe(0);
    expect(value.selectionEnd).toBe(invitationUrl.length);
  });

  it('shows Copiado after the caller reports success', () => {
    renderField('copied');

    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the value selectable and shows the message when the copy fails', () => {
    renderField('failed');

    expect(screen.getByLabelText('Link do convite')).toHaveValue(invitationUrl);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível copiar. Selecione o link.',
    );
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
  });
});

describe('CopyField in the Prumo', () => {
  it('PRU-02 AC13 shows the value in font-mono on surface-raised and selects it all when Tab reaches it', async () => {
    const user = userEvent.setup();
    renderField();

    const value = screen.getByLabelText<HTMLTextAreaElement>('Link do convite');
    expect(value).toHaveClass('font-mono', 'bg-surface-raised');

    await user.tab();

    expect(value).toHaveFocus();
    expect([value.selectionStart, value.selectionEnd]).toEqual([0, invitationUrl.length]);
  });

  it('PRU-02 AC14 shows copiedLabel with the check icon once the caller reports the copy', () => {
    renderField('copied');

    const button = screen.getByRole('button', { name: 'Copiado' });
    expect(button.querySelector('svg')).toHaveClass('lucide-check');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('PRU-02 AC14 shows no check icon before the copy', () => {
    renderField();

    expect(screen.getByRole('button', { name: 'Copiar' }).querySelector('svg')).toBeNull();
  });

  it('PRU-02 AC15 shows the danger Alert below the field on failure and keeps the value selectable', async () => {
    const user = userEvent.setup();
    renderField('failed');

    const value = screen.getByLabelText<HTMLTextAreaElement>('Link do convite');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível copiar. Selecione o link.');
    expect(alert).toHaveClass('bg-danger-subtle', 'text-danger');
    expect(
      value.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.tab();

    expect(value).toHaveFocus();
    expect(value).toHaveAttribute('readonly');
    expect([value.selectionStart, value.selectionEnd]).toEqual([0, invitationUrl.length]);
  });
});
