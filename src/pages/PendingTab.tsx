import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import squareFilled from '@wearables-ui-toolkit/icons/svg/square__filled.svg';
import {ListItem, SwipeToReveal, TextColor, TextStyle, TextView, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {Fragment, useState} from 'react';
import {successorOf} from '../components/focus';
import {RowHints} from '../components/RowHints';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {mirrorArrows} from '../components/mirrorArrows';
import {revealedBy, swipeActions, type RowActions} from '../components/taskRows';
import {PRIORITY_TINT, secondLine} from '../components/taskStyle';
import {useRows} from '../components/useRows';
import {t} from '../i18n/strings';
import {addPath, deletePath, editPath, PENDING_CONTEXT, taskPath} from '../paths';
import {groupTasks} from '../tasks/due';
import {dueText, groupTitle, listName, toneOf} from '../tasks/labels';
import type {Task} from '../ticktick/types';
import {useTasks} from '../TasksProvider';

const ADD_ROW = '__add';

/** Every pending task of every list, the Inbox included: Overdue, Today, Tomorrow, the next days, Later, No date. */
export function PendingTab() {
  const {lists, loadAll, allPending, list, complete, clock} = useTasks();
  const {rowRef, go, moveTo} = useRows('pending', '/');
  const [revealed, setRevealed] = useState(false);

  if (lists?.data == null) {
    return lists?.status === 'error' ? <ErrorContent error={lists.error} onRetry={() => loadAll()} /> : <LoadingContent />;
  }
  const groups = groupTasks(allPending(), clock);
  if (groups.length === 0) {
    return (
      <StateContent
        title={t('allDoneTitle')}
        body={t('allDoneBody')}
        action={{label: t('addTasks'), onClick: () => go(ADD_ROW, addPath(PENDING_CONTEXT))}}
        ariaLabel={t('pendingLabel')}
      />
    );
  }
  const order = groups.flatMap(group => group.tasks.map(task => task.id));
  const actions: RowActions = {
    onView: task => go(task.id, taskPath(task.listId, task.id)),
    onEdit: task => go(task.id, editPath(task.listId, task.id)),
    onDelete: task => go(task.id, deletePath(task.listId, task.id)),
  };
  const completeTask = (task: Task) => {
    moveTo(successorOf(order, task.id, ADD_ROW));
    void complete(task);
  };

  return (
    <div className="action-page-shell">
      <VerticalList insetForHeader ariaLabel={t('pendingLabel')}>
        <ListItem ref={rowRef(ADD_ROW)} title={t('addTasks')} icon={circlePlusFilled} onClick={() => go(ADD_ROW, addPath(PENDING_CONTEXT))} />
        {groups.map(group => (
          <Fragment key={group.day ?? group.key}>
            <TextView as="h2" className="group-title" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
              {groupTitle(group)}
            </TextView>
            {group.tasks.map(task => (
              <SwipeToReveal
                key={task.id}
                actions={swipeActions(task, actions)}
                onKeyDownCapture={mirrorArrows}
                onKeyUpCapture={mirrorArrows}
                onFocus={event => setRevealed(revealedBy(event))}>
                <ListItem
                  ref={rowRef(task.id)}
                  data-task-row=""
                  title={task.title}
                  {...secondLine(dueText(task, clock, true), listName(list(task.listId)), toneOf(task, clock))}
                  icon={squareFilled}
                  iconTintColor={PRIORITY_TINT[task.priority]}
                  onClick={() => completeTask(task)}
                />
              </SwipeToReveal>
            ))}
          </Fragment>
        ))}
      </VerticalList>
      <RowHints revealed={revealed} />
    </div>
  );
}
