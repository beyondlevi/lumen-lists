import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import squareFilled from '@wearables-ui-toolkit/icons/svg/square__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import {IconTintColor, ListItem, Page, SwipeToReveal, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {successorOf} from '../components/focus';
import {RowHints} from '../components/RowHints';
import {ErrorContent, LoadingContent} from '../components/StateContent';
import {mirrorArrows} from '../components/mirrorArrows';
import {spotOf, swipeActions, type RowActions, type SwipeSpot} from '../components/taskRows';
import {PRIORITY_TINT, secondLine} from '../components/taskStyle';
import {useRows} from '../components/useRows';
import {formatNumber, t, tp} from '../i18n/strings';
import {dueText, listName, toneOf} from '../tasks/labels';
import {addPath, completedPath, deletePath, editPath, listPath, taskPath} from '../paths';
import type {Task} from '../ticktick/types';
import {useTasks} from '../TasksProvider';

const ADD_ROW = '__add';
const COMPLETED_ROW = '__completed';

/** A list: Add tasks, the pending tasks, then Completed. */
export function ListPage() {
  const {listId = ''} = useParams();
  const {list, pendingTasks, loadList, completedTasks, loadCompleted, complete, rememberList, clock} = useTasks();
  const {rowRef, go, moveTo} = useRows(`list:${listId}`, listPath(listId));
  const [spot, setSpot] = useState<SwipeSpot>('row');
  const tasks = pendingTasks(listId);
  const done = completedTasks(listId);
  const name = listName(list(listId));

  useEffect(() => {
    rememberList(listId);
    loadList(listId, {silent: true});
    loadCompleted(listId, {silent: true});
  }, [listId, loadCompleted, loadList, rememberList]);

  if (tasks?.data == null) {
    return (
      <Page headerText={name || t('appName')} headerIsLoading={tasks?.status !== 'error'} enableSystemBarInset={false}>
        {tasks?.status === 'error' ? <ErrorContent error={tasks.error} onRetry={() => loadList(listId)} /> : <LoadingContent />}
      </Page>
    );
  }

  const pending = tasks.data;
  const actions: RowActions = {
    onView: task => go(task.id, taskPath(listId, task.id)),
    onEdit: task => go(task.id, editPath(listId, task.id)),
    onDelete: task => go(task.id, deletePath(listId, task.id)),
  };
  const completeTask = (task: Task) => {
    moveTo(successorOf(pending.map(entry => entry.id), task.id, ADD_ROW));
    void complete(task);
  };

  return (
    <Page
      headerText={name}
      headerMetadata={pending.length > 0 ? tp('pendingCount', pending.length) : t('nothingPending')}
      enableSystemBarInset={false}>
      <div className="action-page-shell">
        <VerticalList insetForHeader ariaLabel={t('listLabel', {name})}>
          <ListItem ref={rowRef(ADD_ROW)} title={t('addTasks')} icon={circlePlusFilled} onClick={() => go(ADD_ROW, addPath(listId))} />
          {pending.map(task => (
            <SwipeToReveal
              key={task.id}
              actions={swipeActions(task, actions)}
              onKeyDownCapture={mirrorArrows}
              onKeyUpCapture={mirrorArrows}
              onFocus={event => setSpot(spotOf(event))}>
              <ListItem
                ref={rowRef(task.id)}
                data-task-row=""
                title={task.title}
                {...secondLine(dueText(task, clock), '', toneOf(task, clock))}
                icon={squareFilled}
                iconTintColor={PRIORITY_TINT[task.priority]}
                onClick={() => completeTask(task)}
              />
            </SwipeToReveal>
          ))}
          <ListItem
            ref={rowRef(COMPLETED_ROW)}
            title={t('completedRow')}
            subtitle={formatNumber(done?.data?.length ?? 0)}
            icon={squareCheckFilled}
            iconTintColor={IconTintColor.ACCENT}
            onClick={() => go(COMPLETED_ROW, completedPath(listId))}
          />
        </VerticalList>
        {pending.length > 0 ? <RowHints spot={spot} /> : null}
      </div>
    </Page>
  );
}
