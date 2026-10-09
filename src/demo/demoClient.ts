// Demo mode: fictional lists kept in memory, with no network and nothing
// stored. Every change (cart, add, edit, delete, new list) changes only this
// copy and is gone when the app closes.
import fixtures from './fixtures.json';
import {SORT_STEP} from '../ticktick/client';
import {TickTickError, type Item, type List, type ListsApi} from '../ticktick/types';

type Fixture = {id: string; name: string; open: {title: string; note: string}[]; cart: {title: string; note: string; minutesAgo: number}[]};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A short pause, so loading states show as they would with TickTick. */
const DELAY_MS = 120;

const wait = () => new Promise(resolve => setTimeout(resolve, DELAY_MS));

export function createDemoClient(language: 'en' | 'pt', now = Date.now()): ListsApi {
  const source: Fixture[] = (fixtures as Record<string, Fixture[]>)[language] ?? fixtures.en;
  const lists: List[] = source.map(({id, name}) => ({id, name}));
  let items: Item[] = source.flatMap(list => [
    ...list.open.map((entry, index) => ({
      id: `${list.id}-open-${index}`,
      listId: list.id,
      title: entry.title,
      note: entry.note,
      sortOrder: (index + 1) * SORT_STEP,
      completedAt: null,
    })),
    ...list.cart.map((entry, index) => ({
      id: `${list.id}-cart-${index}`,
      listId: list.id,
      title: entry.title,
      note: entry.note,
      sortOrder: (list.open.length + index + 1) * SORT_STEP,
      completedAt: now - entry.minutesAgo * 60_000,
    })),
  ]);
  let nextId = 1;
  const find = (id: string) => {
    const item = items.find(entry => entry.id === id);
    if (!item) throw new TickTickError('notfound', 404);
    return item;
  };
  const replace = (next: Item) => {
    items = items.map(entry => (entry.id === next.id ? next : entry));
  };

  return {
    async lists() {
      await wait();
      return lists.map(list => ({...list}));
    },
    async openItems(listId) {
      await wait();
      if (!lists.some(list => list.id === listId)) throw new TickTickError('notfound', 404);
      return items.filter(item => item.listId === listId && item.completedAt == null).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async cart(listId, at = Date.now()) {
      await wait();
      return items
        .filter(item => item.listId === listId && item.completedAt != null && item.completedAt >= at - DAY_MS)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    },
    async addItems(listId, added, afterSortOrder = 0) {
      await wait();
      items = [
        ...items,
        ...added.map((entry, index) => ({
          id: `demo-new-${nextId++}`,
          listId,
          title: entry.title,
          note: entry.note,
          sortOrder: afterSortOrder + (index + 1) * SORT_STEP,
          completedAt: null,
        })),
      ];
    },
    async complete(item) {
      await wait();
      replace({...find(item.id), completedAt: Date.now()});
    },
    async reopen(item) {
      await wait();
      const reopened = {...find(item.id), completedAt: null};
      replace(reopened);
      return {path: 'updated', item: reopened};
    },
    async update(item, change) {
      await wait();
      const updated = {...find(item.id), title: change.title, note: change.note};
      replace(updated);
      return updated;
    },
    async remove(item) {
      await wait();
      items = items.filter(entry => entry.id !== item.id);
    },
    async createList(name) {
      await wait();
      const list = {id: `demo-list-${nextId++}`, name};
      lists.push(list);
      return {...list};
    },
  };
}
