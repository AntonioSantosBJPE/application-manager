import { fireEvent, render, screen } from '@testing-library/react';
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
