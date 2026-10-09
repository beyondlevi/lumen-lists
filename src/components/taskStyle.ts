import {IconTintColor, SubtitleTextColor, TimestampPosition, TimestampTextColor} from '@wearables-ui-toolkit/mrbd';
import type {DueTone} from '../tasks/due';
import {dueAndList} from '../tasks/labels';
import type {Priority} from '../ticktick/types';

/** The checkbox in the priority's color: high red, medium yellow, low blue, none gray. */
export const PRIORITY_TINT: Record<Priority, IconTintColor> = {
  0: IconTintColor.SECONDARY,
  1: IconTintColor.ACCENT,
  3: IconTintColor.WARNING,
  5: IconTintColor.NEGATIVE,
};

type SecondLine = {
  subtitle?: string;
  subtitleTextColor?: SubtitleTextColor;
  timestamp?: string;
  timestampPosition?: TimestampPosition;
  timestampTextColor?: TimestampTextColor;
};

/**
 * A task row's second line: the due date and, on Pending, the list. Today's
 * date is in the accent color, before the list; an overdue line is red.
 */
export function secondLine(due: string, list: string, tone: DueTone): SecondLine {
  if (!due) return {subtitle: list || undefined};
  if (tone === 'today') {
    return {subtitle: list || undefined, timestamp: due, timestampPosition: TimestampPosition.SUBTITLE, timestampTextColor: TimestampTextColor.ACCENT};
  }
  return {
    subtitle: list ? dueAndList(due, list) : due,
    subtitleTextColor: tone === 'overdue' ? SubtitleTextColor.NEGATIVE : undefined,
  };
}

/** A due line alone (Review): red when overdue, the accent color when today. */
export function dueLine(due: string, tone: DueTone): SecondLine {
  return secondLine(due, '', tone);
}
