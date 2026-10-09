import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import clipboardFilled from '@wearables-ui-toolkit/icons/svg/clipboard__filled.svg';
import pencilFilled from '@wearables-ui-toolkit/icons/svg/pencil__filled.svg';
import squareFilled from '@wearables-ui-toolkit/icons/svg/square__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {ActionHint, Button, ButtonRail, IconTintColor, ListItem, MaterialLibrary, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {StateContent} from '../components/StateContent';
import {dueLine} from '../components/taskStyle';
import {locale, t, tp} from '../i18n/strings';
import {addPath, PENDING_CONTEXT, reviewListPath} from '../paths';
import {dueTone, formatDue} from '../tasks/due';
import {dueWords, listName} from '../tasks/labels';
import {parseTasks} from '../tasks/parse';
import {useTasks} from '../TasksProvider';

/** Review: the tasks understood, each with a checkbox, the list they go to, then Add, Edit, Discard. */
export function ReviewPage() {
  const {listId = ''} = useParams();
  const navigate = useNavigate();
  const {list, inboxId, writeDraft, setWriteDraft, reviewList, setReviewList, reviewSkipped, setReviewSkipped, addTasks, clock} = useTasks();
  const [busy, setBusy] = useState(false);
  const addMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const context = listId || PENDING_CONTEXT;
  const text = writeDraft(context) ?? '';
  const target = reviewList(context) ?? (listId || inboxId || '');
  const tasks = useMemo(() => parseTasks(text, clock, locale), [clock, text]);
  const skipped = new Set(reviewSkipped(context));
  const chosen = tasks.filter((_task, index) => !skipped.has(index));

  const toggle = (index: number) => {
    const next = new Set(skipped);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setReviewSkipped(context, [...next]);
  };

  const finish = () => {
    setWriteDraft(context, undefined);
    setReviewList(context, undefined);
    setReviewSkipped(context, undefined);
    navigate(-1);
  };
  const add = async () => {
    if (chosen.length === 0 || busy || !target) return;
    setBusy(true);
    const added = await addTasks(target, chosen);
    setBusy(false);
    if (added) finish();
  };
  // Review took the place of Add tasks in the history: Edit swaps them back.
  const edit = () => {
    setReviewSkipped(context, undefined);
    navigate(addPath(context), {replace: true});
  };

  return (
    <Page headerText={tp('reviewHeader', chosen.length)} headerMetadata={listName(list(target)) || undefined} headerIsLoading={busy} enableSystemBarInset={false}>
      <div className="review-page-shell">
        {tasks.length === 0 ? (
          <StateContent title={t('nothingUnderstoodTitle')} body={t('nothingUnderstoodBody')} ariaLabel={t('reviewLabel')} />
        ) : (
          <VerticalList insetForHeader ariaLabel={t('reviewLabel')}>
            {tasks.map((task, index) => {
              const included = !skipped.has(index);
              return (
                <ListItem
                  key={`${index}-${task.title}`}
                  title={task.title}
                  {...dueLine(task.due ? formatDue(task.due, clock, locale, dueWords()) : '', dueTone(task.due, clock))}
                  icon={included ? squareCheckFilled : squareFilled}
                  iconTintColor={included ? IconTintColor.ACCENT : IconTintColor.SECONDARY}
                  aria-checked={included}
                  role="checkbox"
                  onClick={() => toggle(index)}
                />
              );
            })}
            <ListItem title={t('listRow')} subtitle={listName(list(target))} icon={clipboardFilled} onClick={() => navigate(reviewListPath(context))} />
          </VerticalList>
        )}
        <div className="hint-dock">
          <ActionHint text={t('reviewHint')} />
        </div>
        <div className="action-dock">
          <ButtonRail>
            <Button
              title={tp('addCount', chosen.length)}
              icon={circlePlusFilled}
              alwaysShowText
              material={addMaterial}
              disabled={chosen.length === 0 || busy || !target}
              initialFocusEligible={false}
              onClick={() => void add()}
            />
            <Button icon={pencilFilled} aria-label={t('edit')} tooltipText={t('edit')} initialFocusEligible={false} onClick={edit} />
            <Button icon={trashFilled} aria-label={t('discard')} tooltipText={t('discard')} initialFocusEligible={false} onClick={finish} />
          </ButtonRail>
        </div>
      </div>
    </Page>
  );
}
