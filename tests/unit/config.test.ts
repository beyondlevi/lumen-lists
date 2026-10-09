import {describe, expect, it} from 'vitest';
import {
  captureUrlConfig,
  DEFAULT_API_BASE,
  DEMO_SESSION_KEY,
  DEV_STORAGE_KEY,
  demoBySession,
  extractToken,
  getConfigSource,
  isDemoActivation,
  parseConfig,
  sameConfig,
  type HostWindow,
} from '../../src/config/lumenConfig';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function hostWindow(href: string, lumen?: HostWindow['lumen']) {
  const replaced: string[] = [];
  const win: HostWindow = {
    location: {href},
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    history: {state: null, replaceState: (_state, _unused, url) => void replaced.push(url)},
    addEventListener: () => {},
    removeEventListener: () => {},
    lumen,
  };
  return {win, replaced};
}

describe('parseConfig', () => {
  it('needs the token', () => {
    expect(parseConfig({})).toEqual({status: 'missing'});
    expect(parseConfig({'ticktick.token': '   '})).toEqual({status: 'missing'});
    expect(parseConfig(null)).toEqual({status: 'missing'});
  });

  it('reads the token and the default API', () => {
    expect(parseConfig({'ticktick.token': ' tp_0123456789abcdef '})).toEqual({
      status: 'ready',
      config: {token: 'tp_0123456789abcdef', apiBase: DEFAULT_API_BASE},
    });
  });

  it('accepts a pasted Bearer prefix or quotes, refuses what is not a token', () => {
    expect(extractToken('Bearer tp_0123456789abcdef')).toBe('tp_0123456789abcdef');
    expect(extractToken('"tp_0123456789abcdef"')).toBe('tp_0123456789abcdef');
    expect(extractToken('has spaces in it')).toBeNull();
    expect(extractToken('short')).toBeNull();
    expect(parseConfig({'ticktick.token': 'has spaces in it'})).toEqual({status: 'invalid'});
  });

  it('takes another API origin (tests only)', () => {
    expect(parseConfig({'ticktick.token': 'tp_0123456789abcdef', 'ticktick.api': 'http://127.0.0.1:8091/'})).toMatchObject({
      config: {apiBase: 'http://127.0.0.1:8091'},
    });
    expect(parseConfig({'ticktick.token': 'tp_0123456789abcdef', 'ticktick.api': 'ftp://x'})).toEqual({status: 'invalid'});
  });

  it('turns on demo mode from the setting or the session', () => {
    for (const value of ['1', 'on', 'TRUE', 'yes', 'demo']) {
      expect(isDemoActivation({demo: value})).toBe(true);
    }
    for (const value of ['', '0', 'off', 'no']) {
      expect(isDemoActivation({demo: value})).toBe(false);
    }
    expect(parseConfig({demo: '1', 'ticktick.token': 'tp_0123456789abcdef'})).toEqual({status: 'demo'});
    expect(parseConfig({}, true)).toEqual({status: 'demo'});
  });

  it('compares states by what matters', () => {
    const a = parseConfig({'ticktick.token': 'tp_0123456789abcdef'});
    expect(sameConfig(a, parseConfig({'ticktick.token': 'tp_0123456789abcdef'}))).toBe(true);
    expect(sameConfig(a, parseConfig({'ticktick.token': 'tp_fedcba9876543210'}))).toBe(false);
    expect(sameConfig({status: 'missing'}, {status: 'missing'})).toBe(true);
  });
});

describe('address-bar switches', () => {
  it('keeps development values outside Lumen and strips them', () => {
    const {win, replaced} = hostWindow('http://127.0.0.1:4173/list/a?ticktick.token=tp_0123456789abcdef&x=1');
    captureUrlConfig(true, win);
    expect(JSON.parse(win.localStorage.getItem(DEV_STORAGE_KEY) ?? '{}')).toEqual({'ticktick.token': 'tp_0123456789abcdef'});
    expect(replaced).toEqual(['/list/a?x=1']);
  });

  it('inside Lumen only strips them', () => {
    const {win, replaced} = hostWindow('http://127.0.0.1:47100/?ticktick.token=tp_0123456789abcdef');
    captureUrlConfig(false, win);
    expect(win.localStorage.getItem(DEV_STORAGE_KEY)).toBeNull();
    expect(replaced).toEqual(['/']);
  });

  it('?demo=1 turns demo mode on for the session, ?demo=0 off', () => {
    const {win} = hostWindow('http://127.0.0.1:4173/?demo=1');
    captureUrlConfig(false, win);
    expect(win.sessionStorage.getItem(DEMO_SESSION_KEY)).toBe('1');
    expect(demoBySession(win)).toBe(true);
    win.location.href = 'http://127.0.0.1:4173/?demo=0';
    captureUrlConfig(false, win);
    expect(demoBySession(win)).toBe(false);
  });
});

describe('getConfigSource', () => {
  it('uses window.lumen.config when the host injects it', async () => {
    const listeners: ((values?: Record<string, string>) => void)[] = [];
    const {win} = hostWindow('http://127.0.0.1:47100/', {
      config: {
        get: async () => ({'ticktick.token': 'tp_0123456789abcdef'}),
        onChange: callback => {
          listeners.push(callback);
          return () => listeners.splice(listeners.indexOf(callback), 1);
        },
      },
    });
    const source = getConfigSource(win);
    expect(source.kind).toBe('lumen');
    expect(await source.get()).toEqual({'ticktick.token': 'tp_0123456789abcdef'});
    const seen: unknown[] = [];
    const stop = source.subscribe(values => seen.push(values));
    listeners[0]({demo: '1'});
    stop();
    expect(seen).toEqual([{demo: '1'}]);
    expect(listeners).toHaveLength(0);
  });

  it('falls back to localStorage in a regular browser', async () => {
    const {win} = hostWindow('http://127.0.0.1:4173/');
    win.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify({'ticktick.token': 'tp_0123456789abcdef', bad: 1}));
    const source = getConfigSource(win);
    expect(source.kind).toBe('dev');
    expect(await source.get()).toEqual({'ticktick.token': 'tp_0123456789abcdef'});
  });
});
