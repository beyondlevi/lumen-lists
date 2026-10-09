import {describe, expect, it} from 'vitest';
import {
  compareTasks,
  countOverdue,
  dayKey,
  dueFieldText,
  dueTone,
  formatDue,
  formatDueLong,
  groupTasks,
  midnightIn,
  type Clock,
} from '../../src/tasks/due';
import type {Due, Priority, Task} from '../../src/ticktick/types';

const SP = 'America/Sao_Paulo';
// Friday, October 9, 2026, 10:00 in São Paulo (13:00 UTC).
const clock: Clock = {now: Date.UTC(2026, 9, 9, 13), timeZone: SP};
const templates = {dayTime: '{day} {time}', namedDate: '{name}, {date}', dateTime: '{date} · {time}'};
const en = {today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', ...templates};
const pt = {today: 'Hoje', tomorrow: 'Amanhã', yesterday: 'Ontem', ...templates};

const allDay = (day: number, timeZone = SP): Due => ({at: midnightIn(2026, 10, day, timeZone), allDay: true, timeZone});
const at = (day: number, hour: number, minute = 0): Due => ({at: Date.UTC(2026, 9, day, hour + 3, minute), allDay: false, timeZone: SP});

let next = 0;
const task = (title: string, due: Due | null, priority: Priority = 0, listId = 'l'): Task => ({
  id: `t${next++}`,
  listId,
  title,
  notes: '',
  priority,
  due,
  tags: [],
  subtasks: [],
  sortOrder: next,
  completedAt: null,
});

describe('days and time zones', () => {
  it('finds midnight of a day in a time zone', () => {
    expect(midnightIn(2026, 10, 9, SP)).toBe(Date.UTC(2026, 9, 9, 3));
    expect(midnightIn(2026, 10, 9, 'UTC')).toBe(Date.UTC(2026, 9, 9));
    expect(midnightIn(2026, 1, 15, 'Asia/Tokyo')).toBe(Date.UTC(2026, 0, 14, 15));
    expect(dayKey(Date.UTC(2026, 9, 9, 2), SP)).toBe('2026-10-08');
  });

  it('reads an all-day task in its own time zone, a timed one in the device zone', () => {
    // Saved in Tokyo for October 10: still October 10 on a device in São Paulo.
    expect(formatDue(allDay(10, 'Asia/Tokyo'), clock, 'en', en)).toBe('Tomorrow');
    // 01:00 UTC on October 10 is 22:00 on October 9 in São Paulo.
    expect(formatDue({at: Date.UTC(2026, 9, 10, 1), allDay: false, timeZone: 'UTC'}, clock, 'en', en)).toBe('Today 22:00');
  });
});

describe('formatting', () => {
  it('names nearby days and shows dates otherwise, in en and pt', () => {
    expect(formatDue(at(9, 15), clock, 'en', en)).toBe('Today 15:00');
    expect(formatDue(at(9, 15), clock, 'en', en, true)).toBe('15:00');
    expect(formatDue(allDay(8), clock, 'en', en)).toBe('Yesterday');
    expect(formatDue(allDay(10), clock, 'pt', pt)).toBe('Amanhã');
    expect(formatDue(allDay(12), clock, 'en', en)).toBe('Mon, Oct 12');
    expect(formatDue(at(12, 9, 30), clock, 'pt', pt)).toBe('seg., 12 de out. 09:30');
    expect(formatDue({at: midnightIn(2027, 1, 5, SP), allDay: true, timeZone: SP}, clock, 'en', en)).toBe('Tue, Jan 5, 2027');
  });

  it('writes the long form for the task screen and the Edit field', () => {
    expect(formatDueLong(at(9, 15), clock, 'en', en)).toBe('Today, Oct 9 · 15:00');
    expect(formatDueLong(allDay(10), clock, 'pt', pt)).toBe('Amanhã, 10 de out.');
    expect(dueFieldText(at(9, 15), clock, 'en', en)).toBe('Today 15:00');
    expect(dueFieldText(null, clock, 'en', en)).toBe('');
  });

  it('tells overdue, today and the rest apart', () => {
    expect(dueTone(at(9, 9), clock)).toBe('overdue');
    expect(dueTone(at(9, 15), clock)).toBe('today');
    expect(dueTone(allDay(9), clock)).toBe('today');
    expect(dueTone(allDay(8), clock)).toBe('overdue');
    expect(dueTone(allDay(10), clock)).toBe('normal');
    expect(dueTone(null, clock)).toBe('normal');
  });
});

describe('Pending groups', () => {
  it('groups by day and sorts by due, then priority', () => {
    const tasks = [
      task('No date low', null, 1),
      task('Later', allDay(20)),
      task('Monday', allDay(12)),
      task('Today 15', at(9, 15), 0),
      task('Today all day high', allDay(9), 5),
      task('Today all day none', allDay(9), 0),
      task('Tomorrow', allDay(10)),
      task('Yesterday', allDay(8)),
      task('This morning', at(9, 8)),
      task('No date high', null, 5),
    ];
    const groups = groupTasks(tasks, clock);
    expect(groups.map(group => [group.key, group.day ?? '', group.tasks.map(entry => entry.title)])).toEqual([
      ['overdue', '', ['Yesterday', 'This morning']],
      ['today', '', ['Today all day high', 'Today all day none', 'Today 15']],
      ['tomorrow', '', ['Tomorrow']],
      ['day', '2026-10-12', ['Monday']],
      ['later', '', ['Later']],
      ['none', '', ['No date high', 'No date low']],
    ]);
    expect(countOverdue(tasks, clock)).toBe(2);
  });

  it('sorts by priority within the same moment', () => {
    const [low, high] = [task('Low', at(9, 15), 1), task('High', at(9, 15), 5)];
    expect([low, high].sort((a, b) => compareTasks(a, b, clock)).map(entry => entry.title)).toEqual(['High', 'Low']);
  });
});
