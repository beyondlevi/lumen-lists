import eyeFilled from '@wearables-ui-toolkit/icons/svg/eye__filled.svg';
import pencilFilled from '@wearables-ui-toolkit/icons/svg/pencil__filled.svg';
import trashFilled from '@wearables-ui-toolkit/icons/svg/trash__filled.svg';
import type {SwipeToRevealAction} from '@wearables-ui-toolkit/mrbd';
import type {FocusEvent} from 'react';
import {t} from '../i18n/strings';
import type {Task} from '../ticktick/types';

export type RowActions = {
  onView(task: Task): void;
  onEdit(task: Task): void;
  onDelete(task: Task): void;
};

/** View, Edit and Delete, icons only, for one task's row. */
export function swipeActions(task: Task, {onView, onEdit, onDelete}: RowActions): [SwipeToRevealAction, SwipeToRevealAction, SwipeToRevealAction] {
  return [
    {icon: eyeFilled, contentDescription: t('actionView'), onClick: () => onView(task)},
    {icon: pencilFilled, contentDescription: t('actionEdit'), onClick: () => onEdit(task)},
    {icon: trashFilled, contentDescription: t('actionDelete'), onClick: () => onDelete(task)},
  ];
}

/** Where the wearer is in a row: on the row itself, or on its first, middle or last action. */
export type SwipeSpot = 'row' | 'first' | 'middle' | 'last';

/** Rows carry `data-task-row`; anything else that takes the input inside a row is one of its actions, named by its label. */
export const TASK_ROW_ATTRIBUTE = 'data-task-row';
export function spotOf(event: FocusEvent<HTMLElement>): SwipeSpot {
  if (event.target.hasAttribute(TASK_ROW_ATTRIBUTE)) return 'row';
  const label = event.target.getAttribute('aria-label');
  if (label === t('actionView')) return 'first';
  if (label === t('actionDelete')) return 'last';
  return 'middle';
}
