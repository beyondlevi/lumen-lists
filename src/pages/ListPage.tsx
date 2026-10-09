import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import squareFilled from '@wearables-ui-toolkit/icons/svg/square__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import {ActionHint, IconTintColor, ListItem, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useRef, type KeyboardEvent} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {focusHandle, successorOf} from '../components/focus';
import {ErrorContent, LoadingContent} from '../components/StateContent';
import {formatNumber, t} from '../i18n/strings';
import {useLists} from '../ListsProvider';
import {addPath, cartPath, itemPath, listPath} from '../paths';
import {registerRestorer, rememberReturnRow, takeReturnRow} from '../state/returnFocus';
import type {Item} from '../ticktick/types';

const ADD_ROW = '__add';
const CART_ROW = '__cart';

/** A list: Add items, the items still to buy, then In the cart. */
export function ListPage() {
  const {listId = ''} = useParams();
  const navigate = useNavigate();
  const {listName, openItems, loadList, cart, loadCart, complete, rememberList} = useLists();
  const rows = useRef(new Map<string, unknown>());
  const items = openItems(listId);
  const inCart = cart(listId);
  const name = listName(listId) ?? '';

  useEffect(() => {
    rememberList(listId);
    loadList(listId, {silent: true});
    loadCart(listId, {silent: true});
  }, [listId, loadCart, loadList, rememberList]);

  useEffect(
    () =>
      registerRestorer(() => {
        if (window.location.pathname !== listPath(listId)) return;
        const row = takeReturnRow(listId);
        if (row) {
          requestAnimationFrame(() => requestAnimationFrame(() => focusHandle(rows.current.get(row))));
        }
      }),
    [listId],
  );

  const go = (row: string, path: string) => {
    rememberReturnRow(listId, row);
    navigate(path);
  };

  const rowRef = (key: string) => (handle: unknown) => {
    if (handle == null) rows.current.delete(key);
    else rows.current.set(key, handle);
  };

  if (items?.data == null) {
    return (
      <Page headerText={name || t('appName')} headerIsLoading={items?.status !== 'error'} enableSystemBarInset={false}>
        {items?.status === 'error' ? <ErrorContent error={items.error} onRetry={() => loadList(listId)} /> : <LoadingContent />}
      </Page>
    );
  }

  const open = items.data;
  const cartCount = inCart?.data?.length ?? 0;
  const total = open.length + cartCount;
  const putInCart = (item: Item) => {
    const next = successorOf(
      open.map(entry => entry.id),
      item.id,
      ADD_ROW,
    );
    focusHandle(rows.current.get(next));
    void complete(item);
  };
  const openOptions = (event: KeyboardEvent, item: Item) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      go(item.id, itemPath(listId, item.id));
    }
  };

  return (
    <Page
      headerText={name}
      headerMetadata={open.length === 0 ? t('nothingToBuy') : t('left', {left: formatNumber(open.length), total: formatNumber(total)})}
      enableSystemBarInset={false}>
      <div className="action-page-shell">
        <VerticalList insetForHeader ariaLabel={t('listLabel', {name})}>
          <ListItem ref={rowRef(ADD_ROW)} title={t('addItems')} icon={circlePlusFilled} onClick={() => go(ADD_ROW, addPath(listId))} />
          {open.map(item => (
            <ListItem
              key={item.id}
              ref={rowRef(item.id)}
              title={item.title}
              subtitle={item.note || undefined}
              icon={squareFilled}
              iconTintColor={IconTintColor.SECONDARY}
              onClick={() => putInCart(item)}
              onKeyDown={(event: KeyboardEvent) => openOptions(event, item)}
            />
          ))}
          <ListItem
            ref={rowRef(CART_ROW)}
            title={t('inTheCart')}
            subtitle={formatNumber(cartCount)}
            icon={squareCheckFilled}
            iconTintColor={IconTintColor.POSITIVE}
            onClick={() => go(CART_ROW, cartPath(listId))}
          />
        </VerticalList>
        {open.length > 0 ? (
          <div className="hint-dock">
            <ActionHint text={t('hintCheck')} />
            <ActionHint text={t('hintOptions')} />
          </div>
        ) : null}
      </div>
    </Page>
  );
}
