import {ListItem, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useNavigate, useParams} from 'react-router-dom';
import {t} from '../i18n/strings';
import {PENDING_CONTEXT} from '../paths';
import {listName, priorityName} from '../tasks/labels';
import {PRIORITIES} from '../ticktick/types';
import {useTasks} from '../TasksProvider';

type Kind = 'edit-list' | 'edit-priority' | 'review-list';

/** A choice for Edit (list, priority) or Review (list): Enter picks and goes back. */
export function PickerPage({kind}: {kind: Kind}) {
  const {listId = '', taskId = ''} = useParams();
  const navigate = useNavigate();
  const {lists, editDraft, setEditDraft, reviewList, setReviewList, inboxId} = useTasks();
  const context = listId || PENDING_CONTEXT;
  const draft = editDraft(taskId);
  const options =
    kind === 'edit-priority'
      ? PRIORITIES.map(priority => ({id: String(priority), title: priorityName(priority)}))
      : (lists?.data ?? []).map(list => ({id: list.id, title: listName(list)}));
  const current =
    kind === 'edit-priority'
      ? String(draft?.priority ?? 0)
      : kind === 'edit-list'
        ? draft?.listId
        : (reviewList(context) ?? (context === PENDING_CONTEXT ? inboxId : context));

  const pick = (id: string) => {
    if (kind === 'review-list') {
      setReviewList(context, id);
    } else if (draft && kind === 'edit-list') {
      setEditDraft(taskId, {...draft, listId: id});
    } else if (draft) {
      setEditDraft(taskId, {...draft, priority: PRIORITIES.find(priority => String(priority) === id) ?? 0});
    }
    navigate(-1);
  };

  const header = kind === 'edit-priority' ? t('priorityRow') : t('listRow');
  return (
    <Page headerText={header} enableSystemBarInset={false}>
      <VerticalList insetForHeader ariaLabel={header}>
        {options.map(option => (
          <ListItem key={option.id} title={option.title} showRadioButton checked={option.id === current} onCheckedChange={() => pick(option.id)} />
        ))}
      </VerticalList>
    </Page>
  );
}
