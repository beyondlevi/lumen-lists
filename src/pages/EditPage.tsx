import circleAlertFilled from '@wearables-ui-toolkit/icons/svg/circlealert__filled.svg';
import clipboardFilled from '@wearables-ui-toolkit/icons/svg/clipboard__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import {Button, ButtonRail, InputTextView, ListItem, MaterialLibrary, Page, Toast, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {StateContent} from '../components/StateContent';
import {PRIORITY_TINT} from '../components/taskStyle';
import {locale, t} from '../i18n/strings';
import {editListPath, editPriorityPath} from '../paths';
import {dueFieldText} from '../tasks/due';
import {dueWords, listName, priorityName} from '../tasks/labels';
import {parseDueText} from '../tasks/parse';
import {useTasks, type EditDraft} from '../TasksProvider';

/** Edit a task: Title and Due are real text fields; List and Priority open their choices. */
export function EditPage() {
  const {listId = '', taskId = ''} = useParams();
  const navigate = useNavigate();
  const {list, findTask, editDraft, setEditDraft, updateTask, clock} = useTasks();
  const [busy, setBusy] = useState(false);
  const saveMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const task = findTask(listId, taskId);
  const initialDue = useMemo(() => (task ? dueFieldText(task.due, clock, locale, dueWords()) : ''), [clock, task]);
  const draft: EditDraft | undefined =
    editDraft(taskId) ?? (task ? {title: task.title, dueText: initialDue, listId: task.listId, priority: task.priority} : undefined);

  useEffect(() => {
    if (task && editDraft(taskId) === undefined) {
      setEditDraft(taskId, {title: task.title, dueText: initialDue, listId: task.listId, priority: task.priority});
    }
  }, [editDraft, initialDue, setEditDraft, task, taskId]);

  if (!task || !draft) {
    return (
      <Page headerText={t('editHeader')} enableSystemBarInset={false}>
        <StateContent title={t('taskGoneTitle')} body={t('taskGoneBody')} ariaLabel={t('taskGoneTitle')} />
      </Page>
    );
  }

  const change = (next: Partial<EditDraft>) => setEditDraft(taskId, {...draft, ...next});
  const save = async () => {
    const title = draft.title.trim();
    if (title === '' || busy) return;
    const due = draft.dueText.trim() === initialDue.trim() ? task.due : parseDueText(draft.dueText, clock, locale);
    if (due === 'invalid') {
      Toast.show(t('dueInvalid'));
      return;
    }
    setBusy(true);
    const saved = await updateTask(task, {title, due, priority: draft.priority, listId: draft.listId});
    setBusy(false);
    if (saved) {
      setEditDraft(taskId, undefined);
      navigate(-1);
    }
  };

  return (
    <Page headerText={t('editHeader')} headerMetadata={listName(list(listId)) || undefined} headerIsLoading={busy} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <VerticalList insetForHeader ariaLabel={t('editHeader')}>
          <InputTextView
            text={draft.title}
            hint={t('titleHint')}
            onTextChange={title => change({title})}
            inputProps={{'aria-label': t('titleLabel'), maxLength: 500}}
          />
          <InputTextView
            text={draft.dueText}
            hint={t('dueHint')}
            onTextChange={dueText => change({dueText})}
            inputProps={{'aria-label': t('dueLabel'), maxLength: 100}}
          />
          <ListItem
            title={t('listRow')}
            subtitle={listName(list(draft.listId))}
            icon={clipboardFilled}
            onClick={() => navigate(editListPath(listId, taskId))}
          />
          <ListItem
            title={t('priorityRow')}
            subtitle={priorityName(draft.priority)}
            icon={circleAlertFilled}
            iconTintColor={PRIORITY_TINT[draft.priority]}
            onClick={() => navigate(editPriorityPath(listId, taskId))}
          />
        </VerticalList>
        <div className="action-dock">
          <ButtonRail>
            <Button
              title={t('save')}
              icon={squareCheckFilled}
              alwaysShowText
              material={saveMaterial}
              disabled={draft.title.trim() === '' || busy}
              initialFocusEligible={false}
              onClick={() => void save()}
            />
          </ButtonRail>
        </div>
      </div>
    </Page>
  );
}
