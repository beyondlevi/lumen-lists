// Every user-facing string lives in this file. English is the default and the
// fallback; Portuguese is chosen for any `pt-*` language. Counted strings have
// `_one` and `_other` forms.

const en = {
  appName: 'Lists',

  tabLists: 'Lists',
  tabNew: 'New',
  homeLabel: 'Lists for Lumen',
  listsLabel: 'Your TickTick lists',
  toBuy_one: '{count} to buy',
  toBuy_other: '{count} to buy',
  allBought: 'All bought',
  noListsTitle: 'No lists yet',
  noListsBody: 'Create a list here, or in TickTick on your phone or computer.',
  newListAction: 'New list',

  newListLabel: 'New list',
  newListHint: 'List name',
  newListFieldLabel: 'Name of the new list',
  create: 'Create',
  listCreated: '{name} created',
  createFailed: "Couldn't create the list",

  listLabel: 'Items to buy in {name}',
  left: '{left} of {total} left',
  nothingToBuy: 'Nothing to buy',
  addItems: 'Add items',
  inTheCart: 'In the cart',
  hintCheck: 'Index tap: in the cart',
  hintOptions: 'Swipe right: options',
  completeFailed: "Couldn't put {title} in the cart",

  cartLabel: 'Items in the cart',
  cartEmptyTitle: 'Nothing in the cart',
  cartEmptyBody: 'What you put in the cart in the last 24 hours shows up here.',
  hintReopen: 'Index tap: back to the list',
  reopened: '{title} back in the list',
  reopenFailed: "Couldn't put {title} back in the list",

  writeHeader: 'Add items',
  editHeader: 'Edit item',
  itemsHint: 'One or more items',
  itemsFieldLabel: 'Items to add',
  editHint: 'The item',
  editFieldLabel: 'Item text',
  writeExample: '“Milk, two kilos of rice and coffee filters”',
  continue: 'Continue',
  hintCompose: 'Index tap: dictate or write with the band',
  hintBack: 'Middle tap: back',
  save: 'Save',
  saved: 'Saved',
  saveFailed: "Couldn't save the item",

  reviewHeader_one: 'Add {count} item',
  reviewHeader_other: 'Add {count} items',
  reviewLabel: 'Items understood',
  addCount_one: 'Add {count}',
  addCount_other: 'Add {count}',
  edit: 'Edit',
  discard: 'Discard',
  alreadyInList: 'Already in the list',
  nothingUnderstoodTitle: 'No items understood',
  nothingUnderstoodBody: 'Go back and dictate or write one or more items.',
  added_one: '{count} item added',
  added_other: '{count} items added',
  addFailed: "Couldn't add the items",

  optionsLabel: 'Options for {title}',
  editSubtitle: 'Dictate or write',
  delete: 'Delete',
  itemGoneTitle: 'This item is gone',
  itemGoneBody: 'It was changed or removed in TickTick.',

  deleteHeader: 'Delete item',
  deleteBody: '{title} will be deleted from {list}, in TickTick too.',
  deleted: '{title} deleted',
  deleteFailed: "Couldn't delete {title}",

  setupHeader: 'Connect TickTick',
  setupLabel: 'Connect TickTick',
  setupStep1: 'On ticktick.com: Settings › Account › API Token. Create one and copy it.',
  setupStep2: 'On your phone, open Lumen › Apps › Lists and paste it.',
  setupStep3: 'Come back here: your TickTick lists show up.',
  setupNote: 'Your lists stay in TickTick: the phone and the computer see the same items.',
  setupRefusedTitle: 'TickTick refused the token',
  setupRefusedBody: 'Create a new API token and paste it in Lumen on your phone.',
  setupInvalidTitle: 'That token looks wrong',
  setupInvalidBody: 'Copy the API token again, with nothing around it.',
  stillMissing: 'Still missing',
  retry: 'Try again',

  loadingHeader: 'Loading…',
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
  appName: 'Listas',

  tabLists: 'Listas',
  tabNew: 'Nova',
  homeLabel: 'Lists for Lumen',
  listsLabel: 'Suas listas do TickTick',
  toBuy_one: '{count} para comprar',
  toBuy_other: '{count} para comprar',
  allBought: 'Tudo comprado',
  noListsTitle: 'Nenhuma lista ainda',
  noListsBody: 'Crie uma lista aqui, ou no TickTick do celular ou do computador.',
  newListAction: 'Nova lista',

  newListLabel: 'Nova lista',
  newListHint: 'Nome da lista',
  newListFieldLabel: 'Nome da nova lista',
  create: 'Criar',
  listCreated: '{name} criada',
  createFailed: 'Não foi possível criar a lista',

  listLabel: 'Itens para comprar em {name}',
  left: 'faltam {left} de {total}',
  nothingToBuy: 'Nada para comprar',
  addItems: 'Adicionar itens',
  inTheCart: 'No carrinho',
  hintCheck: 'Toque do indicador: no carrinho',
  hintOptions: 'Deslize à direita: opções',
  completeFailed: 'Não foi possível pôr {title} no carrinho',

  cartLabel: 'Itens no carrinho',
  cartEmptyTitle: 'Nada no carrinho',
  cartEmptyBody: 'O que você pôs no carrinho nas últimas 24 horas aparece aqui.',
  hintReopen: 'Toque do indicador: volta para a lista',
  reopened: '{title} de volta na lista',
  reopenFailed: 'Não foi possível devolver {title} para a lista',

  writeHeader: 'Adicionar itens',
  editHeader: 'Editar item',
  itemsHint: 'Um ou mais itens',
  itemsFieldLabel: 'Itens para adicionar',
  editHint: 'O item',
  editFieldLabel: 'Texto do item',
  writeExample: '“Leite, dois quilos de arroz e filtro de café”',
  continue: 'Continuar',
  hintCompose: 'Toque do indicador: dite ou escreva com a pulseira',
  hintBack: 'Toque do médio: voltar',
  save: 'Salvar',
  saved: 'Salvo',
  saveFailed: 'Não foi possível salvar o item',

  reviewHeader_one: 'Adicionar {count} item',
  reviewHeader_other: 'Adicionar {count} itens',
  reviewLabel: 'Itens entendidos',
  addCount_one: 'Adicionar {count}',
  addCount_other: 'Adicionar {count}',
  edit: 'Editar',
  discard: 'Descartar',
  alreadyInList: 'Já está na lista',
  nothingUnderstoodTitle: 'Nenhum item entendido',
  nothingUnderstoodBody: 'Volte e dite ou escreva um ou mais itens.',
  added_one: '{count} item adicionado',
  added_other: '{count} itens adicionados',
  addFailed: 'Não foi possível adicionar os itens',

  optionsLabel: 'Opções de {title}',
  editSubtitle: 'Dite ou escreva',
  delete: 'Apagar',
  itemGoneTitle: 'Este item não existe mais',
  itemGoneBody: 'Ele foi alterado ou removido no TickTick.',

  deleteHeader: 'Apagar item',
  deleteBody: '{title} será apagado de {list}, também no TickTick.',
  deleted: '{title} apagado',
  deleteFailed: 'Não foi possível apagar {title}',

  setupHeader: 'Conectar TickTick',
  setupLabel: 'Conectar o TickTick',
  setupStep1: 'No ticktick.com: Configurações › Conta › API Token. Crie um e copie.',
  setupStep2: 'No celular, abra Lumen › Apps › Lists e cole o token.',
  setupStep3: 'Volte aqui: suas listas do TickTick aparecem.',
  setupNote: 'Suas listas ficam no TickTick: o celular e o computador veem os mesmos itens.',
  setupRefusedTitle: 'O TickTick recusou o token',
  setupRefusedBody: 'Crie um novo API token e cole no Lumen do celular.',
  setupInvalidTitle: 'Esse token parece errado',
  setupInvalidBody: 'Copie o API token de novo, sem nada em volta.',
  stillMissing: 'Ainda falta',
  retry: 'Tentar de novo',

  loadingHeader: 'Carregando…',
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

/** A counted string: `tp('toBuy', 3)` → "3 to buy". */
export function tp(key: PluralKey, count: number, params?: Params): string {
  return translatePlural(locale, key, count, params);
}

export const dictionaryKeys = {en: Object.keys(en), pt: Object.keys(pt)};
