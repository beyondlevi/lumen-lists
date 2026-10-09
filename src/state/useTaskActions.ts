import {Toast} from '@wearables-ui-toolkit/mrbd';
import {useCallback, useMemo, useRef} from 'react';
import {t, tp} from '../i18n/strings';
import type {NewTask, Task, TaskChange, TasksApi} from '../ticktick/types';
import {asError, insertBySortOrder} from './resource';
import type {TasksData} from './useTasksData';

export type TaskActions = {
  /** Completes a task at once; rolls back with a toast if TickTick refuses. */
  complete(task: Task): Promise<boolean>;
  /** Reopens a completed task at once; rolls back with a toast if TickTick refuses. */
  reopen(task: Task): Promise<boolean>;
  addTasks(listId: string, tasks: NewTask[]): Promise<boolean>;
  updateTask(task: Task, change: TaskChange): Promise<boolean>;
  removeTask(task: Task): Promise<boolean>;
  /** The new list's id, or null when it failed. */
  createList(name: string): Promise<string | null>;
};

const byCompletion = (a: Task, b: Task) => (b.completedAt ?? 0) - (a.completedAt ?? 0);

export function useTaskActions(api: TasksApi | null, data: TasksData): TaskActions {
  const {pending, setPending, setCompleted, setLists, setRefused, loadList} = data;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

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

  return useMemo<TaskActions>(() => {
    const change = (setter: typeof setPending) => (listId: string, edit: (tasks: Task[]) => Task[]) =>
      setter(previous => {
        const current = previous[listId];
        return current?.data ? {...previous, [listId]: {...current, data: edit(current.data)}} : previous;
      });
    const setPendingTasks = change(setPending);
    const setCompletedTasks = change(setCompleted);
    const without = (id: string) => (tasks: Task[]) => tasks.filter(entry => entry.id !== id);

    return {
      async complete(task) {
        if (!api) return false;
        setPendingTasks(task.listId, without(task.id));
        setCompletedTasks(task.listId, tasks => [{...task, completedAt: Date.now()}, ...without(task.id)(tasks)]);
        try {
          await api.complete(task);
          return true;
        } catch (error) {
          setPendingTasks(task.listId, tasks => insertBySortOrder(tasks, task));
          setCompletedTasks(task.listId, without(task.id));
          fail(error, t('completeFailed', {title: task.title}));
          return false;
        }
      },

      async reopen(task) {
        if (!api) return false;
        setCompletedTasks(task.listId, without(task.id));
        setPendingTasks(task.listId, tasks => insertBySortOrder(tasks, {...task, completedAt: null}));
        try {
          const result = await api.reopen(task);
          setPendingTasks(task.listId, tasks => insertBySortOrder(without(task.id)(tasks), result.task));
          Toast.show(t('reopened', {title: task.title}));
          return true;
        } catch (error) {
          setPendingTasks(task.listId, without(task.id));
          setCompletedTasks(task.listId, tasks => [task, ...without(task.id)(tasks)].sort(byCompletion));
          fail(error, t('reopenFailed', {title: task.title}));
          return false;
        }
      },

      async addTasks(listId, tasks) {
        if (!api || tasks.length === 0) return false;
        const current = pendingRef.current[listId]?.data ?? [];
        const after = current.length > 0 ? Math.max(...current.map(entry => entry.sortOrder)) : undefined;
        try {
          await api.addTasks(listId, tasks, after);
          Toast.show(tp('added', tasks.length));
          loadList(listId, {silent: true});
          return true;
        } catch (error) {
          fail(error, t('addFailed'));
          return false;
        }
      },

      async updateTask(task, next) {
        if (!api) return false;
        try {
          const updated = {...(await api.update(task, next)), completedAt: null};
          if (updated.listId === task.listId) {
            setPendingTasks(task.listId, tasks => tasks.map(entry => (entry.id === task.id ? {...updated, sortOrder: entry.sortOrder} : entry)));
          } else {
            setPendingTasks(task.listId, without(task.id));
            setPendingTasks(updated.listId, tasks => insertBySortOrder(tasks, updated));
            loadList(updated.listId, {silent: true});
          }
          Toast.show(t('saved'));
          return true;
        } catch (error) {
          fail(error, t('saveFailed'));
          return false;
        }
      },

      async removeTask(task) {
        if (!api) return false;
        try {
          await api.remove(task);
          setPendingTasks(task.listId, without(task.id));
          Toast.show(t('deleted', {title: task.title}));
          return true;
        } catch (error) {
          fail(error, t('deleteFailed', {title: task.title}));
          return false;
        }
      },

      async createList(name) {
        if (!api) return null;
        try {
          const list = await api.createList(name);
          setLists(previous => ({status: 'ready', data: [...(previous?.data ?? []), list], error: null}));
          setPending(previous => ({...previous, [list.id]: {status: 'ready', data: [], error: null}}));
          setCompleted(previous => ({...previous, [list.id]: {status: 'ready', data: [], error: null}}));
          Toast.show(t('listCreated', {name: list.name}));
          return list.id;
        } catch (error) {
          fail(error, t('createFailed'));
          return null;
        }
      },
    };
  }, [api, fail, loadList, setCompleted, setLists, setPending]);
}
