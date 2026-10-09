import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {Button, ButtonRail, MaterialLibrary, Page, ScrollView, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {StateContent} from '../components/StateContent';
import {t} from '../i18n/strings';
import {listName} from '../tasks/labels';
import {useTasks} from '../TasksProvider';

/** The confirmation step of Delete. Back keeps the task. */
export function DeletePage() {
  const {listId = '', taskId = ''} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // From the task's own screen, that screen goes too.
  const steps = (location.state as {steps?: number} | null)?.steps === 2 ? -2 : -1;
  const {list, findTask, removeTask} = useTasks();
  const [busy, setBusy] = useState(false);
  const deleteMaterial = useMemo(() => MaterialLibrary.themedPrimaryRed(), []);
  const task = findTask(listId, taskId);

  if (!task) {
    return (
      <Page headerText={t('deleteHeader')} enableSystemBarInset={false}>
        <StateContent title={t('taskGoneTitle')} body={t('taskGoneBody')} ariaLabel={t('taskGoneTitle')} />
      </Page>
    );
  }

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const removed = await removeTask(task);
    setBusy(false);
    if (removed) {
      navigate(steps);
    }
  };

  return (
    <Page headerText={t('deleteHeader')} headerIsLoading={busy} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader ariaLabel={t('deleteHeader')}>
          <div className="content-inset">
            <TextView as="p" textStyle={TextStyle.BODY2}>
              {t('deleteBody', {title: task.title, list: listName(list(listId))})}
            </TextView>
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonRail>
            <Button title={t('delete')} icon={trashFilled} alwaysShowText material={deleteMaterial} disabled={busy} onClick={() => void confirm()} />
          </ButtonRail>
        </div>
      </div>
    </Page>
  );
}
