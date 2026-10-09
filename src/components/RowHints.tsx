import {ActionHint} from '@wearables-ui-toolkit/mrbd';
import {t} from '../i18n/strings';

/** The band cues under a task list: complete and options, or choose and back while the options show. */
export function RowHints({revealed}: {revealed: boolean}) {
  return (
    <div className="hint-dock">
      <ActionHint text={revealed ? t('hintChoose') : t('hintComplete')} />
      <ActionHint text={revealed ? t('hintHide') : t('hintOptions')} />
    </div>
  );
}
