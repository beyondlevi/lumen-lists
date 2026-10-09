import {describe, expect, it} from 'vitest';
import {dayKey, formatDue, type Clock} from '../../src/tasks/due';
import {normalizeHours, parseDueText, parseTask, parseTasks, splitTasks} from '../../src/tasks/parse';
import type {NewTask} from '../../src/ticktick/types';

// The tests run with TZ=America/Sao_Paulo (see package.json), as chrono reads local time.
const SP = 'America/Sao_Paulo';
// Friday, October 9, 2026, 10:00 in São Paulo.
const clock: Clock = {now: Date.UTC(2026, 9, 9, 13), timeZone: SP};
const templates = {dayTime: '{day} {time}', namedDate: '{name}, {date}', dateTime: '{date} · {time}'};
const en = {today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', ...templates};

const show = (task: NewTask | null) =>
  task ? `${task.title}${task.due ? ` [${formatDue(task.due, clock, 'en', en)}${task.due.allDay ? ', all day' : ''}]` : ''}` : null;
const showAll = (text: string, language: 'en' | 'pt' = 'en') => parseTasks(text, clock, language).map(show);

describe('splitTasks', () => {
  it('splits on new lines, semicolons and commas', () => {
    expect(splitTasks('Buy milk, call Ana\nPay the rent; book flights.', clock, 'en')).toEqual(['Buy milk', 'call Ana', 'Pay the rent', 'book flights']);
    expect(splitTasks(' - first\n• second\n\n', clock, 'en')).toEqual(['first', 'second']);
  });

  it('splits on "and"/"e" only when both sides have their own due date', () => {
    expect(splitTasks('Call João tomorrow at 3 pm and pay the rent on Friday', clock, 'en')).toEqual(['Call João tomorrow at 3 pm', 'pay the rent on Friday']);
    expect(splitTasks('Buy milk and eggs tomorrow', clock, 'en')).toEqual(['Buy milk and eggs tomorrow']);
    expect(splitTasks('Ligar pro João amanhã às 15h e pagar o aluguel na segunda', clock, 'pt')).toEqual(['Ligar pro João amanhã às 15h', 'pagar o aluguel na segunda']);
    expect(splitTasks('Pão e manteiga', clock, 'pt')).toEqual(['Pão e manteiga']);
  });

  it('keeps a decimal comma', () => {
    expect(splitTasks('Pagar 1,5 mil hoje', clock, 'pt')).toEqual(['Pagar 1,5 mil hoje']);
  });
});

describe('parseTask', () => {
  it('takes the due date out of the title, in English', () => {
    expect(show(parseTask('Call João tomorrow at 3 pm', clock, 'en'))).toBe('Call João [Tomorrow 15:00]');
    expect(show(parseTask('pay the rent on Monday', clock, 'en'))).toBe('Pay the rent [Mon, Oct 12, all day]');
    expect(show(parseTask('dentist on October 20 at 9:30am', clock, 'en'))).toBe('Dentist [Tue, Oct 20 09:30]');
    expect(show(parseTask('send the report by next Wednesday', clock, 'en'))).toBe('Send the report [Wed, Oct 14, all day]');
    expect(show(parseTask('water the plants today', clock, 'en'))).toBe('Water the plants [Today, all day]');
  });

  it('takes the due date out of the title, in Portuguese', () => {
    expect(show(parseTask('ligar pro João amanhã às 15h', clock, 'pt'))).toBe('Ligar pro João [Tomorrow 15:00]');
    expect(show(parseTask('pagar o aluguel na segunda', clock, 'pt'))).toBe('Pagar o aluguel [Mon, Oct 12, all day]');
    expect(show(parseTask('dentista dia 20 de outubro', clock, 'pt'))).toBe('Dentista [Tue, Oct 20, all day]');
    expect(show(parseTask('reunião próxima terça às 10h30', clock, 'pt'))).toBe('Reunião [Tue, Oct 13 10:30]');
  });

  it('understands either language whatever the wearer’s is', () => {
    expect(show(parseTask('call Ana tomorrow', clock, 'pt'))).toBe('Call Ana [Tomorrow, all day]');
    expect(show(parseTask('ligar pra Ana amanhã', clock, 'en'))).toBe('Ligar pra Ana [Tomorrow, all day]');
  });

  it('keeps tasks without a date as they are, capitalized', () => {
    expect(show(parseTask('book flights to Lisbon', clock, 'en'))).toBe('Book flights to Lisbon');
    expect(show(parseTask('   ', clock, 'en'))).toBeNull();
  });

  it('keeps the text when nothing but a date is there', () => {
    expect(show(parseTask('tomorrow', clock, 'en'))).toBe('Tomorrow');
  });

  it('puts all-day tasks at midnight of their day in the device zone', () => {
    const task = parseTask('Pay the rent tomorrow', clock, 'en');
    expect(task?.due).toEqual({at: Date.UTC(2026, 9, 10, 3), allDay: true, timeZone: SP});
    expect(dayKey(task?.due?.at ?? 0, SP)).toBe('2026-10-10');
  });
});

describe('parseTasks', () => {
  it('reads the design example', () => {
    expect(showAll('Call João tomorrow at 3 pm and pay the rent on Monday')).toEqual(['Call João [Tomorrow 15:00]', 'Pay the rent [Mon, Oct 12, all day]']);
  });

  it('reads several Portuguese tasks', () => {
    expect(showAll('Ligar pro João amanhã às 15h e pagar o aluguel na segunda\ncomprar pão', 'pt')).toEqual([
      'Ligar pro João [Tomorrow 15:00]',
      'Pagar o aluguel [Mon, Oct 12, all day]',
      'Comprar pão',
    ]);
  });
});

describe('the Edit due field', () => {
  it('reads a date, clears with empty text and refuses what is not a date', () => {
    expect(parseDueText('tomorrow 3 pm', clock, 'en')).toEqual({at: Date.UTC(2026, 9, 10, 18), allDay: false, timeZone: SP});
    expect(parseDueText('amanhã 15h', clock, 'pt')).toEqual({at: Date.UTC(2026, 9, 10, 18), allDay: false, timeZone: SP});
    expect(parseDueText('Today 15:00', clock, 'en')).toEqual({at: Date.UTC(2026, 9, 9, 18), allDay: false, timeZone: SP});
    expect(parseDueText('  ', clock, 'en')).toBeNull();
    expect(parseDueText('banana', clock, 'en')).toBe('invalid');
  });

  it('turns Portuguese hours into what chrono reads', () => {
    expect(normalizeHours('às 15h e às 9h30')).toBe('às 15:00 e às 9:30');
  });
});
