// TickTick Open API client (https://developer.ticktick.com/docs#/openapi),
// called straight from the page with the personal API token as a Bearer token.
// TickTick answers CORS with `*`, also on errors.
import {
  PRIORITIES,
  TickTickError,
  type Due,
  type List,
  type NewTask,
  type Priority,
  type ReopenResult,
  type Subtask,
  type Task,
  type TasksApi,
} from './types';

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
/** Spacing between the sort orders of tasks added together. */
export const SORT_STEP = 2 ** 30;
/** How far back Completed looks. */
export const COMPLETED_DAYS = 7;
/** The Inbox's alias in the Open API; TickTick answers with its real id. */
export const INBOX_ALIAS = 'inbox';

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

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function toPriority(value: unknown): Priority {
  const found = PRIORITIES.find(priority => priority === value);
  return found ?? 0;
}

export function toList(raw: unknown, inbox = false): List | null {
  if (!isObject(raw) || typeof raw.id !== 'string') {
    return null;
  }
  return {id: raw.id, name: text(raw.name).trim() || raw.id, inbox};
}

export function toDue(raw: Json): Due | null {
  const at = parseDate(raw.dueDate) ?? parseDate(raw.startDate);
  if (at == null) {
    return null;
  }
  return {at, allDay: raw.isAllDay === true, timeZone: text(raw.timeZone) || deviceTimeZone()};
}

function toSubtasks(raw: unknown): Subtask[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(isObject)
    .map((item, index) => ({id: text(item.id) || String(index), title: text(item.title).trim(), done: number(item.status) !== 0}));
}

export function toTask(raw: unknown, listId?: string): Task | null {
  if (!isObject(raw) || typeof raw.id !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    listId: text(raw.projectId) || listId || '',
    title: text(raw.title).trim(),
    notes: (text(raw.content) || text(raw.desc)).trim(),
    priority: toPriority(raw.priority),
    due: toDue(raw),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    subtasks: toSubtasks(raw.items),
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

/** Pending tasks of `GET /project/{id}/data`, in the list's order. */
export function pendingFrom(raw: unknown, listId: string): Task[] {
  const tasks = isObject(raw) && Array.isArray(raw.tasks) ? raw.tasks : null;
  if (tasks == null) {
    throw new TickTickError('server');
  }
  return tasks
    .filter(task => isObject(task) && number(task.status) === 0)
    .map(task => toTask(task, listId))
    .filter((task): task is Task => task != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Completed tasks of `POST /task/completed`, newest first. */
export function completedFrom(raw: unknown, listId: string): Task[] {
  if (!Array.isArray(raw)) {
    throw new TickTickError('server');
  }
  return raw
    .map(task => toTask(task, listId))
    .filter((task): task is Task => task != null && task.listId === listId)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

/**
 * The real id of the Inbox from `GET /project/inbox/data`: the project in the
 * answer, else the project of its tasks, else the alias itself.
 */
export function inboxIdFrom(raw: unknown): string {
  if (isObject(raw)) {
    if (isObject(raw.project) && typeof raw.project.id === 'string' && raw.project.id) {
      return raw.project.id;
    }
    const first = Array.isArray(raw.tasks) ? raw.tasks.find(isObject) : undefined;
    if (first && typeof first.projectId === 'string' && first.projectId) {
      return first.projectId;
    }
  }
  return INBOX_ALIAS;
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

/** The due fields of a task body. `null` clears them (an edit that empties Due). */
export function dueBody(due: Due | null): Json {
  if (due == null) {
    return {startDate: null, dueDate: null, isAllDay: false};
  }
  const date = formatDate(due.at);
  return {startDate: date, dueDate: date, isAllDay: due.allDay, timeZone: due.timeZone};
}

/** The body of a new task. */
export function taskBody(listId: string, task: NewTask, sortOrder?: number): Json {
  return {
    projectId: listId,
    title: task.title,
    ...(task.due ? dueBody(task.due) : {}),
    ...(task.priority ? {priority: task.priority} : {}),
    ...(sortOrder !== undefined ? {sortOrder} : {}),
  };
}

/**
 * Puts a completed task back in its list. The Open API documents no way to
 * reopen a task, so this tries `status: 0` first, then falls back:
 *
 * 1. `POST /task/{id}` with `status: 0`. If TickTick answers with the task
 *    open again, done (`updated`). Tested by the owner on TickTick: this is
 *    what happens.
 * 2. Otherwise (still completed, no task in the answer, or the update refused)
 *    a new task with the same title, notes, due and priority is created in the
 *    list (`recreated`), and the completed original is deleted so it does not
 *    stay among the completed next to its copy. That delete is best effort.
 *
 * Authentication, network and rate-limit failures are not a reason to fall
 * back: they are thrown as they are.
 */
export async function reopenTask(request: Request, task: Task): Promise<ReopenResult> {
  let answer: unknown = null;
  try {
    answer = await request('POST', `/task/${encodeURIComponent(task.id)}`, {
      id: task.id,
      projectId: task.listId,
      title: task.title,
      content: task.notes,
      status: 0,
    });
  } catch (error) {
    if (!(error instanceof TickTickError) || error.kind === 'auth' || error.kind === 'network' || error.kind === 'ratelimit') {
      throw error;
    }
  }
  if (isObject(answer) && answer.status === 0) {
    const reopened = toTask(answer, task.listId);
    if (reopened != null) {
      return {path: 'updated', task: {...reopened, completedAt: null}};
    }
  }

  const created = toTask(
    await request('POST', '/task', {
      ...taskBody(task.listId, {title: task.title, due: task.due, priority: task.priority}, task.sortOrder),
      ...(task.notes ? {content: task.notes} : {}),
    }),
    task.listId,
  );
  if (created == null) {
    throw new TickTickError('server');
  }
  try {
    await request('DELETE', `/project/${encodeURIComponent(task.listId)}/task/${encodeURIComponent(task.id)}`);
  } catch {
    // The copy is in the list; the original only stays in TickTick's completed view.
  }
  return {path: 'recreated', task: {...created, completedAt: null}};
}

export function createClient(options: ClientOptions): TasksApi {
  const request = createRequest(options);
  const path = (task: Task) => `/project/${encodeURIComponent(task.listId)}/task/${encodeURIComponent(task.id)}`;

  return {
    async lists() {
      return openTaskLists(await request('GET', '/project'));
    },

    async inbox() {
      const raw = await request('GET', `/project/${INBOX_ALIAS}/data`);
      const id = inboxIdFrom(raw);
      return {list: {id, name: 'Inbox', inbox: true}, tasks: pendingFrom(raw, id)};
    },

    async pendingTasks(listId) {
      return pendingFrom(await request('GET', `/project/${encodeURIComponent(listId)}/data`), listId);
    },

    async completedTasks(listId, now = Date.now(), days = COMPLETED_DAYS) {
      const raw = await request('POST', '/task/completed', {
        projectIds: [listId],
        startDate: formatDate(now - days * DAY_MS),
        endDate: formatDate(now),
      });
      return completedFrom(raw, listId);
    },

    async addTasks(listId, tasks, afterSortOrder) {
      const sortOrder = (index: number) => (afterSortOrder === undefined ? undefined : afterSortOrder + SORT_STEP * (index + 1));
      if (tasks.length === 1) {
        await request('POST', '/task', taskBody(listId, tasks[0], sortOrder(0)));
        return;
      }
      for (let start = 0; start < tasks.length; start += BATCH_LIMIT) {
        const add = tasks.slice(start, start + BATCH_LIMIT).map((task, index) => taskBody(listId, task, sortOrder(start + index)));
        const answer = await request('POST', '/task/batch', {add});
        const errors = isObject(answer) && isObject(answer.id2error) ? Object.keys(answer.id2error) : [];
        if (errors.length > 0) {
          throw new TickTickError('rejected');
        }
      }
    },

    async complete(task) {
      await request('POST', `${path(task)}/complete`);
    },

    reopen(task) {
      return reopenTask(request, task);
    },

    async update(task, change) {
      let listId = task.listId;
      if (change.listId !== task.listId) {
        await request('POST', '/task/move', [{fromProjectId: task.listId, toProjectId: change.listId, taskId: task.id}]);
        listId = change.listId;
      }
      const answer = await request('POST', `/task/${encodeURIComponent(task.id)}`, {
        id: task.id,
        projectId: listId,
        title: change.title,
        priority: change.priority,
        ...dueBody(change.due),
      });
      return toTask(answer, listId) ?? {...task, listId, title: change.title, due: change.due, priority: change.priority};
    },

    async remove(task) {
      await request('DELETE', path(task));
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
