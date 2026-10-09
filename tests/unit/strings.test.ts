import {describe, expect, it} from 'vitest';
import {dictionaryKeys, resolveLocale, translate, translatePlural} from '../../src/i18n/strings';
import {createDemoClient} from '../../src/demo/demoClient';

describe('strings', () => {
  it('has the same keys in English and Portuguese', () => {
    expect([...dictionaryKeys.pt].sort()).toEqual([...dictionaryKeys.en].sort());
  });

  it('keeps the same placeholders in both languages', () => {
    for (const key of dictionaryKeys.en) {
      const names = (target: 'en' | 'pt') =>
        [...translate(target, key as Parameters<typeof translate>[1]).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      expect(names('pt'), key).toEqual(names('en'));
    }
  });

  it('picks the language, English by default', () => {
    expect(resolveLocale(['pt-BR'])).toBe('pt');
    expect(resolveLocale(['pt-PT'])).toBe('pt');
    expect(resolveLocale(['fr-FR', 'en-GB'])).toBe('en');
    expect(resolveLocale(['de'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });

  it('fills placeholders and plurals', () => {
    expect(translatePlural('en', 'toBuy', 12)).toBe('12 to buy');
    expect(translatePlural('en', 'reviewHeader', 1)).toBe('Add 1 item');
    expect(translatePlural('en', 'reviewHeader', 3)).toBe('Add 3 items');
    expect(translatePlural('pt', 'added', 2)).toBe('2 itens adicionados');
    expect(translate('en', 'left', {left: 7, total: 12})).toBe('7 of 12 left');
    expect(translate('pt', 'left', {left: 7, total: 12})).toBe('faltam 7 de 12');
  });
});

describe('demo mode', () => {
  it('has three lists with open items and a cart, in both languages', async () => {
    for (const language of ['en', 'pt'] as const) {
      const demo = createDemoClient(language, Date.now());
      const lists = await demo.lists();
      expect(lists).toHaveLength(3);
      expect(await demo.openItems(lists[0].id)).toHaveLength(7);
      expect(await demo.cart(lists[0].id)).toHaveLength(5);
      expect(await demo.openItems(lists[2].id)).toHaveLength(0);
    }
  });

  it('changes only its own copy', async () => {
    const demo = createDemoClient('en');
    const [groceries] = await demo.lists();
    const [first] = await demo.openItems(groceries.id);
    await demo.complete(first);
    expect(await demo.openItems(groceries.id)).toHaveLength(6);
    expect((await demo.cart(groceries.id))[0].title).toBe(first.title);
    await demo.reopen({...first, completedAt: Date.now()});
    expect(await demo.openItems(groceries.id)).toHaveLength(7);
    expect((await createDemoClient('en').openItems(groceries.id))).toHaveLength(7);
  });
});
