const id = (value: string) => encodeURIComponent(value);

export const listPath = (listId: string) => `/list/${id(listId)}`;
export const addPath = (listId: string) => `${listPath(listId)}/add`;
export const reviewPath = (listId: string) => `${listPath(listId)}/review`;
export const cartPath = (listId: string) => `${listPath(listId)}/cart`;
export const itemPath = (listId: string, itemId: string) => `${listPath(listId)}/item/${id(itemId)}`;
export const editPath = (listId: string, itemId: string) => `${itemPath(listId, itemId)}/edit`;
export const deletePath = (listId: string, itemId: string) => `${itemPath(listId, itemId)}/delete`;

/** Draft keys: the text being written for a list, or for one item's Edit. */
export const addDraftKey = (listId: string) => `add:${listId}`;
export const editDraftKey = (itemId: string) => `edit:${itemId}`;
