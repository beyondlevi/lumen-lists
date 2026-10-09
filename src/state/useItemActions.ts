import {Toast} from '@wearables-ui-toolkit/mrbd';
import {useCallback, useMemo, useRef} from 'react';
import {t, tp} from '../i18n/strings';
import type {Item, ListsApi, NewItem} from '../ticktick/types';
import {asError, insertBySortOrder} from './resource';
import type {ListsData} from './useListsData';

export type ItemActions = {
  /** Puts an item in the cart at once; rolls back with a toast if TickTick refuses. */
  complete(item: Item): Promise<boolean>;
  /** Puts a cart item back in its list at once; rolls back with a toast if TickTick refuses. */
  reopen(item: Item): Promise<boolean>;
  addItems(listId: string, items: NewItem[]): Promise<boolean>;
  updateItem(item: Item, change: NewItem): Promise<boolean>;
  removeItem(item: Item): Promise<boolean>;
  /** The new list's id, or null when it failed. */
  createList(name: string): Promise<string | null>;
};

const byCompletion = (a: Item, b: Item) => (b.completedAt ?? 0) - (a.completedAt ?? 0);

export function useItemActions(api: ListsApi | null, data: ListsData): ItemActions {
  const {open, setOpen, setCarts, setLists, setRefused, loadList} = data;
  const openRef = useRef(open);
  openRef.current = open;

  const fail = useCallback(
    (error: unknown, message: string) => {
      if (asError(error).kind === 'auth') {
        setRefused(true);
      } else {
        Toast.show(message);
      }
    },
    [setRefused],
  );

  return useMemo<ItemActions>(() => {
    const change = (setter: typeof setOpen) => (listId: string, edit: (items: Item[]) => Item[]) =>
      setter(previous => {
        const current = previous[listId];
        return current?.data ? {...previous, [listId]: {...current, data: edit(current.data)}} : previous;
      });
    const setOpenItems = change(setOpen);
    const setCartItems = change(setCarts);
    const without = (id: string) => (items: Item[]) => items.filter(entry => entry.id !== id);

    return {
      async complete(item) {
        if (!api) return false;
        setOpenItems(item.listId, without(item.id));
        setCartItems(item.listId, items => [{...item, completedAt: Date.now()}, ...without(item.id)(items)]);
        try {
          await api.complete(item);
          return true;
        } catch (error) {
          setOpenItems(item.listId, items => insertBySortOrder(items, item));
          setCartItems(item.listId, without(item.id));
          fail(error, t('completeFailed', {title: item.title}));
          return false;
        }
      },

      async reopen(item) {
        if (!api) return false;
        setCartItems(item.listId, without(item.id));
        setOpenItems(item.listId, items => insertBySortOrder(items, {...item, completedAt: null}));
        try {
          const result = await api.reopen(item);
          setOpenItems(item.listId, items => insertBySortOrder(without(item.id)(items), result.item));
          return true;
        } catch (error) {
          setOpenItems(item.listId, without(item.id));
          setCartItems(item.listId, items => [item, ...without(item.id)(items)].sort(byCompletion));
          fail(error, t('reopenFailed', {title: item.title}));
          return false;
        }
      },

      async addItems(listId, items) {
        if (!api || items.length === 0) return false;
        const current = openRef.current[listId]?.data ?? [];
        const after = current.length > 0 ? Math.max(...current.map(entry => entry.sortOrder)) : undefined;
        try {
          await api.addItems(listId, items, after);
          Toast.show(tp('added', items.length));
          loadList(listId, {silent: true});
          return true;
        } catch (error) {
          fail(error, t('addFailed'));
          return false;
        }
      },

      async updateItem(item, next) {
        if (!api) return false;
        try {
          const updated = await api.update(item, next);
          setOpenItems(item.listId, items =>
            items.map(entry => (entry.id === item.id ? {...updated, sortOrder: entry.sortOrder, completedAt: null} : entry)),
          );
          Toast.show(t('saved'));
          return true;
        } catch (error) {
          fail(error, t('saveFailed'));
          return false;
        }
      },

      async removeItem(item) {
        if (!api) return false;
        try {
          await api.remove(item);
          setOpenItems(item.listId, without(item.id));
          Toast.show(t('deleted', {title: item.title}));
          return true;
        } catch (error) {
          fail(error, t('deleteFailed', {title: item.title}));
          return false;
        }
      },

      async createList(name) {
        if (!api) return null;
        try {
          const list = await api.createList(name);
          setLists(previous => ({status: 'ready', data: [...(previous?.data ?? []), list], error: null}));
          setOpen(previous => ({...previous, [list.id]: {status: 'ready', data: [], error: null}}));
          setCarts(previous => ({...previous, [list.id]: {status: 'ready', data: [], error: null}}));
          Toast.show(t('listCreated', {name: list.name}));
          return list.id;
        } catch (error) {
          fail(error, t('createFailed'));
          return null;
        }
      },
    };
  }, [api, fail, loadList, setCarts, setLists, setOpen]);
}
