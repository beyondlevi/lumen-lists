// TickTick Open API client (https://developer.ticktick.com/docs#/openapi),
// called straight from the page with the personal API token as a Bearer token.
// TickTick answers CORS with `*`, also on errors.
import {TickTickError, type Item, type List, type ListsApi, type NewItem, type ReopenResult} from './types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** One API call: method, path under /open/v1, optional JSON body. Resolves to the parsed body (null when empty). */
export type Request = (method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) => Promise<unknown>;

export type ClientOptions = {
  token: string;
  /** API origin, e.g. https://api.ticktick.com (a mock server in tests). */
  apiBase: string;
  fetch?: FetchLike;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** The batch endpoint takes up to 50 tasks per request. */
const BATCH_LIMIT = 50;
/** Spacing between the sort orders of items added together. */
export const SORT_STEP = 2 ** 30;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value != null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** TickTick dates: `2026-03-01T00:58:20.000+0000`. */
export function formatDate(ms: number): string {
  return new Date(ms).toISOString().replace('Z', '+0000');
}

export function parseDate(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  // `+0000` is not ISO 8601 for every engine: make it `+00:00`.
  const ms = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(ms) ? null : ms;
}

export function toList(raw: unknown): List | null {
  if (!isObject(raw) || typeof raw.id !== 'string') {
    return null;
  }
  return {id: raw.id, name: text(raw.name).trim() || raw.id};
}

export function toItem(raw: unknown, listId?: string): Item | null {
  if (!isObject(raw) || typeof raw.id !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    listId: text(raw.projectId) || listId || '',
    title: text(raw.title).trim(),
    note: (text(raw.content) || text(raw.desc)).trim(),
    sortOrder: number(raw.sortOrder),
    completedAt: parseDate(raw.completedTime),
  };
}

/** The lists the app shows: task lists that are not closed. */
export function openTaskLists(raw: unknown): List[] {
  if (!Array.isArray(raw)) {
    throw new TickTickError('server');
  }
  return raw
    .filter(entry => isObject(entry) && entry.closed !== true && String(entry.kind ?? 'TASK').toUpperCase() !== 'NOTE')
    .sort((a, b) => number((a as Json).sortOrder) - number((b as Json).sortOrder))
    .map(entry => toList(entry))
    .filter((list): list is List => list != null);
}

/** Open tasks of `GET /project/{id}/data`, in the list's order. */
export function openItemsFrom(raw: unknown, listId: string): Item[] {
  const tasks = isObject(raw) && Array.isArray(raw.tasks) ? raw.tasks : null;
  if (tasks == null) {
    throw new TickTickError('server');
  }
  return tasks
    .filter(task => isObject(task) && number(task.status) === 0)
    .map(task => toItem(task, listId))
    .filter((item): item is Item => item != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Completed tasks of `POST /task/completed`, newest first. */
export function cartFrom(raw: unknown, listId: string): Item[] {
  if (!Array.isArray(raw)) {
    throw new TickTickError('server');
  }
  return raw
    .map(task => toItem(task, listId))
    .filter((item): item is Item => item != null && item.listId === listId)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

export function errorFor(status: number): TickTickError {
  if (status === 401) return new TickTickError('auth', status);
  if (status === 404) return new TickTickError('notfound', status);
  if (status === 429) return new TickTickError('ratelimit', status);
  if (status >= 500) return new TickTickError('server', status);
  return new TickTickError('rejected', status);
}

export function createRequest({token, apiBase, fetch: fetcher = (input, init) => fetch(input, init)}: ClientOptions): Request {
  const base = `${apiBase.replace(/\/+$/, '')}/open/v1`;
  return async (method, path, body) => {
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? {'Content-Type': 'application/json'} : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new TickTickError('network');
    }
    if (!response.ok) {
      throw errorFor(response.status);
    }
    const raw = await response.text().catch(() => '');
    if (raw.trim() === '') {
      return null;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new TickTickError('server', response.status);
    }
  };
}

/** The body of a new task. */
export function taskBody(listId: string, item: NewItem, sortOrder?: number): Json {
  return {
    projectId: listId,
    title: item.title,
    ...(item.note ? {content: item.note} : {}),
    ...(sortOrder !== undefined ? {sortOrder} : {}),
  };
}

/**
 * Puts a completed item back in its list. The Open API documents no way to
 * reopen a task, so this tries the one the docs suggest, then falls back:
 *
 * 1. `POST /task/{id}` with `status: 0`. If TickTick answers with the task
 *    open again, done (`updated`).
 * 2. Otherwise (still completed, no task in the answer, or the update refused)
 *    a new task with the same title and content is created in the list
 *    (`recreated`), and the completed original is deleted so it does not stay
 *    in the cart next to its copy. That delete is best effort.
 *
 * Authentication, network and rate-limit failures are not a reason to fall
 * back: they are thrown as they are.
 */
export async function reopenItem(request: Request, item: Item): Promise<ReopenResult> {
  let answer: unknown = null;
  try {
    answer = await request('POST', `/task/${encodeURIComponent(item.id)}`, {
      id: item.id,
      projectId: item.listId,
      title: item.title,
      content: item.note,
      status: 0,
    });
  } catch (error) {
    if (!(error instanceof TickTickError) || error.kind === 'auth' || error.kind === 'network' || error.kind === 'ratelimit') {
      throw error;
    }
  }
  if (isObject(answer) && answer.status === 0) {
    const reopened = toItem(answer, item.listId);
    if (reopened != null) {
      return {path: 'updated', item: {...reopened, completedAt: null}};
    }
  }

  const created = toItem(await request('POST', '/task', taskBody(item.listId, item, item.sortOrder)), item.listId);
  if (created == null) {
    throw new TickTickError('server');
  }
  try {
    await request('DELETE', `/project/${encodeURIComponent(item.listId)}/task/${encodeURIComponent(item.id)}`);
  } catch {
    // The copy is in the list; the original only stays in TickTick's completed view.
  }
  return {path: 'recreated', item: {...created, completedAt: null}};
}

export function createClient(options: ClientOptions): ListsApi {
  const request = createRequest(options);
  const task = (item: Item) => `/project/${encodeURIComponent(item.listId)}/task/${encodeURIComponent(item.id)}`;

  return {
    async lists() {
      return openTaskLists(await request('GET', '/project'));
    },

    async openItems(listId) {
      return openItemsFrom(await request('GET', `/project/${encodeURIComponent(listId)}/data`), listId);
    },

    async cart(listId, now = Date.now()) {
      const raw = await request('POST', '/task/completed', {
        projectIds: [listId],
        startDate: formatDate(now - DAY_MS),
        endDate: formatDate(now),
      });
      return cartFrom(raw, listId);
    },

    async addItems(listId, items, afterSortOrder) {
      const sortOrder = (index: number) => (afterSortOrder === undefined ? undefined : afterSortOrder + SORT_STEP * (index + 1));
      if (items.length === 1) {
        await request('POST', '/task', taskBody(listId, items[0], sortOrder(0)));
        return;
      }
      for (let start = 0; start < items.length; start += BATCH_LIMIT) {
        const add = items.slice(start, start + BATCH_LIMIT).map((item, index) => taskBody(listId, item, sortOrder(start + index)));
        const answer = await request('POST', '/task/batch', {add});
        const errors = isObject(answer) && isObject(answer.id2error) ? Object.keys(answer.id2error) : [];
        if (errors.length > 0) {
          throw new TickTickError('rejected');
        }
      }
    },

    async complete(item) {
      await request('POST', `${task(item)}/complete`);
    },

    reopen(item) {
      return reopenItem(request, item);
    },

    async update(item, change) {
      const answer = await request('POST', `/task/${encodeURIComponent(item.id)}`, {
        id: item.id,
        projectId: item.listId,
        title: change.title,
        content: change.note,
      });
      return toItem(answer, item.listId) ?? {...item, title: change.title, note: change.note};
    },

    async remove(item) {
      await request('DELETE', task(item));
    },

    async createList(name) {
      const list = toList(await request('POST', '/project', {name, kind: 'TASK', viewMode: 'list'}));
      if (list == null) {
        throw new TickTickError('server');
      }
      return list;
    },
  };
}
