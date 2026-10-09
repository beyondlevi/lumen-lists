import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {Button, ButtonRail, MaterialLibrary, Page, ScrollView, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {StateContent} from '../components/StateContent';
import {t} from '../i18n/strings';
import {useLists} from '../ListsProvider';

/** The confirmation step of Delete. Back keeps the item. */
export function DeletePage() {
  const {listId = '', itemId = ''} = useParams();
  const navigate = useNavigate();
  const {listName, openItems, removeItem} = useLists();
  const [busy, setBusy] = useState(false);
  const deleteMaterial = useMemo(() => MaterialLibrary.themedPrimaryRed(), []);
  const item = openItems(listId)?.data?.find(entry => entry.id === itemId);

  if (!item) {
    return (
      <Page headerText={t('deleteHeader')} enableSystemBarInset={false}>
        <StateContent title={t('itemGoneTitle')} body={t('itemGoneBody')} ariaLabel={t('itemGoneTitle')} />
      </Page>
    );
  }

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const removed = await removeItem(item);
    setBusy(false);
    if (removed) {
      navigate(-2);
    }
  };

  return (
    <Page headerText={t('deleteHeader')} headerIsLoading={busy} enableSystemBarInset={false}>
      <div className="action-page-shell">
        <ScrollView insetForHeader ariaLabel={t('deleteHeader')}>
          <div className="content-inset">
            <TextView as="p" textStyle={TextStyle.BODY2}>
              {t('deleteBody', {title: item.title, list: listName(listId) ?? ''})}
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
