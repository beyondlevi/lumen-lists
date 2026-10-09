const id = (value: string) => encodeURIComponent(value);

/** Where Add tasks was opened: a list, or Pending (the tasks go to the Inbox by default). */
export const PENDING_CONTEXT = 'pending';

export const listPath = (listId: string) => `/list/${id(listId)}`;
export const completedPath = (listId: string) => `${listPath(listId)}/completed`;
const contextPath = (context: string) => (context === PENDING_CONTEXT ? '' : listPath(context));
export const addPath = (context: string) => `${contextPath(context)}/add`;
export const reviewPath = (context: string) => `${contextPath(context)}/review`;
export const reviewListPath = (context: string) => `${reviewPath(context)}/list`;
export const taskPath = (listId: string, taskId: string) => `/task/${id(listId)}/${id(taskId)}`;
export const editPath = (listId: string, taskId: string) => `${taskPath(listId, taskId)}/edit`;
export const editListPath = (listId: string, taskId: string) => `${editPath(listId, taskId)}/list`;
export const editPriorityPath = (listId: string, taskId: string) => `${editPath(listId, taskId)}/priority`;
export const deletePath = (listId: string, taskId: string) => `${taskPath(listId, taskId)}/delete`;
