import {describe, expect, it} from 'vitest';
import {capitalize, editText, isQuantity, itemKey, parseEdit, parseItem, reviewItems, splitItems} from '../../src/items/parse';
import type {Item} from '../../src/ticktick/types';

const item = (title: string, note = ''): Item => ({id: title, listId: 'l', title, note, sortOrder: 0, completedAt: null});

describe('splitItems', () => {
  it('splits on commas, new lines and the last "and"', () => {
    expect(splitItems('Milk, two kilos of rice and coffee filters')).toEqual(['Milk', 'two kilos of rice', 'coffee filters']);
    expect(splitItems('milk\neggs\nbread and butter')).toEqual(['milk', 'eggs', 'bread', 'butter']);
    expect(splitItems('milk, eggs, and bread.')).toEqual(['milk', 'eggs', 'bread']);
    expect(splitItems('apples; pears')).toEqual(['apples', 'pears']);
  });

  it('splits Portuguese on the last "e"', () => {
    expect(splitItems('leite, dois quilos de arroz e filtro de café')).toEqual(['leite', 'dois quilos de arroz', 'filtro de café']);
    expect(splitItems('pão e manteiga')).toEqual(['pão', 'manteiga']);
  });

  it('only splits on the last "and" of a line', () => {
    expect(splitItems('salt and pepper chips, milk and eggs')).toEqual(['salt and pepper chips', 'milk', 'eggs']);
  });

  it('keeps a decimal comma and a number with "e" together', () => {
    expect(splitItems('1,5 kg de carne, arroz')).toEqual(['1,5 kg de carne', 'arroz']);
    expect(splitItems('vinte e cinco ovos')).toEqual(['vinte e cinco ovos']);
  });

  it('drops empty pieces and list markers', () => {
    expect(splitItems(' ,\n - milk \n\n• eggs ,')).toEqual(['milk', 'eggs']);
    expect(splitItems('')).toEqual([]);
  });
});

describe('parseItem in English', () => {
  it('turns a leading quantity into the note', () => {
    expect(parseItem('two kilos of rice')).toEqual({title: 'Rice', note: '2 kg'});
    expect(parseItem('2kg rice')).toEqual({title: 'Rice', note: '2 kg'});
    expect(parseItem('500 g of cheese')).toEqual({title: 'Cheese', note: '500 g'});
    expect(parseItem('three boxes of oat milk')).toEqual({title: 'Oat milk', note: '3 boxes'});
    expect(parseItem('one bottle of wine')).toEqual({title: 'Wine', note: '1 bottle'});
    expect(parseItem('a kilo of apples')).toEqual({title: 'Apples', note: '1 kg'});
    expect(parseItem('half a kilo of tomatoes')).toEqual({title: 'Tomatoes', note: '0.5 kg'});
    expect(parseItem('1.5 liters of milk')).toEqual({title: 'Milk', note: '1.5 L'});
  });

  it('reads plain numbers and number words', () => {
    expect(parseItem('12 eggs')).toEqual({title: 'Eggs', note: '12'});
    expect(parseItem('six bananas')).toEqual({title: 'Bananas', note: '6'});
    expect(parseItem('twenty-five paper plates')).toEqual({title: 'Paper plates', note: '25'});
    expect(parseItem('twenty five paper plates')).toEqual({title: 'Paper plates', note: '25'});
    expect(parseItem('a dozen eggs')).toEqual({title: 'Eggs', note: '12'});
    expect(parseItem('half a dozen eggs')).toEqual({title: 'Eggs', note: '6'});
    expect(parseItem('½ kg of butter')).toEqual({title: 'Butter', note: '0.5 kg'});
  });

  it('drops articles and keeps items without a quantity as they are', () => {
    expect(parseItem('a watermelon')).toEqual({title: 'Watermelon', note: ''});
    expect(parseItem('some coffee filters')).toEqual({title: 'Coffee filters', note: ''});
    expect(parseItem('milk')).toEqual({title: 'Milk', note: ''});
    expect(parseItem('7up')).toEqual({title: '7up', note: ''});
  });

  it('keeps the text when nothing but a quantity is there', () => {
    expect(parseItem('12')).toEqual({title: '12', note: ''});
    expect(parseItem('  ')).toBeNull();
  });
});

describe('parseItem in Portuguese', () => {
  it('turns a leading quantity into the note', () => {
    expect(parseItem('2 kg de arroz', 'pt')).toEqual({title: 'Arroz', note: '2 kg'});
    expect(parseItem('dois quilos de arroz', 'pt')).toEqual({title: 'Arroz', note: '2 kg'});
    expect(parseItem('duas caixas de leite', 'pt')).toEqual({title: 'Leite', note: '2 caixas'});
    expect(parseItem('uma garrafa de azeite', 'pt')).toEqual({title: 'Azeite', note: '1 garrafa'});
    expect(parseItem('meio quilo de queijo', 'pt')).toEqual({title: 'Queijo', note: '0,5 kg'});
    expect(parseItem('1,5 kg de carne', 'pt')).toEqual({title: 'Carne', note: '1,5 kg'});
    expect(parseItem('três latas de atum', 'pt')).toEqual({title: 'Atum', note: '3 latas'});
  });

  it('reads number words, dozens and compounds', () => {
    expect(parseItem('seis bananas', 'pt')).toEqual({title: 'Bananas', note: '6'});
    expect(parseItem('uma dúzia de ovos', 'pt')).toEqual({title: 'Ovos', note: '12'});
    expect(parseItem('meia dúzia de ovos', 'pt')).toEqual({title: 'Ovos', note: '6'});
    expect(parseItem('vinte e cinco pratos', 'pt')).toEqual({title: 'Pratos', note: '25'});
    expect(parseItem('vinte e um copos', 'pt')).toEqual({title: 'Copos', note: '21'});
  });

  it('drops articles', () => {
    expect(parseItem('uma melancia', 'pt')).toEqual({title: 'Melancia', note: ''});
    expect(parseItem('filtro de café', 'pt')).toEqual({title: 'Filtro de café', note: ''});
    expect(parseItem('óleo', 'pt')).toEqual({title: 'Óleo', note: ''});
  });
});

describe('reviewItems', () => {
  it('parses the whole text and marks what is already open', () => {
    const open = [item('Milk', '2 boxes'), item('Tomatoes', '1 kg')];
    expect(reviewItems('Milk, two kilos of rice and coffee filters', open)).toEqual([
      {title: 'Milk', note: '', duplicate: true},
      {title: 'Rice', note: '2 kg', duplicate: false},
      {title: 'Coffee filters', note: '', duplicate: false},
    ]);
    expect(reviewItems('a tomato', open)[0].duplicate).toBe(true);
  });

  it('keeps each item once', () => {
    expect(reviewItems('milk, Milk and MILK', [])).toEqual([{title: 'Milk', note: '', duplicate: false}]);
  });

  it('works in Portuguese with accents', () => {
    const open = [item('Pão')];
    expect(reviewItems('pao, dois quilos de arroz e meia dúzia de ovos', open, 'pt')).toEqual([
      {title: 'Pao', note: '', duplicate: true},
      {title: 'Arroz', note: '2 kg', duplicate: false},
      {title: 'Ovos', note: '6', duplicate: false},
    ]);
  });
});

describe('edit text', () => {
  it('starts from the quantity and the title', () => {
    expect(editText(item('Milk', '2 boxes'))).toBe('2 boxes Milk');
    expect(editText(item('Eggs', '12'))).toBe('12 Eggs');
    expect(editText(item('Toilet paper', 'the big pack'))).toBe('Toilet paper');
    expect(editText(item('Bread'))).toBe('Bread');
  });

  it('round-trips through parseEdit', () => {
    expect(parseEdit('2 boxes Milk', item('Milk', '2 boxes'))).toEqual({title: 'Milk', note: '2 boxes'});
    expect(parseEdit('three boxes of oat milk', item('Milk', '2 boxes'))).toEqual({title: 'Oat milk', note: '3 boxes'});
    expect(parseEdit('Milk', item('Milk', '2 boxes'))).toEqual({title: 'Milk', note: ''});
  });

  it('keeps a note that is not a quantity unless a quantity is said', () => {
    expect(parseEdit('Kitchen paper', item('Toilet paper', 'the big pack'))).toEqual({title: 'Kitchen paper', note: 'the big pack'});
    expect(parseEdit('2 rolls of kitchen paper', item('Toilet paper', 'the big pack'))).toEqual({title: 'Kitchen paper', note: '2 rolls'});
    expect(parseEdit('   ', item('Bread'))).toBeNull();
  });

  it('knows what a quantity is', () => {
    expect(isQuantity('2 kg')).toBe(true);
    expect(isQuantity('12')).toBe(true);
    expect(isQuantity('2 caixas', 'pt')).toBe(true);
    expect(isQuantity('organic')).toBe(false);
    expect(isQuantity('')).toBe(false);
  });
});

describe('helpers', () => {
  it('capitalizes the first letter only', () => {
    expect(capitalize('coffee filters')).toBe('Coffee filters');
    expect(capitalize('iPhone case')).toBe('IPhone case');
    expect(capitalize('')).toBe('');
  });

  it('compares titles without case, accents and plural', () => {
    expect(itemKey('Tomatoes')).toBe(itemKey('tomato'));
    expect(itemKey('Maçãs')).toBe(itemKey('maca'));
    expect(itemKey('Coffee  filters!')).toBe(itemKey('coffee filter'));
  });
});
