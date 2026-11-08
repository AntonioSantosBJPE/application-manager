import { describe, expect, it } from 'vitest';
import { ghostMessage } from './ghost-message';

describe('ghostMessage', () => {
  it('APP-80 says "desde o envio" in Enviada', () => {
    expect(ghostMessage('applied', 23)).toBe('23 dias sem atividade desde o envio. Marcar como sem retorno?');
  });

  it('APP-80 does not say "desde o envio" in Em entrevistas', () => {
    expect(ghostMessage('interviewing', 21)).toBe('21 dias sem atividade. Marcar como sem retorno?');
  });

  it('APP-80 has no text for a status the api never suggests for', () => {
    expect(ghostMessage('saved', 30)).toBeUndefined();
    expect(ghostMessage('offer', 30)).toBeUndefined();
    expect(ghostMessage('ghosted', 30)).toBeUndefined();
  });
});
