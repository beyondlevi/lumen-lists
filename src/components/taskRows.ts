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

/** Rows carry `data-task-row`; anything else that takes the input inside a row is one of its actions. */
export const TASK_ROW_ATTRIBUTE = 'data-task-row';
export const revealedBy = (event: FocusEvent<HTMLElement>) => !event.target.hasAttribute(TASK_ROW_ATTRIBUTE);
