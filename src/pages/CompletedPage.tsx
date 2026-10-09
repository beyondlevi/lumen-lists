import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import {ActionHint, IconTintColor, ListItem, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {successorOf} from '../components/focus';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {useRows} from '../components/useRows';
import {formatNumber, t} from '../i18n/strings';
import {completedPath} from '../paths';
import {doneLabel, listName} from '../tasks/labels';
import type {Task} from '../ticktick/types';
import {useTasks} from '../TasksProvider';

/** Completed: this list's tasks completed in the last days, newest first. Enter makes one pending again. */
export function CompletedPage() {
  const {listId = ''} = useParams();
  const navigate = useNavigate();
  const {list, completedTasks, loadCompleted, pendingTasks, loadList, reopen, clock} = useTasks();
  const {rowRef, moveTo} = useRows(`completed:${listId}`, completedPath(listId));
  const tasks = completedTasks(listId);
  const hasPending = pendingTasks(listId) != null;
  const name = listName(list(listId));

  useEffect(() => {
    loadCompleted(listId, {silent: true});
    if (!hasPending) loadList(listId);
  }, [hasPending, listId, loadCompleted, loadList]);

  if (tasks?.data == null) {
    return (
      <Page headerText={t('completedHeader')} headerIsLoading={tasks?.status !== 'error'} enableSystemBarInset={false}>
        {tasks?.status === 'error' ? <ErrorContent error={tasks.error} onRetry={() => loadCompleted(listId)} /> : <LoadingContent />}
      </Page>
    );
  }

  const done = tasks.data;
  const reopenTask = (task: Task) => {
    if (done.length === 1) {
      void reopen(task);
      navigate(-1);
      return;
    }
    moveTo(successorOf(done.map(entry => entry.id), task.id, ''));
    void reopen(task);
  };

  return (
    <Page headerText={t('completedHeader')} headerMetadata={t('completedMeta', {list: name, count: formatNumber(done.length)})} enableSystemBarInset={false}>
      {done.length === 0 ? (
        <StateContent title={t('completedEmptyTitle')} body={t('completedEmptyBody')} ariaLabel={t('completedLabel')} />
      ) : (
        <div className="action-page-shell">
          <VerticalList insetForHeader ariaLabel={t('completedLabel')}>
            {done.map(task => (
              <ListItem
                key={task.id}
                ref={rowRef(task.id)}
                title={task.title}
                subtitle={doneLabel(task.completedAt, clock) || undefined}
                icon={squareCheckFilled}
                iconTintColor={IconTintColor.ACCENT}
                onClick={() => reopenTask(task)}
              />
            ))}
          </VerticalList>
          <div className="hint-dock">
            <ActionHint text={t('hintReopen')} />
          </div>
        </div>
      )}
    </Page>
  );
}
