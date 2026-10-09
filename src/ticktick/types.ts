/** A TickTick list (project), or the Inbox. */
export type List = {
  id: string;
  name: string;
  inbox: boolean;
};

/** TickTick priorities: none, low, medium, high. */
export type Priority = 0 | 1 | 3 | 5;
export const PRIORITIES: readonly Priority[] = [0, 1, 3, 5];

/** When a task is due: an instant, or a whole day (`allDay`) in `timeZone`. */
export type Due = {
  /** ms since the epoch: the due time, or midnight of the due day in `timeZone`. */
  at: number;
  allDay: boolean;
  /** IANA time zone the task was set in. */
  timeZone: string;
};

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  /** The task's notes: `content`, or `desc` for checklists. */
  notes: string;
  priority: Priority;
  due: Due | null;
  tags: string[];
  subtasks: Subtask[];
  sortOrder: number;
  /** When it was completed (ms since the epoch), for completed tasks. */
  completedAt: number | null;
};

/** What a new task, or an edit, sets. */
export type NewTask = {
  title: string;
  due: Due | null;
  priority?: Priority;
};

export type TaskChange = {
  title: string;
  due: Due | null;
  priority: Priority;
  listId: string;
};

export type ReopenResult = {
  /** `updated`: TickTick took `status: 0`. `recreated`: a new task replaced it. */
  path: 'updated' | 'recreated';
  task: Task;
};

export type ApiErrorKind = 'auth' | 'network' | 'notfound' | 'ratelimit' | 'server' | 'rejected';

export class TickTickError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, status: number | null = null) {
    super(status != null ? `TickTick ${kind} (HTTP ${status})` : `TickTick ${kind}`);
    this.name = 'TickTickError';
    this.kind = kind;
    this.status = status;
  }
}

/** Everything the screens need from TickTick (or from demo mode). */
export interface TasksApi {
  /** The open task lists (not notes, not closed), without the Inbox. */
  lists(): Promise<List[]>;
  /** The Inbox: its real id (TickTick answers `inbox<n>`) and its pending tasks. */
  inbox(): Promise<{list: List; tasks: Task[]}>;
  /** The pending tasks of a list, in the list's order. */
  pendingTasks(listId: string): Promise<Task[]>;
  /** The tasks completed in this list in the `days` before `now`, newest first. */
  completedTasks(listId: string, now?: number, days?: number): Promise<Task[]>;
  /** Adds tasks at the end of the list, in this order, after `afterSortOrder`. */
  addTasks(listId: string, tasks: NewTask[], afterSortOrder?: number): Promise<void>;
  complete(task: Task): Promise<void>;
  /** Puts a completed task back (see reopenTask in client.ts). */
  reopen(task: Task): Promise<ReopenResult>;
  /** Title, due, priority, and the list (a move) when it changed. */
  update(task: Task, change: TaskChange): Promise<Task>;
  remove(task: Task): Promise<void>;
  createList(name: string): Promise<List>;
}
