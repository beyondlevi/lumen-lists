import {ActionHint, Button, ButtonRail, InputTextView, MaterialLibrary, Page, ScrollView, TextColor, TextStyle, TextView} from '@wearables-ui-toolkit/mrbd';
import {useEffect, useId, useMemo} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {t} from '../i18n/strings';
import {PENDING_CONTEXT, reviewPath} from '../paths';
import {registerRestorer} from '../state/returnFocus';
import {listName} from '../tasks/labels';
import {useTasks} from '../TasksProvider';

/**
 * Add tasks: a real text field. Enter on it opens Lumen's composer (dictation
 * or writing with the band), which fills the field through `input` and
 * `change` events; Continue goes on to Review.
 */
export function WritePage() {
  const {listId = ''} = useParams();
  const navigate = useNavigate();
  const {list, inboxId, writeDraft, setWriteDraft, reviewList} = useTasks();
  const continueMaterial = useMemo(() => MaterialLibrary.themedPrimaryBlue(), []);
  const context = listId || PENDING_CONTEXT;
  const text = writeDraft(context) ?? '';
  const target = reviewList(context) ?? (listId || inboxId || '');
  const fieldId = useId();

  useEffect(() => {
    const path = window.location.pathname;
    return registerRestorer(() => {
      const field = document.getElementById(fieldId);
      if (window.location.pathname === path && field && document.activeElement !== field) field.focus();
    });
  }, [fieldId]);

  const go = () => {
    if (text.trim() === '') return;
    navigate(reviewPath(context), {replace: true});
  };

  return (
    <Page headerText={t('writeHeader')} headerMetadata={listName(list(target)) || undefined} enableSystemBarInset={false}>
      <div className="write-page-shell">
        <ScrollView insetForHeader ariaLabel={t('tasksFieldLabel')}>
          <div className="content-inset">
            <InputTextView
              text={text}
              hint={t('tasksHint')}
              onTextChange={value => setWriteDraft(context, value)}
              inputProps={{id: fieldId, 'aria-label': t('tasksFieldLabel'), maxLength: 2000}}
            />
            <TextView as="p" className="write-example" textStyle={TextStyle.LABEL} textColor={TextColor.SECONDARY}>
              {t('writeExample')}
            </TextView>
          </div>
        </ScrollView>
        <div className="action-dock">
          <ButtonRail>
            <Button
              title={t('continue')}
              alwaysShowText
              material={continueMaterial}
              disabled={text.trim() === ''}
              initialFocusEligible={false}
              onClick={go}
            />
          </ButtonRail>
        </div>
        <div className="hint-dock">
          <ActionHint text={t('hintCompose')} />
          <ActionHint text={t('hintMiddleBack')} />
        </div>
      </div>
    </Page>
  );
}
