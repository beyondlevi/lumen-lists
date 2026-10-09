import circlePlusFilled from '@wearables-ui-toolkit/icons/svg/circleplus__filled.svg';
import pencilFilled from '@wearables-ui-toolkit/icons/svg/pencil__filled.svg';
import squareFilled from '@wearables-ui-toolkit/icons/svg/square__filled.svg';
import squareCheckFilled from '@wearables-ui-toolkit/icons/svg/squarecheck__filled.svg';
import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import {Button, ButtonRail, IconTintColor, ListItem, MaterialLibrary, Page, VerticalList} from '@wearables-ui-toolkit/mrbd';
import {useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {StateContent} from '../components/StateContent';
import {locale, t, tp} from '../i18n/strings';
import {reviewItems} from '../items/parse';
import {useLists} from '../ListsProvider';
import {addDraftKey, addPath} from '../paths';

/** Review: what was understood, each item with a checkbox, then Add, Edit, Discard. */
export function ReviewPage() {
  const {listId = ''} = useParams();
  const navigate = useNavigate();
  const {listName, openItems, draft, setDraft, addItems} = useLists();
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const addMaterial = useMemo(() => MaterialLibrary.themedPrimaryGreen(), []);
  const key = addDraftKey(listId);
  const text = draft(key) ?? '';
  const open = openItems(listId)?.data;
  const items = useMemo(() => reviewItems(text, open ?? [], locale), [open, text]);
  const chosen = items.filter((item, index) => !item.duplicate && !skipped.has(index));
  const name = listName(listId) ?? '';

  const toggle = (index: number) =>
    setSkipped(previous => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const add = async () => {
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    const added = await addItems(
      listId,
      chosen.map(({title, note}) => ({title, note})),
    );
    setBusy(false);
    if (added) {
      setDraft(key, undefined);
      navigate(-1);
    }
  };

  // Review took the place of Add items in the history: Edit swaps them back.
  const edit = () => navigate(addPath(listId), {replace: true});

  const discard = () => {
    setDraft(key, undefined);
    navigate(-1);
  };

  return (
    <Page headerText={tp('reviewHeader', chosen.length)} headerMetadata={name || undefined} headerIsLoading={busy} enableSystemBarInset={false}>
      <div className="action-page-shell">
        {items.length === 0 ? (
          <StateContent title={t('nothingUnderstoodTitle')} body={t('nothingUnderstoodBody')} ariaLabel={t('reviewLabel')} />
        ) : (
          <VerticalList insetForHeader ariaLabel={t('reviewLabel')}>
            {items.map((item, index) => {
              const checked = !item.duplicate && !skipped.has(index);
              return (
                <ListItem
                  key={`${index}-${item.title}`}
                  title={item.title}
                  subtitle={item.duplicate ? t('alreadyInList') : item.note || undefined}
                  icon={checked ? squareCheckFilled : squareFilled}
                  iconTintColor={checked ? IconTintColor.POSITIVE : IconTintColor.SECONDARY}
                  aria-checked={checked}
                  role="checkbox"
                  disabled={item.duplicate}
                  onClick={() => toggle(index)}
                />
              );
            })}
          </VerticalList>
        )}
        <div className="action-dock">
          <ButtonRail>
            <Button
              title={tp('addCount', chosen.length)}
              icon={circlePlusFilled}
              alwaysShowText
              material={addMaterial}
              disabled={chosen.length === 0 || busy}
              initialFocusEligible={false}
              onClick={() => void add()}
            />
            <Button icon={pencilFilled} aria-label={t('edit')} tooltipText={t('edit')} initialFocusEligible={false} onClick={edit} />
            <Button icon={trashFilled} aria-label={t('discard')} tooltipText={t('discard')} initialFocusEligible={false} onClick={discard} />
          </ButtonRail>
        </div>
      </div>
    </Page>
  );
}
