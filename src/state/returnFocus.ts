// Back restores a route's focus by the row's position. When the rows of a
// list change while another route is open (an item put back from the cart,
// items added), that position points at another row, so the list remembers
// which row opened the route and focuses it again once the way back is done.
// Routes reached with `replace` (Review and Add items swap places) get no
// stored focus; they register here to put it where it belongs.

const returnRows = new Map<string, string>();
const restorers = new Set<() => void>();

/** Remembers the row of `listId` that opened another route. */
export function rememberReturnRow(listId: string, row: string): void {
  returnRows.set(listId, row);
}

/** Takes (and forgets) the row to focus when coming back to `listId`. */
export function takeReturnRow(listId: string): string | undefined {
  const row = returnRows.get(listId);
  returnRows.delete(listId);
  return row;
}

/** A mounted route registers how to restore its focus; returns the unregister function. Each checks its own path. */
export function registerRestorer(run: () => void): () => void {
  restorers.add(run);
  return () => {
    restorers.delete(run);
  };
}

/** Called when a route transition ends. */
export function restoreReturnRow(): void {
  for (const run of restorers) run();
}
