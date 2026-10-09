// Due dates as TickTick keeps them, and as the wearer reads them.
//
// TickTick stores `dueDate` as an instant with `isAllDay` and the `timeZone`
// the task was set in. A timed task is shown in the device's time zone; an
// all-day task is a calendar day in its own time zone (its `dueDate` is that
// day's midnight there), whatever the device's zone.
import type {Due, Task} from '../ticktick/types';

export type Clock = {
  now: number;
  /** The device's IANA time zone. */
  timeZone: string;
};

export type Language = 'en' | 'pt';

const intlLocale = (language: Language) => (language === 'pt' ? 'pt-BR' : 'en-US');

/** `YYYY-MM-DD` of an instant in a time zone. */
export function dayKey(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(ms));
  const part = (type: string) => parts.find(entry => entry.type === type)?.value ?? '00';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  const utc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** The calendar day a task is due on, as the wearer sees it. */
export function dueDay(due: Due, clock: Clock): string {
  return due.allDay ? dayKey(due.at, due.timeZone) : dayKey(due.at, clock.timeZone);
}

/** Days from today to the due day (negative when past). */
export function dueOffset(due: Due, clock: Clock): number {
  return daysBetween(dayKey(clock.now, clock.timeZone), dueDay(due, clock));
}

export function isOverdue(due: Due, clock: Clock): boolean {
  return due.allDay ? dueOffset(due, clock) < 0 : due.at < clock.now;
}

export type DueTone = 'overdue' | 'today' | 'normal';

export function dueTone(due: Due | null, clock: Clock): DueTone {
  if (due == null) return 'normal';
  if (isOverdue(due, clock)) return 'overdue';
  return dueOffset(due, clock) === 0 ? 'today' : 'normal';
}

/** Midnight UTC of a day key, to format it as a date without a zone shift. */
const dayDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

export function formatTime(ms: number, language: Language, timeZone: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), {hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone}).format(new Date(ms));
}

/** "Fri, Oct 10" / "sex., 10 de out.", with the year when it is not this year. */
export function formatShortDay(key: string, language: Language, thisYear: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(key.slice(0, 4) !== thisYear ? {year: 'numeric'} : {}),
    timeZone: 'UTC',
  }).format(dayDate(key));
}

/** "Oct 9" / "9 de out.". */
export function formatMonthDay(key: string, language: Language, thisYear: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    month: 'short',
    day: 'numeric',
    ...(key.slice(0, 4) !== thisYear ? {year: 'numeric'} : {}),
    timeZone: 'UTC',
  }).format(dayDate(key));
}

/** "Saturday" / "sábado". */
export function formatWeekday(key: string, language: Language): string {
  const name = new Intl.DateTimeFormat(intlLocale(language), {weekday: 'long', timeZone: 'UTC'}).format(dayDate(key));
  return name.charAt(0).toLocaleUpperCase(intlLocale(language)) + name.slice(1);
}

/** The words and templates due dates are written with, in the wearer's language. */
export type DueWords = {
  today: string;
  tomorrow: string;
  yesterday: string;
  /** "{day} {time}": "Today 15:00". */
  dayTime: string;
  /** "{name}, {date}": "Today, Oct 9". */
  namedDate: string;
  /** "{date} · {time}": "Today, Oct 9 · 15:00". */
  dateTime: string;
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);

/** Today / Tomorrow / Yesterday, or the short date. */
export function relativeDay(due: Due, clock: Clock, language: Language, words: DueWords): string {
  const offset = dueOffset(due, clock);
  if (offset === 0) return words.today;
  if (offset === 1) return words.tomorrow;
  if (offset === -1) return words.yesterday;
  return formatShortDay(dueDay(due, clock), language, dayKey(clock.now, clock.timeZone).slice(0, 4));
}

/** "Today 15:00", "Yesterday", "Fri, Oct 10": a row's due line. `timeOnlyToday` drops "Today" before a time. */
export function formatDue(due: Due, clock: Clock, language: Language, words: DueWords, timeOnlyToday = false): string {
  const day = relativeDay(due, clock, language, words);
  if (due.allDay) return day;
  const time = formatTime(due.at, language, clock.timeZone);
  return timeOnlyToday && dueOffset(due, clock) === 0 ? time : fill(words.dayTime, {day, time});
}

/** "Today, Oct 9 · 15:00": the task screen's due line. */
export function formatDueLong(due: Due, clock: Clock, language: Language, words: DueWords): string {
  const key = dueDay(due, clock);
  const thisYear = dayKey(clock.now, clock.timeZone).slice(0, 4);
  const offset = dueOffset(due, clock);
  const named = offset === 0 ? words.today : offset === 1 ? words.tomorrow : offset === -1 ? words.yesterday : null;
  const date = named ? fill(words.namedDate, {name: named, date: formatMonthDay(key, language, thisYear)}) : formatShortDay(key, language, thisYear);
  return due.allDay ? date : fill(words.dateTime, {date, time: formatTime(due.at, language, clock.timeZone)});
}

/** The text an Edit's Due field starts from: "Today 15:00", "Fri, Oct 10". Empty without a due. */
export function dueFieldText(due: Due | null, clock: Clock, language: Language, words: DueWords): string {
  return due ? formatDue(due, clock, language, words) : '';
}

/** How far a time zone is ahead of UTC at an instant, in ms. */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - Math.floor(ms / 1000) * 1000;
}

/** Midnight of a calendar day in a time zone, as an instant. */
export function midnightIn(year: number, month: number, day: number, timeZone: string): number {
  const utc = Date.UTC(year, month - 1, day);
  const first = utc - zoneOffset(utc, timeZone);
  const second = utc - zoneOffset(first, timeZone);
  return second;
}

/** Sorting: due first (earliest first, whole days before timed tasks of that day), then priority, then list order. */
export function compareTasks(a: Task, b: Task, clock: Clock): number {
  if (a.due && b.due) {
    const dayA = dueDay(a.due, clock);
    const dayB = dueDay(b.due, clock);
    if (dayA !== dayB) return dayA < dayB ? -1 : 1;
    if (a.due.allDay !== b.due.allDay) return a.due.allDay ? -1 : 1;
    if (!a.due.allDay && a.due.at !== b.due.at) return a.due.at - b.due.at;
  } else if (a.due || b.due) {
    return a.due ? -1 : 1;
  }
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.sortOrder - b.sortOrder;
}

export type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'day' | 'later' | 'none';

export type TaskGroup = {
  key: GroupKey;
  /** For `day`: the day (`YYYY-MM-DD`). */
  day?: string;
  tasks: Task[];
};

/** Pending, grouped: Overdue, Today, Tomorrow, each of the next five days, Later, No date. */
export function groupTasks(tasks: readonly Task[], clock: Clock): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  const add = (id: string, group: Omit<TaskGroup, 'tasks'>, task: Task) => {
    const found = groups.get(id) ?? {...group, tasks: []};
    found.tasks.push(task);
    groups.set(id, found);
  };
  const order = (group: TaskGroup) =>
    group.key === 'overdue' ? 0 : group.key === 'today' ? 1 : group.key === 'tomorrow' ? 2 : group.key === 'day' ? 3 : group.key === 'later' ? 4 : 5;
  for (const task of [...tasks].sort((a, b) => compareTasks(a, b, clock))) {
    if (task.due == null) {
      add('none', {key: 'none'}, task);
      continue;
    }
    if (isOverdue(task.due, clock)) {
      add('overdue', {key: 'overdue'}, task);
      continue;
    }
    const offset = dueOffset(task.due, clock);
    if (offset <= 0) add('today', {key: 'today'}, task);
    else if (offset === 1) add('tomorrow', {key: 'tomorrow'}, task);
    else if (offset <= 6) {
      const day = dueDay(task.due, clock);
      add(`day:${day}`, {key: 'day', day}, task);
    } else add('later', {key: 'later'}, task);
  }
  return [...groups.values()].sort((a, b) => order(a) - order(b) || (a.day ?? '').localeCompare(b.day ?? ''));
}

export function countOverdue(tasks: readonly Task[], clock: Clock): number {
  return tasks.filter(task => task.due != null && isOverdue(task.due, clock)).length;
}
