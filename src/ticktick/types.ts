/** A TickTick list (project) as the app uses it. */
export type List = {
  id: string;
  name: string;
};

/** A task in a list: one thing to buy. */
export type Item = {
  id: string;
  listId: string;
  title: string;
  /** The task's content: the quantity or a note, shown as the row's second line. */
  note: string;
  sortOrder: number;
  /** When it went in the cart (ms since the epoch), for completed items. */
  completedAt: number | null;
};

/** A list on the start screen, with how many items are still to buy. */
export type ListSummary = List & {open: number};

/** What the parser understood: a title and, when said, a quantity. */
export type NewItem = {
  title: string;
  note: string;
};

export type ReopenResult = {
  /** `updated`: TickTick took `status: 0`. `recreated`: a new task replaced it. */
  path: 'updated' | 'recreated';
  item: Item;
};

export type ApiErrorKind = 'auth' | 'network' | 'notfound' | 'ratelimit' | 'server' | 'rejected';

export class TickTickError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, status: number | null = null) {
    super(status != null ? `TickTick ${kind} (HTTP ${status})` : `TickTick ${kind}`);
    this.name = 'TickTickError';
    this.kind = kind;
    this.status = status;
  }
}

/** Everything the screens need from TickTick (or from demo mode). */
export interface ListsApi {
  /** The open task lists (not notes, not closed). */
  lists(): Promise<List[]>;
  /** The open items of a list, in the list's order. */
  openItems(listId: string): Promise<Item[]>;
  /** The items completed in this list in the 24 hours before `now`, newest first. */
  cart(listId: string, now?: number): Promise<Item[]>;
  /** Adds items at the end of the list, in this order, after `afterSortOrder`. */
  addItems(listId: string, items: NewItem[], afterSortOrder?: number): Promise<void>;
  complete(item: Item): Promise<void>;
  /** Puts a completed item back in its list (see reopenItem in client.ts). */
  reopen(item: Item): Promise<ReopenResult>;
  update(item: Item, change: NewItem): Promise<Item>;
  remove(item: Item): Promise<void>;
  createList(name: string): Promise<List>;
}
