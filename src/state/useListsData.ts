import {useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {TickTickError, type Item, type List, type ListsApi, type ListSummary} from '../ticktick/types';
import {asError, CACHE_KEY, inBatches, loading, readCache, RETRY_DELAYS_MS, settled, writeStorage, type LoadOptions, type Resource} from './resource';

export type ListsData = {
  lists: Resource<ListSummary[]> | null;
  open: Record<string, Resource<Item[]>>;
  carts: Record<string, Resource<Item[]>>;
  setLists: Dispatch<SetStateAction<Resource<List[]> | null>>;
  setOpen: Dispatch<SetStateAction<Record<string, Resource<Item[]>>>>;
  setCarts: Dispatch<SetStateAction<Record<string, Resource<Item[]>>>>;
  loadLists(options?: LoadOptions): void;
  loadList(listId: string, options?: LoadOptions): void;
  loadCart(listId: string, options?: LoadOptions): void;
  /** True once TickTick answered 401: the token is refused. */
  refused: boolean;
  setRefused(refused: boolean): void;
  /** Forgets everything loaded, to start over. */
  restart(): void;
};

/**
 * What the screens show from TickTick: the lists with their open items, and
 * each list's cart. Reads retry by themselves after network failures, and
 * everything refreshes when the app becomes visible again.
 */
export function useListsData(api: ListsApi | null, persist: boolean, ready: boolean): ListsData {
  const [refused, setRefused] = useState(false);
  const [lists, setLists] = useState<Resource<List[]> | null>(null);
  const [open, setOpen] = useState<Record<string, Resource<Item[]>>>({});
  const [carts, setCarts] = useState<Record<string, Resource<Item[]>>>({});
  const [cached, setCached] = useState<ListSummary[] | null>(null);
  const retries = useRef(new Map<string, {attempt: number; timer: ReturnType<typeof setTimeout> | null}>());
  const generation = useRef(0);
  const apiRef = useRef(api);

  const clearRetries = () => {
    for (const retry of retries.current.values()) {
      if (retry.timer) clearTimeout(retry.timer);
    }
    retries.current.clear();
  };

  // A new token (or demo mode) starts over.
  useEffect(() => {
    apiRef.current = api;
    generation.current += 1;
    clearRetries();
    setRefused(false);
    setLists(null);
    setOpen({});
    setCarts({});
    setCached(api && persist ? readCache() : null);
    return clearRetries;
  }, [api, persist]);

  /** Runs a read; network failures come back by themselves on the retry schedule. */
  const guard = useCallback(async <T>(key: string, run: (client: ListsApi) => Promise<T>, retry: () => void): Promise<T | TickTickError> => {
    const client = apiRef.current;
    const started = generation.current;
    if (!client) {
      return new TickTickError('auth');
    }
    try {
      const value = await run(client);
      const pending = retries.current.get(key);
      if (pending?.timer) clearTimeout(pending.timer);
      retries.current.delete(key);
      return value;
    } catch (caught) {
      const error = asError(caught);
      if (started !== generation.current) {
        return error;
      }
      if (error.kind === 'auth') {
        setRefused(true);
      } else if (error.kind === 'network') {
        const pending = retries.current.get(key) ?? {attempt: 0, timer: null};
        if (pending.timer) clearTimeout(pending.timer);
        if (pending.attempt < RETRY_DELAYS_MS.length) {
          retries.current.set(key, {attempt: pending.attempt + 1, timer: setTimeout(retry, RETRY_DELAYS_MS[pending.attempt])});
        }
      }
      return error;
    }
  }, []);

  const loaders = useRef({
    lists: (_options?: LoadOptions) => {},
    list: (_listId: string, _options?: LoadOptions) => {},
    cart: (_listId: string, _options?: LoadOptions) => {},
  });

  const loadLists = useCallback(
    (options: LoadOptions = {}) => {
      const started = generation.current;
      setLists(previous => loading(previous, options.silent));
      void guard(
        'lists',
        async client => {
          const found = await client.lists();
          const items: Record<string, Item[]> = {};
          await inBatches(found, async list => {
            try {
              items[list.id] = await client.openItems(list.id);
            } catch (error) {
              const kind = asError(error).kind;
              if (kind === 'auth' || kind === 'network') throw error;
            }
          });
          return {found, items};
        },
        () => loaders.current.lists({silent: true}),
      ).then(result => {
        if (started !== generation.current) return;
        setLists(previous => settled(previous, result instanceof TickTickError ? result : result.found, options.silent));
        if (!(result instanceof TickTickError)) {
          setOpen(previous => {
            const next = {...previous};
            for (const [id, items] of Object.entries(result.items)) {
              next[id] = {status: 'ready', data: items, error: null};
            }
            return next;
          });
        }
      });
    },
    [guard],
  );

  const loadList = useCallback(
    (listId: string, options: LoadOptions = {}) => {
      const started = generation.current;
      setOpen(previous => ({...previous, [listId]: loading(previous[listId], options.silent)}));
      void guard(`list:${listId}`, client => client.openItems(listId), () => loaders.current.list(listId, {silent: true})).then(result => {
        if (started !== generation.current) return;
        setOpen(previous => ({...previous, [listId]: settled(previous[listId], result, options.silent)}));
      });
    },
    [guard],
  );

  const loadCart = useCallback(
    (listId: string, options: LoadOptions = {}) => {
      const started = generation.current;
      setCarts(previous => ({...previous, [listId]: loading(previous[listId], options.silent)}));
      void guard(`cart:${listId}`, client => client.cart(listId), () => loaders.current.cart(listId, {silent: true})).then(result => {
        if (started !== generation.current) return;
        setCarts(previous => ({...previous, [listId]: settled(previous[listId], result, options.silent)}));
      });
    },
    [guard],
  );
  loaders.current = {lists: loadLists, list: loadList, cart: loadCart};

  // First load once there is something to talk to.
  useEffect(() => {
    if (ready && lists === null) {
      loadLists();
    }
  }, [ready, lists, loadLists]);

  // A hidden app is suspended: what it shows may be stale when it comes back.
  const cartIds = Object.keys(carts).join('\n');
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || apiRef.current == null) return;
      loaders.current.lists({silent: true});
      for (const id of cartIds ? cartIds.split('\n') : []) loaders.current.cart(id, {silent: true});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [cartIds]);

  const summaries = useMemo<Resource<ListSummary[]> | null>(() => {
    if (lists?.data == null) {
      if (lists?.status === 'loading' && cached?.length) {
        return {status: 'loading', data: cached, error: null};
      }
      return lists ? {status: lists.status, data: null, error: lists.error} : null;
    }
    const known = new Map(cached?.map(entry => [entry.id, entry.open]) ?? []);
    const data = lists.data.map(list => ({...list, open: open[list.id]?.data?.length ?? known.get(list.id) ?? 0}));
    return {status: lists.status, data, error: lists.error};
  }, [cached, lists, open]);

  // Keeps names and counts only, to show the start screen at once next time.
  useEffect(() => {
    if (persist && summaries?.status === 'ready' && summaries.data) {
      writeStorage(CACHE_KEY, JSON.stringify(summaries.data));
    }
  }, [persist, summaries]);

  const restart = useCallback(() => {
    clearRetries();
    setRefused(false);
    setLists(null);
  }, []);

  return {lists: summaries, open, carts, setLists, setOpen, setCarts, loadLists, loadList, loadCart, refused, setRefused, restart};
}
