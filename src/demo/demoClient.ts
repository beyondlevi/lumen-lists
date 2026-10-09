// Demo mode: fictional lists and tasks kept in memory, with no network and
// nothing stored. Every change (complete, reopen, add, edit, move, delete, new
// list) changes only this copy and is gone when the app closes.
import fixtures from './fixtures.json';
import {SORT_STEP} from '../ticktick/client';
import {TickTickError, type Due, type List, type Priority, type Task, type TasksApi} from '../ticktick/types';
import {dayKey, midnightIn} from '../tasks/due';

type FixtureTask = {
  title: string;
  day?: number;
  time?: string;
  priority?: number;
  tags?: string[];
  notes?: string;
  subtasks?: {title: string; done?: boolean}[];
};
type Fixture = {
  id: string;
  name: string;
  inbox?: boolean;
  pending: FixtureTask[];
  completed: {title: string; minutesAgo: number}[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A short pause, so loading states show as they would with TickTick. */
const DELAY_MS = 120;

const wait = () => new Promise(resolve => setTimeout(resolve, DELAY_MS));

/** A fixture's due date: `day` days from today, at `time` or all day, in `timeZone`. */
export function fixtureDue(task: FixtureTask, now: number, timeZone: string): Due | null {
  if (task.day === undefined) return null;
  const [year, month, day] = dayKey(now, timeZone).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + task.day));
  const midnight = midnightIn(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), timeZone);
  if (!task.time) return {at: midnight, allDay: true, timeZone};
  const [hours, minutes] = task.time.split(':').map(Number);
  return {at: midnight + (hours * 60 + minutes) * 60_000, allDay: false, timeZone};
}

export function createDemoClient(language: 'en' | 'pt', now = Date.now(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): TasksApi {
  const source: Fixture[] = (fixtures as Record<string, Fixture[]>)[language] ?? fixtures.en;
  const lists: List[] = source.map(({id, name, inbox}) => ({id, name, inbox: inbox === true}));
  let tasks: Task[] = source.flatMap(list => [
    ...list.pending.map((entry, index) => ({
      id: `${list.id}-${index}`,
      listId: list.id,
      title: entry.title,
      notes: entry.notes ?? '',
      priority: (entry.priority ?? 0) as Priority,
      due: fixtureDue(entry, now, timeZone),
      tags: entry.tags ?? [],
      subtasks: (entry.subtasks ?? []).map((subtask, at) => ({id: `${index}-${at}`, title: subtask.title, done: subtask.done === true})),
      sortOrder: (index + 1) * SORT_STEP,
      completedAt: null,
    })),
    ...list.completed.map((entry, index) => ({
      id: `${list.id}-done-${index}`,
      listId: list.id,
      title: entry.title,
      notes: '',
      priority: 0 as Priority,
      due: null,
      tags: [],
      subtasks: [],
      sortOrder: (list.pending.length + index + 1) * SORT_STEP,
      completedAt: now - entry.minutesAgo * 60_000,
    })),
  ]);
  let nextId = 1;
  const find = (id: string) => {
    const task = tasks.find(entry => entry.id === id);
    if (!task) throw new TickTickError('notfound', 404);
    return task;
  };
  const replace = (next: Task) => {
    tasks = tasks.map(entry => (entry.id === next.id ? next : entry));
  };
  const pending = (listId: string) => tasks.filter(task => task.listId === listId && task.completedAt == null).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    async lists() {
      await wait();
      return lists.filter(list => !list.inbox).map(list => ({...list}));
    },
    async inbox() {
      await wait();
      const list = lists.find(entry => entry.inbox) ?? {id: 'demo-inbox', name: 'Inbox', inbox: true};
      return {list: {...list}, tasks: pending(list.id)};
    },
    async pendingTasks(listId) {
      await wait();
      if (!lists.some(list => list.id === listId)) throw new TickTickError('notfound', 404);
      return pending(listId);
    },
    async completedTasks(listId, at = Date.now(), days = 7) {
      await wait();
      return tasks
        .filter(task => task.listId === listId && task.completedAt != null && task.completedAt >= at - days * DAY_MS)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    },
    async addTasks(listId, added, afterSortOrder = 0) {
      await wait();
      tasks = [
        ...tasks,
        ...added.map((entry, index) => ({
          id: `demo-new-${nextId++}`,
          listId,
          title: entry.title,
          notes: '',
          priority: entry.priority ?? 0,
          due: entry.due,
          tags: [],
          subtasks: [],
          sortOrder: afterSortOrder + (index + 1) * SORT_STEP,
          completedAt: null,
        })),
      ];
    },
    async complete(task) {
      await wait();
      replace({...find(task.id), completedAt: Date.now()});
    },
    async reopen(task) {
      await wait();
      const reopened = {...find(task.id), completedAt: null};
      replace(reopened);
      return {path: 'updated', task: reopened};
    },
    async update(task, change) {
      await wait();
      const updated = {...find(task.id), title: change.title, due: change.due, priority: change.priority, listId: change.listId};
      replace(updated);
      return updated;
    },
    async remove(task) {
      await wait();
      tasks = tasks.filter(entry => entry.id !== task.id);
    },
    async createList(name) {
      await wait();
      const list = {id: `demo-list-${nextId++}`, name, inbox: false};
      lists.push(list);
      return {...list};
    },
  };
}
