import {TickTickError, type Task} from '../ticktick/types';

export type Resource<T> = {
  status: 'loading' | 'ready' | 'error';
  /** The last data, also while loading again or after a failed refresh. */
  data: T | null;
  error: TickTickError | null;
};

export type LoadOptions = {
  /** Keep showing what is there while loading again. */
  silent?: boolean;
  /** A retry after a network failure: it keeps counting attempts instead of starting over. */
  retry?: boolean;
};

/** Network failures are retried after 2, 4, 8 and 15 seconds. */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000];
export const CACHE_KEY = 'lumen-lists.cache.v2';
export const LAST_KEY = 'lumen-lists.last';
const PARALLEL = 4;

export const asError = (error: unknown) => (error instanceof TickTickError ? error : new TickTickError('server'));

/** A resource about to load: `silent` keeps showing what is there. */
export function loading<T>(current: Resource<T> | null | undefined, silent = false): Resource<T> {
  return {status: silent && current?.data ? 'ready' : 'loading', data: current?.data ?? null, error: null};
}

/** Network failures that will be tried again: until the last try, the screen keeps loading. */
export const retrying = new WeakSet<TickTickError>();

/** A resource after its load: the data, or the error (a silent refresh keeps the old data). */
export function settled<T>(current: Resource<T> | null | undefined, result: T | TickTickError, silent = false): Resource<T> {
  if (result instanceof TickTickError && retrying.has(result)) {
    return loading(current, silent);
  }
  if (result instanceof TickTickError) {
    return {status: silent && current?.data ? 'ready' : 'error', data: current?.data ?? null, error: result};
  }
  return {status: 'ready', data: result, error: null};
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage blocked: nothing to keep.
  }
}

export type CachedList = {id: string; name: string; inbox: boolean; pending: number; overdue: number};

/** The lists as last seen (names and counts only), shown while they load again. */
export function readCache(): CachedList[] | null {
  try {
    const parsed: unknown = JSON.parse(readStorage(CACHE_KEY) ?? 'null');
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter(
      (entry): entry is CachedList =>
        entry != null && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.pending === 'number',
    ).map(entry => ({...entry, inbox: entry.inbox === true, overdue: typeof entry.overdue === 'number' ? entry.overdue : 0}));
  } catch {
    return null;
  }
}

export function insertBySortOrder(items: readonly Task[], item: Task): Task[] {
  const next = items.filter(entry => entry.id !== item.id);
  const index = next.findIndex(entry => entry.sortOrder > item.sortOrder);
  next.splice(index === -1 ? next.length : index, 0, item);
  return next;
}

export async function inBatches<T>(values: readonly T[], run: (value: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < values.length; start += PARALLEL) {
    await Promise.all(values.slice(start, start + PARALLEL).map(run));
  }
}
