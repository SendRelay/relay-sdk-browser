import { describe, expect, it } from 'vitest';
import { buildRelayWebSocketUrl } from './websocket_url';

describe('buildRelayWebSocketUrl', () => {
  it('converts https to wss, drops :0, and removes fragment', () => {
    const url = buildRelayWebSocketUrl({
      token: 'jwt-token',
      baseUrl: 'https://api.sendrelay.com.ng',
    });

    expect(url).toBe('wss://api.sendrelay.com.ng/v1/realtime/ws?token=jwt-token&type=APP');
  });

  it('preserves explicit API path/stage', () => {
    const url = buildRelayWebSocketUrl({
      token: 'jwt-token',
      baseUrl: 'https://api.sendrelay.com.ng/v1/realtime/ws',
    });

    expect(url).toBe('wss://api.sendrelay.com.ng/v1/realtime/ws?token=jwt-token&type=APP');
  });

  it('accepts host-only URL and adds default scheme/path', () => {
    const url = buildRelayWebSocketUrl({
      token: 'jwt-token',
      baseUrl: 'api.sendrelay.com.ng',
    });

    expect(url).toBe('wss://api.sendrelay.com.ng/v1/realtime/ws?token=jwt-token&type=APP');
  });

  it('encodes query parameters safely', () => {
    const url = buildRelayWebSocketUrl({
      token: 'a+b/c==',
      baseUrl: 'https://api.sendrelay.com.ng/v1/realtime/ws',
      deviceId: 'device id/1',
    });

    expect(url).toBe(
      'wss://api.sendrelay.com.ng/v1/realtime/ws?token=a%2Bb%2Fc%3D%3D&type=APP&deviceId=device+id%2F1',
    );
  });

  it('maps http and ws inputs to ws for local development', () => {
    expect(buildRelayWebSocketUrl({ token: 't', baseUrl: 'http://localhost:8787' })).toBe(
      'ws://localhost:8787/v1/realtime/ws?token=t&type=APP',
    );
    expect(buildRelayWebSocketUrl({ token: 't', baseUrl: 'wss://api.sendrelay.com.ng' })).toBe(
      'wss://api.sendrelay.com.ng/v1/realtime/ws?token=t&type=APP',
    );
  });
});
