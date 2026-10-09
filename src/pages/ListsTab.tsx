import shoppingCartFilled from '@wearables-ui-toolkit/icons/svg/shoppingcart__filled.svg';
import {ListItem, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useNavigate} from 'react-router-dom';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {t, tp} from '../i18n/strings';
import {useLists} from '../ListsProvider';
import {listPath} from '../paths';

/** One row per TickTick list; the list opened last takes the first focus. */
export function ListsTab() {
  const navigate = useNavigate();
  const {lists, loadLists, setTab, lastListId, rememberList} = useLists();

  if (lists?.data == null) {
    if (lists?.status === 'error') {
      return <ErrorContent error={lists.error} onRetry={() => loadLists()} />;
    }
    return <LoadingContent />;
  }
  if (lists.data.length === 0) {
    return (
      <StateContent
        title={t('noListsTitle')}
        body={t('noListsBody')}
        action={{label: t('newListAction'), onClick: () => setTab(1)}}
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
          title={list.name}
          subtitle={list.open > 0 ? tp('toBuy', list.open) : t('allBought')}
          icon={shoppingCartFilled}
          initialFocusEligible={index >= lastIndex}
          onClick={() => {
            rememberList(list.id);
            navigate(listPath(list.id));
          }}
        />
      ))}
    </VerticalList>
  );
}
