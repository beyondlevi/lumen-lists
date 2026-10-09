import type {KeyboardEvent} from 'react';

const mirrored = new WeakSet<Event>();
const OTHER_SIDE: Record<string, string> = {ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft'};

/**
 * Swaps ArrowLeft and ArrowRight inside a SwipeToReveal, so the wearer's swipe
 * to the left reveals the actions and the swipe to the right hides them. The
 * original key never reaches the component; the same event with the other key
 * is sent from where it came.
 */
export function mirrorArrows(event: KeyboardEvent<HTMLElement>): void {
  const other = OTHER_SIDE[event.key];
  const native = event.nativeEvent;
  if (!other || mirrored.has(native) || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  event.stopPropagation();
  const copy = new KeyboardEvent(native.type, {key: other, code: other, bubbles: true, cancelable: true, composed: true, repeat: native.repeat});
  mirrored.add(copy);
  event.target.dispatchEvent(copy);
}
