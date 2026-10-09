import calendarFilled from '@wearables-ui-toolkit/icons/svg/calendar__filled.svg';
import circleAlertFilled from '@wearables-ui-toolkit/icons/svg/circlealert__filled.svg';
import pencilFilled from '@wearables-ui-toolkit/icons/svg/pencil__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import tagFilled from '@wearables-ui-toolkit/icons/svg/tag__filled.svg';
import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {Button, ButtonRail, IconImage, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useMemo} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {LoadingContent, StateContent} from '../components/StateContent';
import {locale, t} from '../i18n/strings';
import {deletePath, editPath} from '../paths';
import {dueTone, formatDueLong} from '../tasks/due';
import {dueWords, listName, priorityLine, subtasksLine} from '../tasks/labels';
import {useTasks} from '../TasksProvider';

/** One task: title, due, priority, tags, notes and subtasks; Complete, Edit, Delete. */
export function TaskPage() {
  const {listId = '', taskId = ''} = useParams();
  const navigate = useNavigate();
  const {list, findTask, pendingTasks, loadList, complete, clock} = useTasks();
  const completeMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const task = findTask(listId, taskId);
  const tasks = pendingTasks(listId);

  useEffect(() => {
    if (tasks == null) loadList(listId);
  }, [listId, loadList, tasks]);

  if (!task) {
    const loading = tasks?.data == null && tasks?.status !== 'error';
    return (
      <Page headerText={t('taskHeader')} headerIsLoading={loading} enableSystemBarInset={false}>
        {loading ? <LoadingContent /> : <StateContent title={t('taskGoneTitle')} body={t('taskGoneBody')} ariaLabel={t('taskGoneTitle')} />}
      </Page>
    );
  }

  const tone = dueTone(task.due, clock);
  const due = task.due ? formatDueLong(task.due, clock, locale, dueWords()) : t('noDue');
  const priority = priorityLine(task.priority);
  const completeTask = () => {
    void complete(task);
    navigate(-1);
  };

  return (
    <Page headerText={t('taskHeader')} headerMetadata={listName(list(listId)) || undefined} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader tabIndex={0} ariaLabel={t('taskLabel')}>
          <div className="content-inset task-facts">
            <TextView as="h2" textStyle={TextStyle.BODY2_EMPHASIZED}>
              {task.title}
            </TextView>
            <div className="fact">
              <IconImage source={calendarFilled} className="fact-icon" />
              <TextView as="p" textStyle={TextStyle.BODY2} textColor={tone === 'normal' || !task.due ? TextColor.PRIMARY : TextColor.ACCENT}>
                {tone === 'overdue' ? t('overdueLine', {due}) : due}
              </TextView>
            </div>
            {priority ? (
              <div className="fact">
                <IconImage source={circleAlertFilled} className="fact-icon" />
                <TextView as="p" textStyle={TextStyle.BODY2}>
                  {priority}
                </TextView>
              </div>
            ) : null}
            {task.tags.length > 0 ? (
              <div className="fact">
                <IconImage source={tagFilled} className="fact-icon" />
                <TextView as="p" textStyle={TextStyle.BODY2}>
                  {task.tags.join(', ')}
                </TextView>
              </div>
            ) : null}
            {task.notes ? (
              <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
                {task.notes}
              </TextView>
            ) : null}
            {task.subtasks.length > 0 ? (
              <div className="subtasks">
                <TextView as="p" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
                  {subtasksLine(task)}
                </TextView>
                <ul className="subtask-list">
                  {task.subtasks.map(subtask => (
                    <li key={subtask.id}>
                      <TextView as="span" textStyle={TextStyle.LABEL} textColor={subtask.done ? TextColor.SECONDARY : TextColor.PRIMARY}>
                        {subtask.title}
                      </TextView>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonRail>
            <Button title={t('complete')} icon={squareCheckFilled} alwaysShowText material={completeMaterial} onClick={completeTask} />
            <Button icon={pencilFilled} aria-label={t('edit')} tooltipText={t('edit')} initialFocusEligible={false} onClick={() => navigate(editPath(listId, task.id))} />
            <Button icon={trashFilled} aria-label={t('delete')} tooltipText={t('delete')} initialFocusEligible={false} onClick={() => navigate(deletePath(listId, task.id), {state: {steps: 2}})} />
          </ButtonRail>
        </div>
      </div>
    </Page>
  );
}
