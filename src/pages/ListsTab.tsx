import clipboardFilled from '@wearables-ui-toolkit/icons/svg/clipboard__filled.svg';
import inboxFilled from '@wearables-ui-toolkit/icons/svg/inbox__filled.svg';
import {ListItem, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {LISTS_SCOPE, useRows} from '../components/useRows';
import {t} from '../i18n/strings';
import {listPath} from '../paths';
import {countsLabel, listName} from '../tasks/labels';
import {useTasks} from '../TasksProvider';
import {NEW_LIST_TAB} from './tabs';

/** The Inbox, then one row per TickTick list; the list opened last comes first to hand. */
export function ListsTab() {
  const {lists, loadAll, setTab, lastListId, rememberList} = useTasks();
  const {rowRef, go} = useRows(LISTS_SCOPE, '/');

  if (lists?.data == null) {
    if (lists?.status === 'error') {
      return <ErrorContent error={lists.error} onRetry={() => loadAll()} />;
    }
    return <LoadingContent />;
  }
  if (lists.data.length === 0) {
    return (
      <StateContent
        title={t('noListsTitle')}
        body={t('noListsBody')}
        action={{label: t('newListAction'), onClick: () => setTab(NEW_LIST_TAB)}}
        ariaLabel={t('listsLabel')}
      />
    );
  }
  const lastIndex = Math.max(
    0,
    lists.data.findIndex(list => list.id === lastListId),
  );

  return (
    <VerticalList insetForHeader ariaLabel={t('listsLabel')}>
      {lists.data.map((list, index) => (
        <ListItem
          key={list.id}
          ref={rowRef(list.id)}
          title={listName(list)}
          subtitle={countsLabel(list.pending, list.overdue)}
          icon={list.inbox ? inboxFilled : clipboardFilled}
          initialFocusEligible={index >= lastIndex}
          onClick={() => {
            rememberList(list.id);
            go(list.id, listPath(list.id));
          }}
        />
      ))}
    </VerticalList>
  );
}
