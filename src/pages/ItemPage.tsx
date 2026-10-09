import pencilFilled from '@wearables-ui-toolkit/icons/svg/pencil__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {IconTintColor, ListItem, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {LoadingContent, StateContent} from '../components/StateContent';
import {t} from '../i18n/strings';
import {useLists} from '../ListsProvider';
import {deletePath, editPath} from '../paths';

/** Item options: In the cart, Edit, Delete. */
export function ItemPage() {
  const {listId = '', itemId = ''} = useParams();
  const navigate = useNavigate();
  const {openItems, loadList, complete} = useLists();
  const items = openItems(listId);
  const item = items?.data?.find(entry => entry.id === itemId);

  useEffect(() => {
    if (items == null) loadList(listId);
  }, [items, listId, loadList]);

  if (!item) {
    const loading = items?.data == null && items?.status !== 'error';
    return (
      <Page headerText={t('appName')} headerIsLoading={loading} enableSystemBarInset={false}>
        {loading ? <LoadingContent /> : <StateContent title={t('itemGoneTitle')} body={t('itemGoneBody')} ariaLabel={t('itemGoneTitle')} />}
      </Page>
    );
  }

  return (
    <Page headerText={item.title} headerMetadata={item.note || undefined} enableSystemBarInset={false}>
      <VerticalList insetForHeader ariaLabel={t('optionsLabel', {title: item.title})}>
        <ListItem
          title={t('inTheCart')}
          icon={squareCheckFilled}
          iconTintColor={IconTintColor.POSITIVE}
          onClick={() => {
            void complete(item);
            navigate(-1);
          }}
        />
        <ListItem title={t('edit')} subtitle={t('editSubtitle')} icon={pencilFilled} onClick={() => navigate(editPath(listId, item.id))} />
        <ListItem title={t('delete')} icon={trashFilled} iconTintColor={IconTintColor.NEGATIVE} onClick={() => navigate(deletePath(listId, item.id))} />
      </VerticalList>
    </Page>
  );
}
