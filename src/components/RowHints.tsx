import {ActionHint} from '@wearables-ui-toolkit/mrbd';
import {t, type StringKey} from '../i18n/strings';
import type {SwipeSpot} from './taskRows';

const HINTS: Record<SwipeSpot, StringKey[]> = {
  row: ['hintComplete', 'hintOptions'],
  first: ['hintChoose', 'hintNext', 'hintClose'],
  middle: ['hintChoose', 'hintNext', 'hintPrevious'],
  last: ['hintChoose', 'hintPrevious'],
};

/** The band cues under a task list: on a row, complete and options; on its actions, choose and move. */
export function RowHints({spot}: {spot: SwipeSpot}) {
  return (
    <div className="hint-dock">
      {HINTS[spot].map(key => (
        <ActionHint key={key} text={t(key)} />
      ))}
    </div>
  );
}
