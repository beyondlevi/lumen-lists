import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from 'react';
import {createDemoClient} from './demo/demoClient';
import {locale} from './i18n/strings';
import {LAST_KEY, readStorage, writeStorage, type LoadOptions, type Resource} from './state/resource';
import {useItemActions, type ItemActions} from './state/useItemActions';
import {useListsData} from './state/useListsData';
import {useLumenConfig} from './state/useLumenConfig';
import {createClient} from './ticktick/client';
import type {Item, ListsApi, ListSummary} from './ticktick/types';

export type {Resource} from './state/resource';

export type Phase = {kind: 'loading'} | {kind: 'setup'; reason: 'missing' | 'invalid' | 'refused'} | {kind: 'ready'; demo: boolean};

type ListsContextValue = ItemActions & {
  phase: Phase;
  /** Reads the settings again and starts over (Setup's Try again). */
  retrySetup(): Promise<void>;
  tab: number;
  setTab(index: number): void;
  lists: Resource<ListSummary[]> | null;
  loadLists(options?: LoadOptions): void;
  listName(listId: string): string | undefined;
  openItems(listId: string): Resource<Item[]> | undefined;
  loadList(listId: string, options?: LoadOptions): void;
  cart(listId: string): Resource<Item[]> | undefined;
  loadCart(listId: string, options?: LoadOptions): void;
  /** Text being written: for a list (Add items) or an item (Edit). */
  draft(key: string): string | undefined;
  setDraft(key: string, text: string | undefined): void;
  lastListId: string | null;
  rememberList(listId: string): void;
};

const ListsContext = createContext<ListsContextValue | null>(null);

export function ListsProvider({children}: {children: ReactNode}) {
  const [config, reloadConfig] = useLumenConfig();
  const [tab, setTab] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lastListId, setLastListId] = useState<string | null>(() => readStorage(LAST_KEY));

  const demo = config.status === 'demo';
  const api = useMemo<ListsApi | null>(() => {
    if (config.status === 'demo') {
      return createDemoClient(locale);
    }
    return config.status === 'ready' ? createClient(config.config) : null;
  }, [config]);
  const ready = api != null;
  const data = useListsData(api, !demo, ready);
  const actions = useItemActions(api, data);
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

  const setDraft = useCallback(
    (key: string, text: string | undefined) =>
      setDrafts(previous => {
        const next = {...previous};
        if (text === undefined) delete next[key];
        else next[key] = text;
        return next;
      }),
    [],
  );

  const {lists, open, carts, loadLists, loadList, loadCart} = data;
  const value = useMemo<ListsContextValue>(
    () => ({
      ...actions,
      phase,
      retrySetup,
      tab,
      setTab,
      lists,
      loadLists,
      listName: listId => lists?.data?.find(list => list.id === listId)?.name,
      openItems: listId => open[listId],
      loadList,
      cart: listId => carts[listId],
      loadCart,
      draft: key => drafts[key],
      setDraft,
      lastListId,
      rememberList,
    }),
    [actions, phase, retrySetup, tab, lists, loadLists, open, loadList, carts, loadCart, drafts, setDraft, lastListId, rememberList],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists(): ListsContextValue {
  const value = useContext(ListsContext);
  if (!value) throw new Error('useLists outside ListsProvider');
  return value;
}
