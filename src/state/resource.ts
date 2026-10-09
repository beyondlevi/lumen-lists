import {TickTickError, type Item, type ListSummary} from '../ticktick/types';

export type Resource<T> = {
  status: 'loading' | 'ready' | 'error';
  /** The last data, also while loading again or after a failed refresh. */
  data: T | null;
  error: TickTickError | null;
};

export type LoadOptions = {silent?: boolean};

/** Network failures are retried after 2, 4, 8 and 15 seconds. */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000];
export const CACHE_KEY = 'lumen-lists.cache';
export const LAST_KEY = 'lumen-lists.last';
const PARALLEL = 4;

export const asError = (error: unknown) => (error instanceof TickTickError ? error : new TickTickError('server'));

/** A resource about to load: `silent` keeps showing what is there. */
export function loading<T>(current: Resource<T> | null | undefined, silent = false): Resource<T> {
  return {status: silent && current?.data ? 'ready' : 'loading', data: current?.data ?? null, error: null};
}

/** A resource after its load: the data, or the error (a silent refresh keeps the old data). */
export function settled<T>(current: Resource<T> | null | undefined, result: T | TickTickError, silent = false): Resource<T> {
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

/** The start screen as last seen (names and counts only), shown while it loads again. */
export function readCache(): ListSummary[] | null {
  try {
    const parsed: unknown = JSON.parse(readStorage(CACHE_KEY) ?? 'null');
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter(
      (entry): entry is ListSummary =>
        entry != null && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.open === 'number',
    );
  } catch {
    return null;
  }
}

export function insertBySortOrder(items: readonly Item[], item: Item): Item[] {
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
