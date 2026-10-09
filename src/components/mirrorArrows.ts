import type {KeyboardEvent} from 'react';

const mirrored = new WeakSet<Event>();
const OTHER_SIDE: Record<string, string> = {ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft'};

/**
 * On a task's row inside a SwipeToReveal, swaps ArrowLeft and ArrowRight, so
 * the wearer's swipe to the left reveals the actions. Once the actions show,
 * the keys go through as they are: right to the next action, left to the
 * previous one, and left from the first action back to the row. The original
 * key never reaches the component; the same event with the other key is sent
 * from where it came.
 */
export function mirrorArrows(event: KeyboardEvent<HTMLElement>): void {
  const other = OTHER_SIDE[event.key];
  const native = event.nativeEvent;
  const onRow = event.target instanceof Element && event.target.hasAttribute('data-task-row');
  if (!other || !onRow || mirrored.has(native) || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  event.stopPropagation();
  const copy = new KeyboardEvent(native.type, {key: other, code: other, bubbles: true, cancelable: true, composed: true, repeat: native.repeat});
  mirrored.add(copy);
  event.target.dispatchEvent(copy);
}
