import clockFilled from '@wearables-ui-toolkit/icons/svg/clock__filled.svg';
import circleAlertFilled from '@wearables-ui-toolkit/icons/svg/circlealert__filled.svg';
import {IconTintColor, SubtitleTextColor, type IconSource} from '@wearables-ui-toolkit/mrbd';
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
  secondaryIcon?: IconSource;
  secondaryIconTintColor?: IconTintColor;
};

/**
 * A task row's second line: the due date and, on Pending, the list, in the
 * primary text color so it reads on the glasses' green display, where colors
 * turn into brightness. Overdue and today are told by an icon before it (an
 * alert, a clock), not by the color of the text.
 */
export function secondLine(due: string, list: string, tone: DueTone): SecondLine {
  if (!due) return {subtitle: list || undefined};
  return {
    subtitle: list ? dueAndList(due, list) : due,
    subtitleTextColor: SubtitleTextColor.PRIMARY,
    ...(tone === 'overdue' ? {secondaryIcon: circleAlertFilled, secondaryIconTintColor: IconTintColor.PRIMARY} : {}),
    ...(tone === 'today' ? {secondaryIcon: clockFilled, secondaryIconTintColor: IconTintColor.PRIMARY} : {}),
  };
}

/** A due line alone (Review). */
export function dueLine(due: string, tone: DueTone): SecondLine {
  return secondLine(due, '', tone);
}
