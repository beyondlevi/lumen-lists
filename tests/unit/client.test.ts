import {describe, expect, it} from 'vitest';
import {
  cartFrom,
  createClient,
  createRequest,
  formatDate,
  openItemsFrom,
  openTaskLists,
  parseDate,
  reopenItem,
  SORT_STEP,
  type Request,
} from '../../src/ticktick/client';
import {TickTickError, type Item} from '../../src/ticktick/types';

type Call = {method: string; url: string; headers: Record<string, string>; body: unknown};

/** A fetch that records calls and answers from `respond`. */
function fakeFetch(respond: (call: Call) => {status?: number; body?: unknown} | Error) {
  const calls: Call[] = [];
  const fetch = async (input: string, init?: RequestInit) => {
    const call = {
      method: init?.method ?? 'GET',
      url: input,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const answer = respond(call);
    if (answer instanceof Error) throw answer;
    const text = answer.body === undefined ? '' : JSON.stringify(answer.body);
    return new Response(text, {status: answer.status ?? 200});
  };
  return {calls, fetch};
}

const ITEM: Item = {id: 't1', listId: 'p1', title: 'Bread', note: '1 loaf', sortOrder: 3 * SORT_STEP, completedAt: 1_700_000_000_000};

describe('mapping TickTick answers', () => {
  it('keeps open task lists, in their order', () => {
    expect(
      openTaskLists([
        {id: 'b', name: 'Pharmacy', sortOrder: 2, kind: 'TASK'},
        {id: 'a', name: 'Groceries', sortOrder: 1},
        {id: 'n', name: 'Recipes', kind: 'NOTE'},
        {id: 'c', name: 'Old', closed: true},
        {name: 'no id'},
      ]),
    ).toEqual([
      {id: 'a', name: 'Groceries'},
      {id: 'b', name: 'Pharmacy'},
    ]);
    expect(() => openTaskLists({})).toThrow(TickTickError);
  });

  it('maps open tasks with their content as the note', () => {
    expect(
      openItemsFrom(
        {
          project: {id: 'p1'},
          tasks: [
            {id: 't2', projectId: 'p1', title: ' Milk ', content: '2 boxes', status: 0, sortOrder: 20},
            {id: 't1', projectId: 'p1', title: 'Rice', desc: 'brown', status: 0, sortOrder: 10},
            {id: 't3', projectId: 'p1', title: 'Done', status: 2, sortOrder: 5},
          ],
        },
        'p1',
      ),
    ).toEqual([
      {id: 't1', listId: 'p1', title: 'Rice', note: 'brown', sortOrder: 10, completedAt: null},
      {id: 't2', listId: 'p1', title: 'Milk', note: '2 boxes', sortOrder: 20, completedAt: null},
    ]);
  });

  it('maps completed tasks, newest first, of this list only', () => {
    const cart = cartFrom(
      [
        {id: 'a', projectId: 'p1', title: 'Eggs', status: 2, completedTime: '2026-10-09T10:00:00.000+0000'},
        {id: 'b', projectId: 'p1', title: 'Bread', status: 2, completedTime: '2026-10-09T11:30:00+0000'},
        {id: 'c', projectId: 'p2', title: 'Other', status: 2, completedTime: '2026-10-09T12:00:00+0000'},
      ],
      'p1',
    );
    expect(cart.map(entry => entry.title)).toEqual(['Bread', 'Eggs']);
    expect(cart[0].completedAt).toBe(Date.UTC(2026, 9, 9, 11, 30));
  });

  it('formats and reads TickTick dates', () => {
    expect(formatDate(Date.UTC(2026, 2, 1, 0, 58, 20))).toBe('2026-03-01T00:58:20.000+0000');
    expect(parseDate('2019-11-13T03:00:00+0000')).toBe(Date.UTC(2019, 10, 13, 3));
    expect(parseDate('')).toBeNull();
    expect(parseDate('nonsense')).toBeNull();
  });
});

describe('requests', () => {
  it('sends the token as a Bearer token to /open/v1', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: []}));
    await createClient({token: 'tok', apiBase: 'https://api.ticktick.com/', fetch}).lists();
    expect(calls[0].url).toBe('https://api.ticktick.com/open/v1/project');
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('turns HTTP and network failures into error kinds', async () => {
    const kinds: string[] = [];
    for (const answer of [{status: 401}, {status: 404}, {status: 429}, {status: 503}, {status: 400}, new TypeError('Failed to fetch')]) {
      const {fetch} = fakeFetch(() => answer);
      try {
        await createRequest({token: 'tok', apiBase: 'https://x', fetch})('GET', '/project');
      } catch (error) {
        kinds.push((error as TickTickError).kind);
      }
    }
    expect(kinds).toEqual(['auth', 'notfound', 'ratelimit', 'server', 'rejected', 'network']);
  });

  it('never puts the token in an error', async () => {
    const {fetch} = fakeFetch(() => ({status: 401}));
    const error = await createRequest({token: 'secret-token-value', apiBase: 'https://x', fetch})('GET', '/project').catch(e => e as Error);
    expect(String(error)).not.toContain('secret-token-value');
  });

  it('asks for the cart of the last 24 hours', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: []}));
    const now = Date.UTC(2026, 9, 9, 13, 0, 0);
    await createClient({token: 'tok', apiBase: 'https://x', fetch}).cart('p1', now);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://x/open/v1/task/completed',
      body: {projectIds: ['p1'], startDate: '2026-10-08T13:00:00.000+0000', endDate: '2026-10-09T13:00:00.000+0000'},
    });
  });

  it('adds one item with POST /task and several with /task/batch, in order, after the last one', async () => {
    const {calls, fetch} = fakeFetch(call => ({body: call.url.endsWith('/batch') ? {id2etag: {}, id2error: {}} : {id: 'n'}}));
    const client = createClient({token: 'tok', apiBase: 'https://x', fetch});
    await client.addItems('p1', [{title: 'Rice', note: '2 kg'}], 100);
    await client.addItems('p1', [
      {title: 'Milk', note: ''},
      {title: 'Eggs', note: '12'},
    ]);
    expect(calls[0]).toMatchObject({url: 'https://x/open/v1/task', body: {projectId: 'p1', title: 'Rice', content: '2 kg', sortOrder: 100 + SORT_STEP}});
    expect(calls[1]).toMatchObject({
      url: 'https://x/open/v1/task/batch',
      body: {
        add: [
          {projectId: 'p1', title: 'Milk'},
          {projectId: 'p1', title: 'Eggs', content: '12'},
        ],
      },
    });
    expect(calls[1].body).not.toHaveProperty('add.0.sortOrder');
  });

  it('splits a batch at 50 and fails when TickTick refuses some', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: {id2etag: {}, id2error: {}}}));
    const many = Array.from({length: 51}, (_, index) => ({title: `Item ${index}`, note: ''}));
    await createClient({token: 'tok', apiBase: 'https://x', fetch}).addItems('p1', many);
    expect(calls.map(call => (call.body as {add: unknown[]}).add.length)).toEqual([50, 1]);

    const refusing = fakeFetch(() => ({body: {id2etag: {}, id2error: {x: 'EXCEED_QUOTA'}}}));
    await expect(createClient({token: 'tok', apiBase: 'https://x', fetch: refusing.fetch}).addItems('p1', many.slice(0, 2))).rejects.toMatchObject({kind: 'rejected'});
  });

  it('completes, updates and deletes on the documented paths', async () => {
    const {calls, fetch} = fakeFetch(call => ({body: call.method === 'POST' && call.url.endsWith('/task/t1') ? {id: 't1', projectId: 'p1', title: 'Rye bread', content: '', status: 0} : undefined}));
    const client = createClient({token: 'tok', apiBase: 'https://x', fetch});
    await client.complete(ITEM);
    const updated = await client.update(ITEM, {title: 'Rye bread', note: ''});
    await client.remove(ITEM);
    expect(calls.map(call => `${call.method} ${call.url.replace('https://x/open/v1', '')}`)).toEqual([
      'POST /project/p1/task/t1/complete',
      'POST /task/t1',
      'DELETE /project/p1/task/t1',
    ]);
    expect(calls[1].body).toEqual({id: 't1', projectId: 'p1', title: 'Rye bread', content: ''});
    expect(updated.title).toBe('Rye bread');
  });

  it('creates a list', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: {id: 'new', name: 'Garden', kind: 'TASK'}}));
    expect(await createClient({token: 'tok', apiBase: 'https://x', fetch}).createList('Garden')).toEqual({id: 'new', name: 'Garden'});
    expect(calls[0]).toMatchObject({method: 'POST', url: 'https://x/open/v1/project', body: {name: 'Garden', kind: 'TASK', viewMode: 'list'}});
  });
});

describe('reopenItem: putting a completed item back', () => {
  /** A Request double: answers by "METHOD path", records calls. */
  function fakeRequest(answers: Record<string, unknown | (() => unknown)>) {
    const calls: {method: string; path: string; body: unknown}[] = [];
    const request: Request = async (method, path, body) => {
      calls.push({method, path, body});
      const answer = answers[`${method} ${path}`];
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? (answer as () => unknown)() : answer ?? null;
    };
    return {calls, request};
  }

  it('path 1: TickTick takes status 0 on update', async () => {
    const {calls, request} = fakeRequest({
      'POST /task/t1': {id: 't1', projectId: 'p1', title: 'Bread', content: '1 loaf', status: 0, sortOrder: ITEM.sortOrder},
    });
    const result = await reopenItem(request, ITEM);
    expect(result).toEqual({path: 'updated', item: {...ITEM, completedAt: null}});
    expect(calls).toEqual([{method: 'POST', path: '/task/t1', body: {id: 't1', projectId: 'p1', title: 'Bread', content: '1 loaf', status: 0}}]);
  });

  it('path 2: the task stays completed, so a new one is created and the original deleted', async () => {
    const {calls, request} = fakeRequest({
      'POST /task/t1': {id: 't1', projectId: 'p1', title: 'Bread', status: 2},
      'POST /task': {id: 't9', projectId: 'p1', title: 'Bread', content: '1 loaf', status: 0, sortOrder: ITEM.sortOrder},
    });
    const result = await reopenItem(request, ITEM);
    expect(result.path).toBe('recreated');
    expect(result.item).toMatchObject({id: 't9', title: 'Bread', note: '1 loaf', completedAt: null});
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(['POST /task/t1', 'POST /task', 'DELETE /project/p1/task/t1']);
    expect(calls[1].body).toEqual({projectId: 'p1', title: 'Bread', content: '1 loaf', sortOrder: ITEM.sortOrder});
  });

  it('path 2 also when the update is refused or answers nothing', async () => {
    for (const answer of [new TickTickError('rejected', 400), new TickTickError('server', 500), null]) {
      const {calls, request} = fakeRequest({'POST /task/t1': answer, 'POST /task': {id: 't9', projectId: 'p1', title: 'Bread', status: 0}});
      expect((await reopenItem(request, ITEM)).path).toBe('recreated');
      expect(calls).toHaveLength(3);
    }
  });

  it('path 2 still succeeds when deleting the original fails', async () => {
    const {request} = fakeRequest({
      'POST /task/t1': {id: 't1', status: 2},
      'POST /task': {id: 't9', projectId: 'p1', title: 'Bread', status: 0},
      'DELETE /project/p1/task/t1': new TickTickError('server', 500),
    });
    expect((await reopenItem(request, ITEM)).path).toBe('recreated');
  });

  it('does not fall back on auth, network or rate-limit failures', async () => {
    for (const kind of ['auth', 'network', 'ratelimit'] as const) {
      const {calls, request} = fakeRequest({'POST /task/t1': new TickTickError(kind)});
      await expect(reopenItem(request, ITEM)).rejects.toMatchObject({kind});
      expect(calls).toHaveLength(1);
    }
  });

  it('fails when the new task cannot be created', async () => {
    const {request} = fakeRequest({'POST /task/t1': {id: 't1', status: 2}, 'POST /task': new TickTickError('rejected', 400)});
    await expect(reopenItem(request, ITEM)).rejects.toMatchObject({kind: 'rejected'});
  });
});
