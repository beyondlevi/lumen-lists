/** Focuses a row from its component handle (or element). */
export function focusHandle(handle: unknown): void {
  if (handle != null && typeof handle === 'object' && 'getElement' in handle && typeof handle.getElement === 'function') {
    const element: unknown = handle.getElement();
    if (element instanceof HTMLElement) {
      element.focus();
    }
  } else if (handle instanceof HTMLElement) {
    handle.focus();
  }
}

/** The row to focus when `id` leaves a list: the next one, else the previous one, else `fallback`. */
export function successorOf(ids: readonly string[], id: string, fallback: string): string {
  const index = ids.indexOf(id);
  if (index === -1) {
    return fallback;
  }
  return ids[index + 1] ?? ids[index - 1] ?? fallback;
}
