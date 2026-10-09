// Words the screens build from tasks, in the wearer's language.
import {formatNumber, locale, t, tp} from '../i18n/strings';
import type {List, Priority, Task} from '../ticktick/types';
import {dayKey, daysBetween, dueTone, formatDue, formatMonthDay, formatTime, formatWeekday, type Clock, type DueTone, type DueWords, type TaskGroup} from './due';

export const dueWords = (): DueWords => ({
  today: t('today'),
  tomorrow: t('tomorrow'),
  yesterday: t('yesterday'),
  dayTime: t('dayTime'),
  namedDate: t('namedDate'),
  dateTime: t('dateTime'),
});

/** "Yesterday · Work": a due date and a list on one line. */
export const dueAndList = (due: string, list: string) => t('dueAndList', {due, list});

/** The Inbox's name in the wearer's language; other lists keep theirs. */
export function listName(list: Pick<List, 'name' | 'inbox'> | undefined): string {
  if (!list) return '';
  return list.inbox ? t('inbox') : list.name;
}

/** "7 pending", "7 pending · 1 overdue", "All done". */
export function countsLabel(pending: number, overdue: number): string {
  if (pending === 0) return t('allDone');
  const count = tp('pendingCount', pending);
  return overdue > 0 ? t('countPair', {pending: count, overdue: tp('overdueCount', overdue)}) : count;
}

/** A row's due line: "Today 15:00", "Yesterday"; `timeOnlyToday` gives "15:00" for today. */
export function dueText(task: Task, clock: Clock, timeOnlyToday = false): string {
  return task.due ? formatDue(task.due, clock, locale, dueWords(), timeOnlyToday) : '';
}

export function toneOf(task: Task, clock: Clock): DueTone {
  return dueTone(task.due, clock);
}

export function groupTitle(group: TaskGroup): string {
  switch (group.key) {
    case 'overdue':
      return t('groupOverdue');
    case 'today':
      return t('today');
    case 'tomorrow':
      return t('tomorrow');
    case 'day':
      return formatWeekday(group.day ?? '', locale);
    case 'later':
      return t('groupLater');
    default:
      return t('groupNoDate');
  }
}

/** "Done 10:12", "Done yesterday", "Done Oct 7". */
export function doneLabel(completedAt: number | null, clock: Clock): string {
  if (completedAt == null) return '';
  const today = dayKey(clock.now, clock.timeZone);
  const day = dayKey(completedAt, clock.timeZone);
  const offset = daysBetween(today, day);
  if (offset === 0) return t('doneAt', {time: formatTime(completedAt, locale, clock.timeZone)});
  if (offset === -1) return t('doneYesterday');
  return t('doneOn', {date: formatMonthDay(day, locale, today.slice(0, 4))});
}

const PRIORITY_NAMES = {0: 'priority0', 1: 'priority1', 3: 'priority3', 5: 'priority5'} as const;
export const priorityName = (priority: Priority) => t(PRIORITY_NAMES[priority]);

const PRIORITY_LINES = {1: 'priorityLine1', 3: 'priorityLine3', 5: 'priorityLine5'} as const;
/** "High priority"; empty for none. */
export const priorityLine = (priority: Priority) => (priority === 0 ? '' : t(PRIORITY_LINES[priority]));

export const subtasksLine = (task: Task) =>
  t('subtasks', {done: formatNumber(task.subtasks.filter(subtask => subtask.done).length), total: formatNumber(task.subtasks.length)});
