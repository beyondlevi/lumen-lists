import {ActionHint, Button, ButtonRail, InputTextView, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useId, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {StateContent} from '../components/StateContent';
import {locale, t} from '../i18n/strings';
import {editText, parseEdit} from '../items/parse';
import {useLists} from '../ListsProvider';
import {addDraftKey, editDraftKey, reviewPath} from '../paths';
import {registerRestorer} from '../state/returnFocus';

/**
 * Add items, or Edit one item: a real text field. Enter on it opens Lumen's
 * composer (dictation or writing with the band), which fills the field
 * through `input` and `change` events; Continue goes on from there.
 */
export function WritePage({mode}: {mode: 'add' | 'edit'}) {
  const {listId = '', itemId = ''} = useParams();
  const navigate = useNavigate();
  const {listName, openItems, draft, setDraft, updateItem} = useLists();
  const [busy, setBusy] = useState(false);
  const continueMaterial = useMemo(() => MaterialLibrary.themedPrimaryGreen(), []);
  const item = mode === 'edit' ? openItems(listId)?.data?.find(entry => entry.id === itemId) : undefined;
  const key = mode === 'add' ? addDraftKey(listId) : editDraftKey(itemId);
  const text = draft(key) ?? (item ? editText(item, locale) : '');
  const name = listName(listId) ?? '';

  const fieldId = useId();
  useEffect(() => {
    const path = window.location.pathname;
    return registerRestorer(() => {
      const field = document.getElementById(fieldId);
      if (window.location.pathname === path && field && document.activeElement !== field) field.focus();
    });
  }, [fieldId]);

  // An Edit starts from the item's own text.
  useEffect(() => {
    if (mode === 'edit' && item && draft(key) === undefined) {
      setDraft(key, editText(item, locale));
    }
  }, [draft, item, key, mode, setDraft]);

  if (mode === 'edit' && !item) {
    return (
      <Page headerText={t('editHeader')} enableSystemBarInset={false}>
        <StateContent title={t('itemGoneTitle')} body={t('itemGoneBody')} ariaLabel={t('itemGoneTitle')} />
      </Page>
    );
  }

  const go = async () => {
    if (text.trim() === '' || busy) return;
    if (mode === 'add') {
      navigate(reviewPath(listId), {replace: true});
      return;
    }
    const change = item ? parseEdit(text, item, locale) : null;
    if (!item || !change) return;
    setBusy(true);
    const saved = await updateItem(item, change);
    setBusy(false);
    if (saved) {
      setDraft(key, undefined);
      navigate(-2);
    }
  };

  return (
    <Page headerText={mode === 'add' ? t('writeHeader') : t('editHeader')} headerMetadata={name || undefined} enableSystemBarInset={false}>
      <div className="write-page-shell">
        <ScrollView insetForHeader ariaLabel={mode === 'add' ? t('itemsFieldLabel') : t('editFieldLabel')}>
          <div className="content-inset">
            <InputTextView
              text={text}
              hint={mode === 'add' ? t('itemsHint') : t('editHint')}
              onTextChange={value => setDraft(key, value)}
              showLoader={busy}
              loadingLabel={t('loadingLabel')}
              inputProps={{id: fieldId, 'aria-label': mode === 'add' ? t('itemsFieldLabel') : t('editFieldLabel'), maxLength: 2000}}
            />
            {mode === 'add' ? (
              <TextView as="p" className="write-example" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
                {t('writeExample')}
              </TextView>
            ) : null}
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonRail>
            <Button
              title={mode === 'add' ? t('continue') : t('save')}
              alwaysShowText
              material={continueMaterial}
              disabled={text.trim() === '' || busy}
              initialFocusEligible={false}
              onClick={() => void go()}
            />
          </ButtonRail>
        </div>
        <div className="hint-dock">
          <ActionHint text={t('hintCompose')} />
          <ActionHint text={t('hintBack')} />
        </div>
      </div>
    </Page>
  );
}
