import {useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {countOverdue, type Clock} from '../tasks/due';
import {TickTickError, type List, type Task, type TasksApi} from '../ticktick/types';
import {asError, CACHE_KEY, inBatches, loading, readCache, RETRY_DELAYS_MS, retrying, settled, writeStorage, type CachedList, type LoadOptions, type Resource} from './resource';

/** A list with its counts, as the Lists tab shows it. */
export type ListSummary = List & {pending: number; overdue: number};

export type TasksData = {
  /** The Inbox first, then the lists. */
  lists: Resource<ListSummary[]> | null;
  pending: Record<string, Resource<Task[]>>;
  completed: Record<string, Resource<Task[]>>;
  setLists: Dispatch<SetStateAction<Resource<List[]> | null>>;
  setPending: Dispatch<SetStateAction<Record<string, Resource<Task[]>>>>;
  setCompleted: Dispatch<SetStateAction<Record<string, Resource<Task[]>>>>;
  /** Everything: the lists, the Inbox and every list's pending tasks. */
  loadAll(options?: LoadOptions): void;
  loadList(listId: string, options?: LoadOptions): void;
  loadCompleted(listId: string, options?: LoadOptions): void;
  /** True once TickTick answered 401: the token is refused. */
  refused: boolean;
  setRefused(refused: boolean): void;
  /** Forgets everything loaded, to start over. */
  restart(): void;
};

type Loaded = {lists: List[]; pending: Record<string, Task[]>};

/**
 * What the screens show from TickTick: the Inbox and the lists with their
 * pending tasks, and each list's completed tasks. Reads retry by themselves
 * after network failures, and everything refreshes when the app becomes
 * visible again.
 */
export function useTasksData(api: TasksApi | null, persist: boolean, ready: boolean, clock: Clock): TasksData {
  const [refused, setRefused] = useState(false);
  const [lists, setLists] = useState<Resource<List[]> | null>(null);
  const [pending, setPending] = useState<Record<string, Resource<Task[]>>>({});
  const [completed, setCompleted] = useState<Record<string, Resource<Task[]>>>({});
  const [cached, setCached] = useState<CachedList[] | null>(null);
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
    setPending({});
    setCompleted({});
    setCached(api && persist ? readCache() : null);
    return clearRetries;
  }, [api, persist]);

  /**
   * Runs a read. A network failure is tried again after 2, 4, 8 and 15 s (the
   * phone's internet can take half a minute to come up); meanwhile the error is
   * marked `retrying` and the screen keeps loading. A load that is not itself a
   * retry starts the schedule over.
   */
  const guard = useCallback(
    async <T>(key: string, fresh: boolean, run: (client: TasksApi) => Promise<T>, retry: () => void): Promise<T | TickTickError> => {
      const client = apiRef.current;
      const started = generation.current;
      if (!client) {
        return new TickTickError('auth');
      }
      const scheduled = retries.current.get(key);
      if (scheduled?.timer) clearTimeout(scheduled.timer);
      if (fresh) retries.current.delete(key);
      try {
        const value = await run(client);
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
          const attempt = retries.current.get(key)?.attempt ?? 0;
          if (attempt < RETRY_DELAYS_MS.length) {
            retries.current.set(key, {attempt: attempt + 1, timer: setTimeout(retry, RETRY_DELAYS_MS[attempt])});
            retrying.add(error);
          } else {
            retries.current.delete(key);
          }
        }
        return error;
      }
    },
    [],
  );

  const loaders = useRef({
    all: (_options?: LoadOptions) => {},
    list: (_listId: string, _options?: LoadOptions) => {},
    completed: (_listId: string, _options?: LoadOptions) => {},
  });

  const loadAll = useCallback(
    (options: LoadOptions = {}) => {
      const started = generation.current;
      setLists(previous => loading(previous, options.silent));
      void guard<Loaded>(
        'all',
        !options.retry,
        async client => {
          const [found, inbox] = await Promise.all([
            client.lists(),
            client.inbox().catch(error => {
              // Without an Inbox the lists still show; auth and network stop everything.
              const kind = asError(error).kind;
              if (kind === 'auth' || kind === 'network') throw error;
              return null;
            }),
          ]);
          const tasks: Record<string, Task[]> = inbox ? {[inbox.list.id]: inbox.tasks} : {};
          await inBatches(found, async list => {
            try {
              tasks[list.id] = await client.pendingTasks(list.id);
            } catch (error) {
              const kind = asError(error).kind;
              if (kind === 'auth' || kind === 'network') throw error;
            }
          });
          return {lists: inbox ? [inbox.list, ...found] : found, pending: tasks};
        },
        () => loaders.current.all({silent: true, retry: true}),
      ).then(result => {
        if (started !== generation.current) return;
        setLists(previous => settled(previous, result instanceof TickTickError ? result : result.lists, options.silent));
        if (!(result instanceof TickTickError)) {
          setPending(previous => {
            const next = {...previous};
            for (const [id, tasks] of Object.entries(result.pending)) {
              next[id] = {status: 'ready', data: tasks, error: null};
            }
            return next;
          });
        }
      });
    },
    [guard],
  );

  const inboxId = lists?.data?.find(list => list.inbox)?.id;
  const loadList = useCallback(
    (listId: string, options: LoadOptions = {}) => {
      const started = generation.current;
      setPending(previous => ({...previous, [listId]: loading(previous[listId], options.silent)}));
      const read = (client: TasksApi) => (listId === inboxId ? client.inbox().then(inbox => inbox.tasks) : client.pendingTasks(listId));
      void guard(`list:${listId}`, !options.retry, read, () => loaders.current.list(listId, {silent: true, retry: true})).then(result => {
        if (started !== generation.current) return;
        setPending(previous => ({...previous, [listId]: settled(previous[listId], result, options.silent)}));
      });
    },
    [guard, inboxId],
  );

  const loadCompleted = useCallback(
    (listId: string, options: LoadOptions = {}) => {
      const started = generation.current;
      setCompleted(previous => ({...previous, [listId]: loading(previous[listId], options.silent)}));
      void guard(`completed:${listId}`, !options.retry, client => client.completedTasks(listId), () => loaders.current.completed(listId, {silent: true, retry: true})).then(result => {
        if (started !== generation.current) return;
        setCompleted(previous => ({...previous, [listId]: settled(previous[listId], result, options.silent)}));
      });
    },
    [guard],
  );
  loaders.current = {all: loadAll, list: loadList, completed: loadCompleted};

  // First load once there is something to talk to.
  useEffect(() => {
    if (ready && lists === null) {
      loadAll();
    }
  }, [ready, lists, loadAll]);

  // A hidden app is suspended: what it shows may be stale when it comes back.
  const completedIds = Object.keys(completed).join('\n');
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || apiRef.current == null) return;
      loaders.current.all({silent: true});
      for (const id of completedIds ? completedIds.split('\n') : []) loaders.current.completed(id, {silent: true});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [completedIds]);

  const summaries = useMemo<Resource<ListSummary[]> | null>(() => {
    if (lists?.data == null) {
      if (lists?.status === 'loading' && cached?.length) {
        return {status: 'loading', data: cached, error: null};
      }
      return lists ? {status: lists.status, data: null, error: lists.error} : null;
    }
    const known = new Map(cached?.map(entry => [entry.id, entry]) ?? []);
    const data = lists.data.map(list => {
      const tasks = pending[list.id]?.data;
      return {
        ...list,
        pending: tasks?.length ?? known.get(list.id)?.pending ?? 0,
        overdue: tasks ? countOverdue(tasks, clock) : (known.get(list.id)?.overdue ?? 0),
      };
    });
    return {status: lists.status, data, error: lists.error};
  }, [cached, clock, lists, pending]);

  // Keeps names and counts only, to show the lists at once next time.
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

  return {lists: summaries, pending, completed, setLists, setPending, setCompleted, loadAll, loadList, loadCompleted, refused, setRefused, restart};
}
