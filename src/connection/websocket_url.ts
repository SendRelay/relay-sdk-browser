import { ConnectionError } from '../errors';

export const RELAY_DEFAULT_WEBSOCKET_PATH = '/v1/realtime/ws';
export const RELAY_DEFAULT_WEBSOCKET_URL = `https://api.sendrelay.com.ng${RELAY_DEFAULT_WEBSOCKET_PATH}`;

export interface BuildRelayWebSocketUrlOptions {
  token: string;
  baseUrl?: string;
  connectionType?: string;
  deviceId?: string;
  defaultPath?: string;
}

export function buildRelayWebSocketUrl({
  token,
  baseUrl = RELAY_DEFAULT_WEBSOCKET_URL,
  connectionType = 'APP',
  deviceId,
  defaultPath = RELAY_DEFAULT_WEBSOCKET_PATH,
}: BuildRelayWebSocketUrlOptions): string {
  const trimmedBaseUrl = baseUrl.trim();
  if (!trimmedBaseUrl) {
    throw new ConnectionError('WebSocket URL cannot be empty');
  }

  const urlWithScheme = ensureScheme(trimmedBaseUrl);
  const url = new URL(urlWithScheme);

  if (!url.hostname) {
    throw new ConnectionError(`Invalid WebSocket URL: missing host in "${baseUrl}"`);
  }

  url.protocol = normalizeScheme(url.protocol);
  if (url.port === '0') {
    url.port = '';
  }
  url.pathname = normalizePath(url.pathname, defaultPath);
  url.hash = '';

  url.searchParams.set('token', token);
  url.searchParams.set('type', connectionType);
  if (deviceId && deviceId.trim()) {
    url.searchParams.set('deviceId', deviceId.trim());
  }

  return url.toString();
}

function ensureScheme(url: string): string {
  return url.includes('://') ? url : `https://${url}`;
}

function normalizeScheme(protocol: string): string {
  switch (protocol.toLowerCase()) {
    case 'https:':
    case 'http:':
      return protocol.toLowerCase();
    case 'wss:':
      return 'https:';
    case 'ws:':
      return 'http:';
    default:
      throw new ConnectionError(`Unsupported URL scheme "${protocol}". Use https:// or http://.`);
  }
}

function normalizePath(pathname: string, defaultPath: string): string {
  if (!pathname || pathname === '/') {
    if (!defaultPath) {
      return '/';
    }
    return defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  }
  return pathname;
}
