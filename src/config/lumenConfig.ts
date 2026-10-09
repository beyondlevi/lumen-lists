// Configuration contract with the Lumen platform.
//
// On the glasses the platform injects `window.lumen.config`, backed by the
// fields declared under `lumen_config` in public/manifest.webmanifest and filled
// in on the phone companion (Apps tab). The TickTick API token is a `secret`
// field: it stays on the glasses and is never bundled, logged or typed in the
// app.
//
// In a regular browser (development only) `window.lumen` does not exist, so the
// values come from `?ticktick.token=…` (plus `?ticktick.api=…` to point the app
// at a mock server) and are kept in localStorage. The parameters are removed
// from the address bar right after they are read.
//
// Demo mode: the optional `demo` field set to `1` (or `on`, `true`, `yes`,
// `demo`), or `?demo=1` in the address, replaces TickTick with built-in
// fictional lists (src/demo). `?demo=0` turns the address switch off again.

export const TOKEN_KEY = 'ticktick.token';
/** Development and test only: another API origin (a mock server). Not in the manifest. */
export const API_BASE_KEY = 'ticktick.api';
/** Optional `lumen_config` field that turns on demo mode. */
export const DEMO_KEY = 'demo';
export const DEFAULT_API_BASE = 'https://api.ticktick.com';

const URL_KEYS: readonly string[] = [TOKEN_KEY, API_BASE_KEY];
const DEMO_VALUES = new Set(['1', 'on', 'true', 'yes', 'demo', 'demo-captures']);

export type ConfigValues = Record<string, string>;

export type TickTickConfig = {
  token: string;
  /** API origin without a trailing slash. */
  apiBase: string;
};

export type ConfigState =
  | {status: 'loading'}
  | {status: 'missing'}
  | {status: 'invalid'}
  | {status: 'ready'; config: TickTickConfig}
  | {status: 'demo'};

type LumenConfigApi = {
  get(): Promise<ConfigValues>;
  onChange(callback: (values?: ConfigValues) => void): unknown;
};

declare global {
  /** What the Lumen host injects. */
  interface LumenHost {
    config?: LumenConfigApi;
  }
  interface Window {
    lumen?: LumenHost;
  }
}

export type ConfigSource = {
  kind: 'lumen' | 'dev';
  get(): Promise<ConfigValues>;
  /** Calls back with the new values when known, or with nothing (caller re-reads). */
  subscribe(callback: (values?: ConfigValues) => void): () => void;
};

export const DEV_STORAGE_KEY = 'lumen-lists.dev-config';
export const DEMO_SESSION_KEY = 'lumen-lists.demo';

/** The parts of `window` this module uses (lets tests pass a plain object). */
export type HostWindow = {
  location: {href: string};
  localStorage: Storage;
  sessionStorage: Storage;
  history: {state: unknown; replaceState(state: unknown, unused: string, url: string): void};
  addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  lumen?: {config?: LumenConfigApi};
};

function readDevConfig(storage: Storage): ConfigValues {
  try {
    const raw = storage.getItem(DEV_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed == null || typeof parsed !== 'object') {
      return {};
    }
    const values: ConfigValues = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        values[key] = value;
      }
    }
    return values;
  } catch {
    return {};
  }
}

/**
 * Reads the address-bar switches and strips them: `?demo=1|0` for this
 * session, and (only when `store` is true, i.e. outside Lumen) the development
 * `ticktick.*` values, moved into localStorage. An empty value removes a key.
 */
export function captureUrlConfig(store: boolean, win: HostWindow = window): void {
  const url = new URL(win.location.href);
  const keys = URL_KEYS.filter(key => url.searchParams.has(key));
  const demo = url.searchParams.get(DEMO_KEY);
  if (keys.length === 0 && demo === null) {
    return;
  }
  try {
    if (demo !== null) {
      if (DEMO_VALUES.has(demo.trim().toLowerCase())) {
        win.sessionStorage.setItem(DEMO_SESSION_KEY, '1');
      } else {
        win.sessionStorage.removeItem(DEMO_SESSION_KEY);
      }
    }
    if (store && keys.length > 0) {
      const values = readDevConfig(win.localStorage);
      for (const key of keys) {
        const value = (url.searchParams.get(key) ?? '').trim();
        if (value) {
          values[key] = value;
        } else {
          delete values[key];
        }
      }
      win.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(values));
    }
  } catch {
    // Storage full or blocked: the values stay unavailable, which shows Setup.
  }
  for (const key of [...keys, DEMO_KEY]) {
    url.searchParams.delete(key);
  }
  win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
}

/** Whether `?demo=1` turned demo mode on for this session. */
export function demoBySession(win: Pick<HostWindow, 'sessionStorage'> = window): boolean {
  try {
    return win.sessionStorage.getItem(DEMO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function getConfigSource(win: HostWindow = window): ConfigSource {
  const lumenConfig = win.lumen?.config;
  if (lumenConfig != null && typeof lumenConfig.get === 'function') {
    return {
      kind: 'lumen',
      get: () => lumenConfig.get(),
      subscribe(callback) {
        if (typeof lumenConfig.onChange !== 'function') {
          return () => {};
        }
        const unsubscribe = lumenConfig.onChange(values =>
          callback(values != null && typeof values === 'object' ? values : undefined),
        );
        return typeof unsubscribe === 'function' ? () => unsubscribe() : () => {};
      },
    };
  }

  return {
    kind: 'dev',
    get: () => Promise.resolve(readDevConfig(win.localStorage)),
    subscribe(callback) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === DEV_STORAGE_KEY) {
          callback();
        }
      };
      win.addEventListener('storage', onStorage);
      return () => win.removeEventListener('storage', onStorage);
    },
  };
}

export function isDemoActivation(values: ConfigValues | null | undefined): boolean {
  const value = values?.[DEMO_KEY];
  return typeof value === 'string' && DEMO_VALUES.has(value.trim().toLowerCase());
}

const TOKEN_CHARS = /^[A-Za-z0-9._~+/=-]+$/;

/** The token from what was pasted: trimmed, without quotes or a `Bearer ` prefix. */
export function extractToken(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^bearer\s+/i, '')
    .trim();
  return value.length >= 8 && TOKEN_CHARS.test(value) ? value : null;
}

/** An http(s) address without a trailing slash, or null. */
function httpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

const read = (values: ConfigValues | null | undefined, key: string): string => {
  const value = values?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

export function parseConfig(values: ConfigValues | null | undefined, demoSession = false): ConfigState {
  if (demoSession || isDemoActivation(values)) {
    return {status: 'demo'};
  }
  const rawToken = read(values, TOKEN_KEY);
  if (rawToken === '') {
    return {status: 'missing'};
  }
  const token = extractToken(rawToken);
  const rawBase = read(values, API_BASE_KEY);
  const apiBase = rawBase ? httpUrl(rawBase) : DEFAULT_API_BASE;
  if (token == null || apiBase == null) {
    return {status: 'invalid'};
  }
  return {status: 'ready', config: {token, apiBase}};
}

export function sameConfig(a: ConfigState, b: ConfigState): boolean {
  if (a.status !== b.status) {
    return false;
  }
  if (a.status === 'ready' && b.status === 'ready') {
    return a.config.token === b.config.token && a.config.apiBase === b.config.apiBase;
  }
  return true;
}
