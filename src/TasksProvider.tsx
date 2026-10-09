import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {createDemoClient} from './demo/demoClient';
import {locale} from './i18n/strings';
import {LAST_KEY, readStorage, writeStorage, type LoadOptions, type Resource} from './state/resource';
import {useLumenConfig} from './state/useLumenConfig';
import {useTaskActions, type TaskActions} from './state/useTaskActions';
import {useTasksData, type ListSummary} from './state/useTasksData';
import type {Clock} from './tasks/due';
import {createClient, deviceTimeZone} from './ticktick/client';
import type {Priority, Task, TasksApi} from './ticktick/types';

export type {Resource} from './state/resource';
export type {ListSummary} from './state/useTasksData';

export type Phase = {kind: 'loading'} | {kind: 'setup'; reason: 'missing' | 'invalid' | 'refused'} | {kind: 'ready'; demo: boolean};

/** An Edit in progress: what the fields and choices hold until Save. */
export type EditDraft = {title: string; dueText: string; listId: string; priority: Priority};

type TasksContextValue = TaskActions & {
  phase: Phase;
  /** Reads the settings again and starts over (Setup's Try again). */
  retrySetup(): Promise<void>;
  clock: Clock;
  tab: number;
  setTab(index: number): void;
  /** The Inbox first, then the lists. */
  lists: Resource<ListSummary[]> | null;
  loadAll(options?: LoadOptions): void;
  list(listId: string): ListSummary | undefined;
  inboxId: string | undefined;
  pendingTasks(listId: string): Resource<Task[]> | undefined;
  /** Every pending task of every list loaded, the Inbox included. */
  allPending(): Task[];
  loadList(listId: string, options?: LoadOptions): void;
  completedTasks(listId: string): Resource<Task[]> | undefined;
  loadCompleted(listId: string, options?: LoadOptions): void;
  /** A task by id, pending or completed, in a list. */
  findTask(listId: string, taskId: string): Task | undefined;
  /** Text being written in Add tasks, by where it was opened. */
  writeDraft(context: string): string | undefined;
  setWriteDraft(context: string, text: string | undefined): void;
  /** The tasks Review leaves out (their places in the text), by where Add tasks was opened. */
  reviewSkipped(context: string): readonly number[];
  setReviewSkipped(context: string, skipped: readonly number[] | undefined): void;
  /** The list Review adds to, by where Add tasks was opened. */
  reviewList(context: string): string | undefined;
  setReviewList(context: string, listId: string | undefined): void;
  editDraft(taskId: string): EditDraft | undefined;
  setEditDraft(taskId: string, draft: EditDraft | undefined): void;
  lastListId: string | null;
  rememberList(listId: string): void;
};

const TasksContext = createContext<TasksContextValue | null>(null);

/** How often "now" moves on, so Today and Overdue stay right. */
const TICK_MS = 60_000;

function useClock(): Clock {
  const [clock, setClock] = useState<Clock>(() => ({now: Date.now(), timeZone: deviceTimeZone()}));
  useEffect(() => {
    const tick = () => setClock({now: Date.now(), timeZone: deviceTimeZone()});
    const timer = setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return clock;
}

function useKeyed<T>() {
  const [values, setValues] = useState<Record<string, T>>({});
  const set = useCallback(
    (key: string, value: T | undefined) =>
      setValues(previous => {
        const next = {...previous};
        if (value === undefined) delete next[key];
        else next[key] = value;
        return next;
      }),
    [],
  );
  return [values, set] as const;
}

export function TasksProvider({children}: {children: ReactNode}) {
  const [config, reloadConfig] = useLumenConfig();
  const clock = useClock();
  const [tab, setTab] = useState(0);
  const [writeDrafts, setWriteDraft] = useKeyed<string>();
  const [reviewLists, setReviewList] = useKeyed<string>();
  const [reviewSkips, setReviewSkipped] = useKeyed<readonly number[]>();
  const [editDrafts, setEditDraft] = useKeyed<EditDraft>();
  const [lastListId, setLastListId] = useState<string | null>(() => readStorage(LAST_KEY));

  const demo = config.status === 'demo';
  const api = useMemo<TasksApi | null>(() => {
    if (config.status === 'demo') {
      return createDemoClient(locale);
    }
    return config.status === 'ready' ? createClient(config.config) : null;
  }, [config]);
  const data = useTasksData(api, !demo, api != null, clock);
  const actions = useTaskActions(api, data);
  const {refused, restart} = data;

  const phase = useMemo<Phase>(() => {
    switch (config.status) {
      case 'loading':
        return {kind: 'loading'};
      case 'missing':
        return {kind: 'setup', reason: 'missing'};
      case 'invalid':
        return {kind: 'setup', reason: 'invalid'};
      default:
        return refused ? {kind: 'setup', reason: 'refused'} : {kind: 'ready', demo: config.status === 'demo'};
    }
  }, [config, refused]);

  const retrySetup = useCallback(async () => {
    await reloadConfig();
    restart();
  }, [reloadConfig, restart]);

  const rememberList = useCallback((listId: string) => {
    setLastListId(listId);
    writeStorage(LAST_KEY, listId);
  }, []);

  const {lists, pending, completed, loadAll, loadList, loadCompleted} = data;
  const value = useMemo<TasksContextValue>(() => {
    const listIds = lists?.data?.map(list => list.id) ?? [];
    return {
      ...actions,
      phase,
      retrySetup,
      clock,
      tab,
      setTab,
      lists,
      loadAll,
      list: listId => lists?.data?.find(list => list.id === listId),
      inboxId: lists?.data?.find(list => list.inbox)?.id,
      pendingTasks: listId => pending[listId],
      allPending: () => listIds.flatMap(listId => pending[listId]?.data ?? []),
      loadList,
      completedTasks: listId => completed[listId],
      loadCompleted,
      findTask: (listId, taskId) =>
        pending[listId]?.data?.find(task => task.id === taskId) ?? completed[listId]?.data?.find(task => task.id === taskId),
      writeDraft: context => writeDrafts[context],
      setWriteDraft,
      reviewSkipped: context => reviewSkips[context] ?? [],
      setReviewSkipped,
      reviewList: context => reviewLists[context],
      setReviewList,
      editDraft: taskId => editDrafts[taskId],
      setEditDraft,
      lastListId,
      rememberList,
    };
  }, [
    actions, phase, retrySetup, clock, tab, lists, loadAll, pending, loadList, completed, loadCompleted,
    writeDrafts, setWriteDraft, reviewSkips, setReviewSkipped, reviewLists, setReviewList, editDrafts, setEditDraft, lastListId, rememberList,
  ]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const value = useContext(TasksContext);
  if (!value) throw new Error('useTasks outside TasksProvider');
  return value;
}
