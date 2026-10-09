import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import {ActionHint, IconTintColor, ListItem, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useRef} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {focusHandle, successorOf} from '../components/focus';
import {ErrorContent, LoadingContent, StateContent} from '../components/StateContent';
import {formatNumber, t} from '../i18n/strings';
import {useLists} from '../ListsProvider';
import type {Item} from '../ticktick/types';

/** In the cart: the items completed in this list in the last 24 hours. Enter puts one back. */
export function CartPage() {
  const {listId = ''} = useParams();
  const navigate = useNavigate();
  const {cart, loadCart, loadList, openItems, reopen} = useLists();
  const rows = useRef(new Map<string, unknown>());
  const items = cart(listId);
  const hasOpen = openItems(listId) != null;

  useEffect(() => {
    loadCart(listId, {silent: true});
    if (!hasOpen) loadList(listId);
  }, [hasOpen, listId, loadCart, loadList]);

  if (items?.data == null) {
    return (
      <Page headerText={t('inTheCart')} headerIsLoading={items?.status !== 'error'} enableSystemBarInset={false}>
        {items?.status === 'error' ? <ErrorContent error={items.error} onRetry={() => loadCart(listId)} /> : <LoadingContent />}
      </Page>
    );
  }

  const inCart = items.data;
  const putBack = (item: Item) => {
    if (inCart.length === 1) {
      // The cart is empty now: back to the list, where the item is.
      void reopen(item);
      navigate(-1);
      return;
    }
    const next = successorOf(
      inCart.map(entry => entry.id),
      item.id,
      '',
    );
    focusHandle(rows.current.get(next));
    void reopen(item);
  };

  return (
    <Page headerText={t('inTheCart')} headerMetadata={formatNumber(inCart.length)} enableSystemBarInset={false}>
      {inCart.length === 0 ? (
        <StateContent title={t('cartEmptyTitle')} body={t('cartEmptyBody')} ariaLabel={t('cartLabel')} />
      ) : (
        <div className="action-page-shell">
          <VerticalList insetForHeader ariaLabel={t('cartLabel')}>
            {inCart.map(item => (
              <ListItem
                key={item.id}
                ref={(handle: unknown) => {
                  if (handle == null) rows.current.delete(item.id);
                  else rows.current.set(item.id, handle);
                }}
                title={item.title}
                subtitle={item.note || undefined}
                icon={squareCheckFilled}
                iconTintColor={IconTintColor.POSITIVE}
                onClick={() => putBack(item)}
              />
            ))}
          </VerticalList>
          <div className="hint-dock">
            <ActionHint text={t('hintReopen')} />
          </div>
        </div>
      )}
    </Page>
  );
}
