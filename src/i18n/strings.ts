// Every user-facing string lives in this file. English is the default and the
// fallback; Portuguese is chosen for any `pt-*` language. Counted strings have
// `_one` and `_other` forms.

const en = {
  appName: 'TickTick',
  homeLabel: 'Unofficial TickTick for Lumen',

  tabPending: 'Pending',
  tabLists: 'Lists',
  tabNew: 'New',

  inbox: 'Inbox',
  today: 'Today',
  tomorrow: 'Tomorrow',
  yesterday: 'Yesterday',
  dayTime: '{day} {time}',
  namedDate: '{name}, {date}',
  dateTime: '{date} · {time}',
  dueAndList: '{due} · {list}',

  pendingLabel: 'Pending tasks',
  groupOverdue: 'Overdue',
  groupLater: 'Later',
  groupNoDate: 'No date',
  allDoneTitle: 'All done',
  allDoneBody: 'Nothing is pending in your lists.',

  listsLabel: 'Your TickTick lists',
  pendingCount_one: '{count} pending',
  pendingCount_other: '{count} pending',
  overdueCount_one: '{count} overdue',
  overdueCount_other: '{count} overdue',
  countPair: '{pending} · {overdue}',
  allDone: 'All done',
  noListsTitle: 'No lists yet',
  noListsBody: 'Create a list here, or in TickTick on your phone or computer.',
  newListAction: 'New list',

  newListLabel: 'New list',
  newListHint: 'List name',
  newListFieldLabel: 'Name of the new list',
  create: 'Create',
  listCreated: '{name} created',
  createFailed: "Couldn't create the list",

  listLabel: 'Tasks in {name}',
  addTasks: 'Add tasks',
  completedRow: 'Completed',
  nothingPending: 'Nothing pending',
  hintComplete: 'Index tap: complete',
  hintOptions: 'Swipe left: options',
  hintChoose: 'Index tap: choose',
  hintHide: 'Swipe right: back',
  actionView: 'View',
  actionEdit: 'Edit',
  actionDelete: 'Delete',
  completeFailed: "Couldn't complete {title}",

  completedHeader: 'Completed',
  completedMeta: '{list} · {count}',
  completedLabel: 'Completed tasks',
  completedEmptyTitle: 'Nothing completed',
  completedEmptyBody: 'Tasks completed in this list in the last 7 days show up here.',
  doneAt: 'Done {time}',
  doneYesterday: 'Done yesterday',
  doneOn: 'Done {date}',
  hintReopen: 'Index tap: back to pending',
  reopened: '{title} is pending again',
  reopenFailed: "Couldn't reopen {title}",

  taskHeader: 'Task',
  taskLabel: 'Task details',
  priority0: 'None',
  priority1: 'Low',
  priority3: 'Medium',
  priority5: 'High',
  priorityLine1: 'Low priority',
  priorityLine3: 'Medium priority',
  priorityLine5: 'High priority',
  noDue: 'No due date',
  overdueLine: '{due} · overdue',
  subtasks: 'Subtasks · {done} of {total} done',
  complete: 'Complete',
  edit: 'Edit',
  delete: 'Delete',
  taskGoneTitle: 'This task is gone',
  taskGoneBody: 'It was completed, changed or removed in TickTick.',

  editHeader: 'Edit task',
  titleHint: 'Title',
  titleLabel: 'Task title',
  dueHint: 'Due: tomorrow 3 pm',
  dueLabel: 'Due date: a day and time, or empty for none',
  listRow: 'List',
  priorityRow: 'Priority',
  save: 'Save',
  saved: 'Saved',
  saveFailed: "Couldn't save the task",
  dueInvalid: "Couldn't read that date",

  writeHeader: 'Add tasks',
  tasksHint: 'One or more tasks',
  tasksFieldLabel: 'Tasks to add',
  writeExample: '“Call João tomorrow at 3 pm and pay the rent on Friday”',
  continue: 'Continue',
  hintCompose: 'Index tap: dictate or write with the band',
  hintMiddleBack: 'Middle tap: back',

  reviewHeader_one: 'Add {count} task',
  reviewHeader_other: 'Add {count} tasks',
  reviewLabel: 'Tasks understood',
  addCount_one: 'Add {count}',
  addCount_other: 'Add {count}',
  discard: 'Discard',
  reviewHint: 'Index tap on a task leaves it out',
  nothingUnderstoodTitle: 'No tasks understood',
  nothingUnderstoodBody: 'Go back and dictate or write one or more tasks.',
  added_one: '{count} task added',
  added_other: '{count} tasks added',
  addFailed: "Couldn't add the tasks",

  deleteHeader: 'Delete task',
  deleteBody: '{title} will be deleted from {list}, in TickTick too.',
  deleted: '{title} deleted',
  deleteFailed: "Couldn't delete {title}",

  setupHeader: 'Connect TickTick',
  setupLabel: 'Connect TickTick',
  setupStep1: 'In TickTick: Settings › Account › API Token. Create one and copy it.',
  setupStep2: 'On your phone, open Lumen › Apps › TickTick and paste it.',
  setupStep3: 'Come back here: your tasks and lists show up.',
  setupNote: 'Unofficial: not made by TickTick. Your tasks stay in your TickTick account.',
  setupRefusedTitle: 'TickTick refused the token',
  setupRefusedBody: 'Create a new API token and paste it in Lumen on your phone.',
  setupInvalidTitle: 'That token looks wrong',
  setupInvalidBody: 'Copy the API token again, with nothing around it.',
  stillMissing: 'Still missing',
  retry: 'Try again',

  loadingLabel: 'Loading',
  errorLabel: 'Error',
  errNetworkTitle: "Can't reach TickTick",
  errNetworkBody: 'Check the internet connection. Trying again by itself.',
  errServerTitle: 'TickTick is not answering',
  errServerBody: 'Try again in a moment.',
  errRateTitle: 'Too many requests',
  errRateBody: 'TickTick asked the app to slow down. Try again in a minute.',
  errNotFoundTitle: 'List not found',
  errNotFoundBody: 'It was deleted or closed in TickTick.',
  errRejectedTitle: 'TickTick refused it',
  errRejectedBody: 'Try again, or check the list in TickTick.',
  httpStatus: 'HTTP {status}',
};

export type StringKey = keyof typeof en;
type Strings = Record<StringKey, string>;

const pt: Strings = {
  appName: 'TickTick',
  homeLabel: 'TickTick não oficial para o Lumen',

  tabPending: 'Pendentes',
  tabLists: 'Listas',
  tabNew: 'Nova',

  inbox: 'Caixa de entrada',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  yesterday: 'Ontem',
  dayTime: '{day} {time}',
  namedDate: '{name}, {date}',
  dateTime: '{date} · {time}',
  dueAndList: '{due} · {list}',

  pendingLabel: 'Tarefas pendentes',
  groupOverdue: 'Atrasadas',
  groupLater: 'Mais tarde',
  groupNoDate: 'Sem data',
  allDoneTitle: 'Tudo feito',
  allDoneBody: 'Nada pendente nas suas listas.',

  listsLabel: 'Suas listas do TickTick',
  pendingCount_one: '{count} pendente',
  pendingCount_other: '{count} pendentes',
  overdueCount_one: '{count} atrasada',
  overdueCount_other: '{count} atrasadas',
  countPair: '{pending} · {overdue}',
  allDone: 'Tudo feito',
  noListsTitle: 'Nenhuma lista ainda',
  noListsBody: 'Crie uma lista aqui, ou no TickTick do celular ou do computador.',
  newListAction: 'Nova lista',

  newListLabel: 'Nova lista',
  newListHint: 'Nome da lista',
  newListFieldLabel: 'Nome da nova lista',
  create: 'Criar',
  listCreated: '{name} criada',
  createFailed: 'Não foi possível criar a lista',

  listLabel: 'Tarefas em {name}',
  addTasks: 'Adicionar tarefas',
  completedRow: 'Concluídas',
  nothingPending: 'Nada pendente',
  hintComplete: 'Toque do indicador: concluir',
  hintOptions: 'Deslize à esquerda: opções',
  hintChoose: 'Toque do indicador: escolher',
  hintHide: 'Deslize à direita: voltar',
  actionView: 'Ver',
  actionEdit: 'Editar',
  actionDelete: 'Apagar',
  completeFailed: 'Não foi possível concluir {title}',

  completedHeader: 'Concluídas',
  completedMeta: '{list} · {count}',
  completedLabel: 'Tarefas concluídas',
  completedEmptyTitle: 'Nada concluído',
  completedEmptyBody: 'As tarefas concluídas nesta lista nos últimos 7 dias aparecem aqui.',
  doneAt: 'Feita às {time}',
  doneYesterday: 'Feita ontem',
  doneOn: 'Feita em {date}',
  hintReopen: 'Toque do indicador: volta para pendentes',
  reopened: '{title} pendente de novo',
  reopenFailed: 'Não foi possível reabrir {title}',

  taskHeader: 'Tarefa',
  taskLabel: 'Detalhes da tarefa',
  priority0: 'Nenhuma',
  priority1: 'Baixa',
  priority3: 'Média',
  priority5: 'Alta',
  priorityLine1: 'Prioridade baixa',
  priorityLine3: 'Prioridade média',
  priorityLine5: 'Prioridade alta',
  noDue: 'Sem prazo',
  overdueLine: '{due} · atrasada',
  subtasks: 'Subtarefas · {done} de {total} feitas',
  complete: 'Concluir',
  edit: 'Editar',
  delete: 'Apagar',
  taskGoneTitle: 'Esta tarefa não existe mais',
  taskGoneBody: 'Ela foi concluída, alterada ou removida no TickTick.',

  editHeader: 'Editar tarefa',
  titleHint: 'Título',
  titleLabel: 'Título da tarefa',
  dueHint: 'Prazo: amanhã 15h',
  dueLabel: 'Prazo: um dia e hora, ou vazio para nenhum',
  listRow: 'Lista',
  priorityRow: 'Prioridade',
  save: 'Salvar',
  saved: 'Salvo',
  saveFailed: 'Não foi possível salvar a tarefa',
  dueInvalid: 'Não foi possível entender essa data',

  writeHeader: 'Adicionar tarefas',
  tasksHint: 'Uma ou mais tarefas',
  tasksFieldLabel: 'Tarefas para adicionar',
  writeExample: '“Ligar para o João amanhã às 15h e pagar o aluguel na sexta”',
  continue: 'Continuar',
  hintCompose: 'Toque do indicador: dite ou escreva com a pulseira',
  hintMiddleBack: 'Toque do médio: voltar',

  reviewHeader_one: 'Adicionar {count} tarefa',
  reviewHeader_other: 'Adicionar {count} tarefas',
  reviewLabel: 'Tarefas entendidas',
  addCount_one: 'Adicionar {count}',
  addCount_other: 'Adicionar {count}',
  discard: 'Descartar',
  reviewHint: 'Toque do indicador numa tarefa a deixa de fora',
  nothingUnderstoodTitle: 'Nenhuma tarefa entendida',
  nothingUnderstoodBody: 'Volte e dite ou escreva uma ou mais tarefas.',
  added_one: '{count} tarefa adicionada',
  added_other: '{count} tarefas adicionadas',
  addFailed: 'Não foi possível adicionar as tarefas',

  deleteHeader: 'Apagar tarefa',
  deleteBody: '{title} será apagada de {list}, também no TickTick.',
  deleted: '{title} apagada',
  deleteFailed: 'Não foi possível apagar {title}',

  setupHeader: 'Conectar TickTick',
  setupLabel: 'Conectar o TickTick',
  setupStep1: 'No TickTick: Configurações › Conta › API Token. Crie um e copie.',
  setupStep2: 'No celular, abra Lumen › Apps › TickTick e cole o token.',
  setupStep3: 'Volte aqui: suas tarefas e listas aparecem.',
  setupNote: 'Não oficial: não é feito pela TickTick. Suas tarefas ficam na sua conta do TickTick.',
  setupRefusedTitle: 'O TickTick recusou o token',
  setupRefusedBody: 'Crie um novo API token e cole no Lumen do celular.',
  setupInvalidTitle: 'Esse token parece errado',
  setupInvalidBody: 'Copie o API token de novo, sem nada em volta.',
  stillMissing: 'Ainda falta',
  retry: 'Tentar de novo',

  loadingLabel: 'Carregando',
  errorLabel: 'Erro',
  errNetworkTitle: 'Sem acesso ao TickTick',
  errNetworkBody: 'Verifique a internet. O app tenta de novo sozinho.',
  errServerTitle: 'O TickTick não está respondendo',
  errServerBody: 'Tente de novo daqui a pouco.',
  errRateTitle: 'Pedidos demais',
  errRateBody: 'O TickTick pediu para o app ir mais devagar. Tente de novo daqui a um minuto.',
  errNotFoundTitle: 'Lista não encontrada',
  errNotFoundBody: 'Ela foi apagada ou fechada no TickTick.',
  errRejectedTitle: 'O TickTick recusou',
  errRejectedBody: 'Tente de novo, ou confira a lista no TickTick.',
  httpStatus: 'HTTP {status}',
};

const dictionaries = {en, pt} satisfies Record<string, Strings>;
export type Locale = keyof typeof dictionaries;

/** Picks the dictionary from the base language (`pt-PT` and `pt-BR` both map to `pt`). */
export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'pt' || base === 'en') {
      return base;
    }
  }
  return 'en';
}

function browserLanguages(): string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }
  return navigator.languages?.length ? [...navigator.languages] : navigator.language ? [navigator.language] : [];
}

/** Language in use: the device's. */
export const locale: Locale = resolveLocale(browserLanguages());

type Params = Record<string, string | number>;

function fill(template: string, params?: Params): string {
  if (params == null) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translate(target: Locale, key: StringKey, params?: Params): string {
  return fill(dictionaries[target][key] ?? dictionaries.en[key], params);
}

export function t(key: StringKey, params?: Params): string {
  return translate(locale, key, params);
}

/** Keys that have `_one`/`_other` forms, without the suffix. */
export type PluralKey = {
  [K in StringKey]: K extends `${infer Base}_one` ? (`${Base}_other` extends StringKey ? Base : never) : never;
}[StringKey];

export function formatNumber(value: number, target: Locale = locale): string {
  return new Intl.NumberFormat(target === 'pt' ? 'pt-BR' : 'en-US').format(value);
}

export function translatePlural(target: Locale, key: PluralKey, count: number, params?: Params): string {
  const form = new Intl.PluralRules(target).select(count) === 'one' ? 'one' : 'other';
  const full: StringKey = form === 'one' ? `${key}_one` : `${key}_other`;
  return translate(target, full, {count: formatNumber(count, target), ...params});
}

/** A counted string: `tp('pendingCount', 3)` → "3 pending". */
export function tp(key: PluralKey, count: number, params?: Params): string {
  return translatePlural(locale, key, count, params);
}

export const dictionaryKeys = {en: Object.keys(en), pt: Object.keys(pt)};
