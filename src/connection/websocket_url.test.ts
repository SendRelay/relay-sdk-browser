import { describe, expect, it } from 'vitest';
import { buildRelayWebSocketUrl } from './websocket_url';

describe('buildRelayWebSocketUrl', () => {
  it('normalizes https scheme, drops :0, and removes fragment', () => {
    const url = buildRelayWebSocketUrl({
      token: 'jwt-token',
      baseUrl: 'https://api.sendrelay.com.ng',
    });

    expect(url).toBe('https://api.sendrelay.com.ng/v1/realtime/ws?token=jwt-token&type=APP');
  });

  it('preserves explicit API path/stage', () => {
    const url = buildRelayWebSocketUrl({
      token: 'jwt-token',
      baseUrl: 'https://api.sendrelay.com.ng/v1/realtime/ws',
    });

    expect(url).toBe('https://api.sendrelay.com.ng/v1/realtime/ws?token=jwt-token&type=APP');
  });

  it('accepts host-only URL and adds default scheme/path', () => {
    const url = buildRelayWebSocketUrl({
      token: 'jwt-token',
      baseUrl: 'api.sendrelay.com.ng',
    });

    expect(url).toBe('https://api.sendrelay.com.ng/v1/realtime/ws?token=jwt-token&type=APP');
  });

  it('encodes query parameters safely', () => {
    const url = buildRelayWebSocketUrl({
      token: 'a+b/c==',
      baseUrl: 'https://api.sendrelay.com.ng/v1/realtime/ws',
      deviceId: 'device id/1',
    });

    expect(url).toBe(
      'https://api.sendrelay.com.ng/v1/realtime/ws?token=a%2Bb%2Fc%3D%3D&type=APP&deviceId=device+id%2F1',
    );
  });
});
