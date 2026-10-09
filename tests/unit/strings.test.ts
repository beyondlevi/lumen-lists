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
    expect(translatePlural('en', 'pendingCount', 7)).toBe('7 pending');
    expect(translatePlural('pt', 'pendingCount', 1)).toBe('1 pendente');
    expect(translatePlural('pt', 'overdueCount', 2)).toBe('2 atrasadas');
    expect(translatePlural('en', 'reviewHeader', 1)).toBe('Add 1 task');
    expect(translatePlural('en', 'reviewHeader', 2)).toBe('Add 2 tasks');
    expect(translatePlural('pt', 'added', 2)).toBe('2 tarefas adicionadas');
    expect(translate('en', 'completedMeta', {list: 'Work', count: 5})).toBe('Work · 5');
  });

  it('says nothing about shopping', () => {
    for (const language of ['en', 'pt'] as const) {
      for (const key of dictionaryKeys.en) {
        expect(translate(language, key as Parameters<typeof translate>[1])).not.toMatch(/to buy|\bcart\b|carrinho|comprad|bought/i);
      }
    }
  });
});

describe('demo mode', () => {
  it('has the Inbox and four lists, with pending and completed tasks, in both languages', async () => {
    for (const language of ['en', 'pt'] as const) {
      const demo = createDemoClient(language, Date.UTC(2026, 9, 9, 13), 'America/Sao_Paulo');
      const lists = await demo.lists();
      const inbox = await demo.inbox();
      expect(inbox.list.inbox).toBe(true);
      expect(inbox.tasks).toHaveLength(3);
      expect(lists.map(list => list.inbox)).toEqual([false, false, false, false]);
      expect(await demo.pendingTasks(lists[0].id)).toHaveLength(7);
      expect(await demo.completedTasks(lists[0].id, Date.UTC(2026, 9, 9, 13))).toHaveLength(5);
      expect(await demo.pendingTasks(lists[3].id)).toHaveLength(0);
    }
  });

  it('dates the demo tasks from today: overdue, today at 15:00, tomorrow', async () => {
    const now = Date.UTC(2026, 9, 9, 13);
    const demo = createDemoClient('en', now, 'America/Sao_Paulo');
    const [work] = await demo.lists();
    const [proposal, call, review] = await demo.pendingTasks(work.id);
    expect(proposal.due).toEqual({at: Date.UTC(2026, 9, 8, 3), allDay: true, timeZone: 'America/Sao_Paulo'});
    expect(call.due).toEqual({at: Date.UTC(2026, 9, 9, 18), allDay: false, timeZone: 'America/Sao_Paulo'});
    expect(call.subtasks.filter(subtask => subtask.done)).toHaveLength(1);
    expect(review.due?.allDay).toBe(true);
  });

  it('changes only its own copy', async () => {
    const demo = createDemoClient('en');
    const [work] = await demo.lists();
    const [first] = await demo.pendingTasks(work.id);
    await demo.complete(first);
    expect(await demo.pendingTasks(work.id)).toHaveLength(6);
    await demo.reopen(first);
    expect(await demo.pendingTasks(work.id)).toHaveLength(7);
    await demo.update(first, {title: first.title, due: null, priority: 0, listId: 'demo-personal'});
    expect(await demo.pendingTasks('demo-personal')).toHaveLength(2);
    expect(await createDemoClient('en').pendingTasks(work.id)).toHaveLength(7);
  });
});
