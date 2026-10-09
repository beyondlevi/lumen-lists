// Turns dictated or written text into shopping items, in English or
// Portuguese: "Milk, two kilos of rice and coffee filters" →
// Milk · Rice (2 kg) · Coffee filters.
//
// - Items are split on new lines, semicolons, commas (not a decimal comma) and
//   the last "and" / "e" / "&" of each line.
// - A leading quantity becomes the item's note: a number (digits, a fraction or
//   number words, "twenty-five", "vinte e cinco"), optionally a unit ("kilos",
//   "kg", "caixas", "a dozen", "meia dúzia") and "of" / "de".
// - The first letter of the title is capitalized.
import type {Item, NewItem} from '../ticktick/types';

export type ReviewItem = NewItem & {
  /** Already open in the list: it is not added again. */
  duplicate: boolean;
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
  dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100,
};
/** "a", "um": one only when a unit follows ("a kilo of"); otherwise just an article. */
const ARTICLES = new Set(['a', 'an', 'um', 'uma']);
const HALF = new Set(['half', 'meio', 'meia']);
const FILLERS = new Set(['some', 'the', 'uns', 'umas', 'alguns', 'algumas', 'o', 'os', 'as']);
const CONNECTORS = new Set(['of', 'de', 'do', 'da', 'dos', 'das']);
const CONJUNCTIONS = new Set(['and', 'e', '&']);
const FRACTIONS: Record<string, number> = {'½': 0.5, '¼': 0.25, '¾': 0.75};

type Unit = {symbol: string} | {one: string; other: string} | {dozen: true};
const symbol = (value: string): Unit => ({symbol: value});
const word = (one: string, other: string): Unit => ({one, other});
const DOZEN: Unit = {dozen: true};

const UNITS: Record<string, Unit> = {};
const addUnit = (unit: Unit, ...names: string[]) => names.forEach(name => (UNITS[name] = unit));
addUnit(symbol('kg'), 'kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'quilo', 'quilos', 'quilograma', 'quilogramas');
addUnit(symbol('g'), 'g', 'gr', 'gram', 'grams', 'grama', 'gramas');
addUnit(symbol('lb'), 'lb', 'lbs', 'pound', 'pounds');
addUnit(symbol('oz'), 'oz', 'ounce', 'ounces');
addUnit(symbol('L'), 'l', 'liter', 'liters', 'litre', 'litres', 'litro', 'litros');
addUnit(symbol('ml'), 'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'mililitro', 'mililitros');
addUnit(DOZEN, 'dozen', 'dozens', 'duzia', 'duzias');
for (const [one, other] of [
  ['box', 'boxes'], ['pack', 'packs'], ['packet', 'packets'], ['bottle', 'bottles'], ['can', 'cans'],
  ['tin', 'tins'], ['bag', 'bags'], ['jar', 'jars'], ['tub', 'tubs'], ['loaf', 'loaves'], ['bunch', 'bunches'],
  ['carton', 'cartons'], ['roll', 'rolls'], ['piece', 'pieces'], ['slice', 'slices'],
  ['caixa', 'caixas'], ['pacote', 'pacotes'], ['garrafa', 'garrafas'], ['lata', 'latas'], ['saco', 'sacos'],
  ['pote', 'potes'], ['vidro', 'vidros'], ['maço', 'maços'], ['rolo', 'rolos'], ['unidade', 'unidades'],
  ['bandeja', 'bandejas'], ['fatia', 'fatias'], ['pacotinho', 'pacotinhos'],
] as const) {
  addUnit(word(one, other), one, other);
}

/** Lowercase without accents, to compare words. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const numberWord = (token: string | undefined): number | undefined => (token ? NUMBER_WORDS[fold(token)] : undefined);
const isTens = (value: number | undefined) => value !== undefined && value >= 20 && value < 100 && value % 10 === 0;
const isUnits = (value: number | undefined) => value !== undefined && value >= 1 && value <= 9;

/** "vinte e cinco": an "e"/"and" inside a number, not between items. */
function joinsNumber(before: string | undefined, after: string | undefined): boolean {
  const next = fold(after ?? '');
  return isTens(numberWord(before)) && (isUnits(numberWord(after)) || next === 'um' || next === 'uma');
}

/** Splits one line at its last "and" / "e" / "&" that is not inside a number. */
function splitLastConjunction(part: string): string[] {
  const words = part.split(/\s+/);
  for (let index = words.length - 2; index >= 1; index -= 1) {
    if (CONJUNCTIONS.has(fold(words[index])) && !joinsNumber(words[index - 1], words[index + 1])) {
      return [words.slice(0, index).join(' '), words.slice(index + 1).join(' ')];
    }
  }
  return [part];
}

/** The pieces of text that are each one item. */
export function splitItems(text: string): string[] {
  const pieces: string[] = [];
  for (const line of text.split(/\r?\n|;/)) {
    const parts = line
      .split(/(?<!\d),|,(?!\d)/)
      .map(part => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      continue;
    }
    const last = parts.pop() ?? '';
    const lastWords = last.split(/\s+/);
    if (parts.length > 0 && lastWords.length > 1 && CONJUNCTIONS.has(fold(lastWords[0]))) {
      // "milk, eggs, and bread": the last "and" opens the last part.
      pieces.push(...parts, lastWords.slice(1).join(' '));
    } else {
      pieces.push(...parts, ...splitLastConjunction(last));
    }
  }
  return pieces.map(piece => piece.replace(/^[\s\-–•*.]+|[\s.!?…]+$/g, '').trim()).filter(Boolean);
}

type Quantity = {value: number; article: boolean; next: number};

function readNumber(tokens: string[], start: number): Quantity | null {
  const token = tokens[start];
  if (token === undefined) {
    return null;
  }
  const folded = fold(token);
  if (token in FRACTIONS) {
    return {value: FRACTIONS[token], article: false, next: start + 1};
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(token);
  if (fraction && Number(fraction[2]) > 0) {
    return {value: Number(fraction[1]) / Number(fraction[2]), article: false, next: start + 1};
  }
  if (/^\d+(?:[.,]\d+)?$/.test(token)) {
    return {value: Number(token.replace(',', '.')), article: false, next: start + 1};
  }
  if (HALF.has(folded)) {
    // "half a kilo"
    const next = ARTICLES.has(fold(tokens[start + 1] ?? '')) ? start + 2 : start + 1;
    return {value: 0.5, article: false, next};
  }
  if (ARTICLES.has(folded)) {
    if (fold(tokens[start + 1] ?? '') === 'hundred') {
      return {value: 100, article: false, next: start + 2};
    }
    return {value: 1, article: true, next: start + 1};
  }
  const value = numberWord(token);
  if (value === undefined) {
    return null;
  }
  if (isTens(value)) {
    // "twenty five", "twenty-five" (split before), "vinte e cinco"
    const joined = CONJUNCTIONS.has(fold(tokens[start + 1] ?? '')) ? start + 2 : start + 1;
    const unit = fold(tokens[joined] ?? '');
    const ones = unit === 'um' || unit === 'uma' ? 1 : numberWord(tokens[joined]);
    if (isUnits(ones)) {
      return {value: value + (ones ?? 0), article: false, next: joined + 1};
    }
  }
  return {value, article: false, next: start + 1};
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {maximumFractionDigits: 2}).format(value);
}

export function capitalize(value: string, locale = 'en'): string {
  return value ? value.charAt(0).toLocaleUpperCase(locale) + value.slice(1) : value;
}

/** One piece of text as an item: its title and, when said, its quantity. Null when nothing is left. */
export function parseItem(piece: string, locale = 'en'): NewItem | null {
  const source = piece
    .replace(/(\d)(\p{L}+)/gu, (match, digit: string, unit: string) => (fold(unit) in UNITS ? `${digit} ${unit}` : match))
    .replace(/(\p{L}+)-(\p{L}+)/gu, (match, a: string, b: string) => (numberWord(a) !== undefined ? `${a} ${b}` : match))
    .replace(/\s+/g, ' ')
    .trim();
  if (source === '') {
    return null;
  }
  const tokens = source.split(' ');
  let index = 0;
  while (index < tokens.length - 1 && FILLERS.has(fold(tokens[index]))) {
    index += 1;
  }
  let note = '';
  const amount = readNumber(tokens, index);
  if (amount && amount.next < tokens.length) {
    const unit = UNITS[fold(tokens[amount.next])];
    let next = amount.next;
    if (unit && amount.next < tokens.length - 1) {
      next += 1;
      if ('dozen' in unit) {
        note = formatNumber(amount.value * 12, locale);
      } else if ('symbol' in unit) {
        note = `${formatNumber(amount.value, locale)} ${unit.symbol}`;
      } else {
        note = `${formatNumber(amount.value, locale)} ${amount.value === 1 ? unit.one : unit.other}`;
      }
    } else if (!amount.article) {
      note = formatNumber(amount.value, locale);
    }
    if (next < tokens.length - 1 && CONNECTORS.has(fold(tokens[next])) && (unit || !amount.article)) {
      next += 1;
    }
    index = next;
  }
  const title = tokens.slice(index).join(' ').trim();
  if (title === '') {
    return {title: capitalize(source, locale), note: ''};
  }
  return {title: capitalize(title, locale), note};
}

/** A title as compared for duplicates: no case, accents, extra spaces or plural "s". */
export function itemKey(title: string): string {
  const folded = fold(title).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return folded.length > 3 ? folded.replace(/(?:es|s)$/, '') : folded;
}

/** Everything understood in `text`, each item once, marking those already open in the list. */
export function reviewItems(text: string, open: readonly Item[], locale = 'en'): ReviewItem[] {
  const openKeys = new Set(open.map(item => itemKey(item.title)));
  const seen = new Set<string>();
  const items: ReviewItem[] = [];
  for (const piece of splitItems(text)) {
    const item = parseItem(piece, locale);
    if (item == null) {
      continue;
    }
    const key = itemKey(item.title);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({...item, duplicate: openKeys.has(key)});
  }
  return items;
}

/** Whether a note is only a quantity ("2 kg", "12", "3 boxes"). */
export function isQuantity(note: string, locale = 'en'): boolean {
  if (note.trim() === '') {
    return false;
  }
  const probe = parseItem(`${note} x`, locale);
  return probe != null && probe.note !== '' && probe.title === 'X';
}

/** The text an item's Edit starts from: "2 kg Rice", or the title alone when its note is not a quantity. */
export function editText(item: Pick<Item, 'title' | 'note'>, locale = 'en'): string {
  return isQuantity(item.note, locale) ? `${item.note} ${item.title}` : item.title;
}

/** The edited item. A note that was not a quantity is kept unless a quantity was said. */
export function parseEdit(text: string, original: Pick<Item, 'note'>, locale = 'en'): NewItem | null {
  const item = parseItem(text.replace(/\s+/g, ' ').trim(), locale);
  if (item == null) {
    return null;
  }
  if (item.note === '' && !isQuantity(original.note, locale)) {
    return {...item, note: original.note};
  }
  return item;
}
