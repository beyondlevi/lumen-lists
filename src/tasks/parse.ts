// Turns dictated or written text into tasks, in English or Portuguese:
// "Call João tomorrow at 3 pm and pay the rent on Friday" →
// Call João (tomorrow 15:00) · Pay the rent (Friday, all day).
//
// - Tasks are split on new lines, ";" and commas (not a decimal comma). An
//   "and" / "e" / "&" splits only when both sides have a due date of their own.
// - The due date (chrono-node, en and pt) comes out of the title, with the
//   words that led to it ("on", "at", "na", "às"…). Without a time, the task is
//   due all day.
// - The first letter of the title is capitalized.
import * as chronoEn from 'chrono-node/en';
import * as chronoPt from 'chrono-node/pt';
import type {Due, NewTask} from '../ticktick/types';
import {midnightIn, type Clock, type Language} from './due';

type ParsedResult = ReturnType<typeof chronoEn.casual.parse>[number];

/** A due date found in a text: where it is, and what it means. */
export type FoundDue = {due: Due; index: number; length: number};

const CONNECTORS = new Set([
  'at', 'on', 'by', 'due', 'in', 'for', 'this', 'next', 'until', 'before',
  'às', 'as', 'à', 'a', 'na', 'no', 'em', 'até', 'dia', 'para', 'pra', 'próxima', 'próximo', 'proxima', 'proximo',
  'nesta', 'neste', 'esta', 'este', 'de', 'do', 'da', 'antes',
]);
const CONJUNCTIONS = new Set(['and', 'e', '&']);

/** Portuguese hours as chrono reads them: "15h" → "15:00", "15h30" → "15:30". */
export function normalizeHours(text: string): string {
  return text.replace(/\b(\d{1,2})\s?h(\d{2})?\b/gi, (_match, hours: string, minutes?: string) => `${hours}:${minutes ?? '00'}`);
}

export function capitalize(value: string, language: Language = 'en'): string {
  return value ? value.charAt(0).toLocaleUpperCase(language === 'pt' ? 'pt-BR' : 'en-US') + value.slice(1) : value;
}

function toDue(result: ParsedResult, clock: Clock): Due {
  if (result.start.isCertain('hour')) {
    return {at: result.start.date().getTime(), allDay: false, timeZone: clock.timeZone};
  }
  const year = result.start.get('year') ?? new Date(clock.now).getFullYear();
  const month = result.start.get('month') ?? 1;
  const day = result.start.get('day') ?? 1;
  return {at: midnightIn(year, month, day, clock.timeZone), allDay: true, timeZone: clock.timeZone};
}

/** The due date in `text` (already normalized), read in both languages; the longest match wins, the wearer's language first. */
export function findDue(text: string, clock: Clock, language: Language): FoundDue | null {
  const parsers = language === 'pt' ? [chronoPt.casual, chronoEn.casual] : [chronoEn.casual, chronoPt.casual];
  let best: ParsedResult | null = null;
  for (const parser of parsers) {
    for (const result of parser.parse(text, new Date(clock.now), {forwardDate: true})) {
      if (best == null || result.text.length > best.text.length) best = result;
    }
  }
  return best ? {due: toDue(best, clock), index: best.index, length: best.text.length} : null;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);

/** One piece of text as a task: the title without its due date, and the due date. Null when nothing is left. */
export function parseTask(piece: string, clock: Clock, language: Language): NewTask | null {
  const text = normalizeHours(piece.replace(/\s+/g, ' ').trim());
  if (text === '') return null;
  const found = findDue(text, clock, language);
  if (!found) return {title: capitalize(text, language), due: null};
  const before = words(text.slice(0, found.index));
  const after = words(text.slice(found.index + found.length));
  while (before.length > 0 && CONNECTORS.has(before[before.length - 1].toLowerCase())) before.pop();
  while (after.length > 0 && CONNECTORS.has(after[0].toLowerCase())) after.shift();
  const title = [...before, ...after].join(' ').replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '');
  if (title === '') return {title: capitalize(text, language), due: null};
  return {title: capitalize(title, language), due: found.due};
}

/** Splits one part at an "and"/"e" only when both sides have their own due date. */
function splitOnConjunction(part: string, clock: Clock, language: Language): string[] {
  const tokens = words(part);
  for (let index = 1; index < tokens.length - 1; index += 1) {
    if (!CONJUNCTIONS.has(tokens[index].toLowerCase())) continue;
    const left = tokens.slice(0, index).join(' ');
    const right = tokens.slice(index + 1).join(' ');
    if (findDue(normalizeHours(left), clock, language) && findDue(normalizeHours(right), clock, language)) {
      return [left, ...splitOnConjunction(right, clock, language)];
    }
  }
  return [part];
}

/** The pieces of text that are each one task. */
export function splitTasks(text: string, clock: Clock, language: Language): string[] {
  return text
    .split(/\r?\n|;|(?<!\d),|,(?!\d)/)
    .map(part => part.replace(/^[\s\-–•*]+|[\s.!?…]+$/g, '').trim())
    .filter(Boolean)
    .flatMap(part => splitOnConjunction(part, clock, language));
}

/** Every task understood in `text`. */
export function parseTasks(text: string, clock: Clock, language: Language): NewTask[] {
  return splitTasks(text, clock, language)
    .map(piece => parseTask(piece, clock, language))
    .filter((task): task is NewTask => task != null);
}

/** An Edit's Due field: empty clears the due date; text that is not a date is `invalid`. */
export function parseDueText(text: string, clock: Clock, language: Language): Due | null | 'invalid' {
  const value = normalizeHours(text.replace(/\s+/g, ' ').trim());
  if (value === '') return null;
  return findDue(value, clock, language)?.due ?? 'invalid';
}
