import { describe, expect, it } from 'vitest';
import { clientIpOf } from './client-ip';

function request(headers: Record<string, string>, socketAddress: string | undefined) {
  const lowercased = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return {
    header: (name: string) => lowercased.get(name.toLowerCase()),
    socketAddress,
  };
}

describe('client ip forwarded to the api', () => {
  it('uses the configured header when the proxy fills it', () => {
    const ip = clientIpOf(request({ 'cf-connecting-ip': '198.51.100.9' }, '10.0.0.5'), 'CF-Connecting-IP');

    expect(ip).toBe('198.51.100.9');
  });

  it('uses the connection address when CLIENT_IP_HEADER is not set', () => {
    const ip = clientIpOf(request({ 'cf-connecting-ip': '198.51.100.9' }, '10.0.0.5'), undefined);

    expect(ip).toBe('10.0.0.5');
  });

  it('ignores the X-Forwarded-For the browser sent, with and without CLIENT_IP_HEADER', () => {
    const forged = request({ 'x-forwarded-for': '203.0.113.250', 'cf-connecting-ip': '198.51.100.9' }, '10.0.0.5');

    expect(clientIpOf(forged, 'cf-connecting-ip')).toBe('198.51.100.9');
    expect(clientIpOf(forged, undefined)).toBe('10.0.0.5');
  });

  it('falls back to the connection address when the configured header is empty', () => {
    const ip = clientIpOf(request({ 'cf-connecting-ip': '   ' }, '10.0.0.5'), 'cf-connecting-ip');

    expect(ip).toBe('10.0.0.5');
  });

  it('offers no address when neither the header nor the connection has one', () => {
    expect(clientIpOf(request({}, undefined), 'cf-connecting-ip')).toBeUndefined();
    expect(clientIpOf(request({}, ''), undefined)).toBeUndefined();
  });
});
