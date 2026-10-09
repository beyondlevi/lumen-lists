import {describe, expect, it} from 'vitest';
import {
  completedFrom,
  createClient,
  createRequest,
  dueBody,
  formatDate,
  inboxIdFrom,
  openTaskLists,
  parseDate,
  pendingFrom,
  reopenTask,
  SORT_STEP,
  toTask,
  type Request,
} from '../../src/ticktick/client';
import {TickTickError, type Task} from '../../src/ticktick/types';

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

const TASK: Task = {
  id: 't1',
  listId: 'p1',
  title: 'Call João',
  notes: 'About the contract',
  priority: 5,
  due: {at: Date.UTC(2026, 9, 10, 18), allDay: false, timeZone: 'America/Sao_Paulo'},
  tags: [],
  subtasks: [],
  sortOrder: 3 * SORT_STEP,
  completedAt: Date.UTC(2026, 9, 9, 13),
};

describe('mapping TickTick answers', () => {
  it('keeps open task lists, in their order', () => {
    expect(
      openTaskLists([
        {id: 'b', name: 'Personal', sortOrder: 2, kind: 'TASK'},
        {id: 'a', name: 'Work', sortOrder: 1},
        {id: 'n', name: 'Recipes', kind: 'NOTE'},
        {id: 'c', name: 'Old', closed: true},
        {name: 'no id'},
      ]),
    ).toEqual([
      {id: 'a', name: 'Work', inbox: false},
      {id: 'b', name: 'Personal', inbox: false},
    ]);
    expect(() => openTaskLists({})).toThrow(TickTickError);
  });

  it('maps a task: notes, priority, due, tags and subtasks', () => {
    expect(
      toTask({
        id: 't2',
        projectId: 'p1',
        title: ' Call João ',
        desc: 'checklist description',
        priority: 3,
        dueDate: '2026-10-09T18:00:00.000+0000',
        isAllDay: false,
        timeZone: 'America/Sao_Paulo',
        tags: ['client', 7],
        items: [
          {id: 'i1', title: 'Read', status: 1},
          {id: 'i2', title: 'Agree', status: 0},
        ],
        sortOrder: 20,
      }),
    ).toEqual({
      id: 't2',
      listId: 'p1',
      title: 'Call João',
      notes: 'checklist description',
      priority: 3,
      due: {at: Date.UTC(2026, 9, 9, 18), allDay: false, timeZone: 'America/Sao_Paulo'},
      tags: ['client'],
      subtasks: [
        {id: 'i1', title: 'Read', done: true},
        {id: 'i2', title: 'Agree', done: false},
      ],
      sortOrder: 20,
      completedAt: null,
    });
    expect(toTask({id: 'x', priority: 2})?.priority).toBe(0);
    expect(toTask({id: 'x', content: 'notes', desc: 'other'})?.notes).toBe('notes');
    expect(toTask({id: 'x', startDate: '2026-10-09T03:00:00+0000', isAllDay: true, timeZone: 'America/Sao_Paulo'})?.due).toEqual({
      at: Date.UTC(2026, 9, 9, 3),
      allDay: true,
      timeZone: 'America/Sao_Paulo',
    });
  });

  it('keeps pending tasks in the list order', () => {
    const tasks = pendingFrom(
      {
        tasks: [
          {id: 't2', projectId: 'p1', title: 'B', status: 0, sortOrder: 20},
          {id: 't1', projectId: 'p1', title: 'A', status: 0, sortOrder: 10},
          {id: 't3', projectId: 'p1', title: 'Done', status: 2, sortOrder: 5},
        ],
      },
      'p1',
    );
    expect(tasks.map(task => task.id)).toEqual(['t1', 't2']);
  });

  it('maps completed tasks, newest first, of this list only', () => {
    const done = completedFrom(
      [
        {id: 'a', projectId: 'p1', title: 'A', status: 2, completedTime: '2026-10-09T10:00:00.000+0000'},
        {id: 'b', projectId: 'p1', title: 'B', status: 2, completedTime: '2026-10-09T11:30:00+0000'},
        {id: 'c', projectId: 'p2', title: 'C', status: 2, completedTime: '2026-10-09T12:00:00+0000'},
      ],
      'p1',
    );
    expect(done.map(task => task.title)).toEqual(['B', 'A']);
  });

  it('finds the Inbox id in its data', () => {
    expect(inboxIdFrom({project: {id: 'inbox123'}, tasks: []})).toBe('inbox123');
    expect(inboxIdFrom({tasks: [{id: 't', projectId: 'inbox456'}]})).toBe('inbox456');
    expect(inboxIdFrom({tasks: []})).toBe('inbox');
  });

  it('formats and reads TickTick dates', () => {
    expect(formatDate(Date.UTC(2026, 2, 1, 0, 58, 20))).toBe('2026-03-01T00:58:20.000+0000');
    expect(parseDate('2019-11-13T03:00:00+0000')).toBe(Date.UTC(2019, 10, 13, 3));
    expect(parseDate('')).toBeNull();
    expect(parseDate('nonsense')).toBeNull();
  });

  it('writes due dates with all-day and time zone, and clears them with null', () => {
    expect(dueBody({at: Date.UTC(2026, 9, 10, 3), allDay: true, timeZone: 'America/Sao_Paulo'})).toEqual({
      startDate: '2026-10-10T03:00:00.000+0000',
      dueDate: '2026-10-10T03:00:00.000+0000',
      isAllDay: true,
      timeZone: 'America/Sao_Paulo',
    });
    expect(dueBody(null)).toEqual({startDate: null, dueDate: null, isAllDay: false});
  });
});

describe('requests', () => {
  it('sends the token as a Bearer token to /open/v1', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: []}));
    await createClient({token: 'tok', apiBase: 'https://api.ticktick.com/', fetch}).lists();
    expect(calls[0].url).toBe('https://api.ticktick.com/open/v1/project');
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('reads the Inbox through the inbox alias', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: {project: {id: 'inbox9'}, tasks: [{id: 't', projectId: 'inbox9', title: 'X', status: 0}]}}));
    const inbox = await createClient({token: 'tok', apiBase: 'https://x', fetch}).inbox();
    expect(calls[0].url).toBe('https://x/open/v1/project/inbox/data');
    expect(inbox.list).toEqual({id: 'inbox9', name: 'Inbox', inbox: true});
    expect(inbox.tasks.map(task => task.listId)).toEqual(['inbox9']);
  });

  it('turns HTTP and network failures into error kinds, without the token', async () => {
    const kinds: string[] = [];
    for (const answer of [{status: 401}, {status: 404}, {status: 429}, {status: 503}, {status: 400}, new TypeError('Failed to fetch')]) {
      const {fetch} = fakeFetch(() => answer);
      try {
        await createRequest({token: 'secret-token-value', apiBase: 'https://x', fetch})('GET', '/project');
      } catch (error) {
        kinds.push((error as TickTickError).kind);
        expect(String(error)).not.toContain('secret-token-value');
      }
    }
    expect(kinds).toEqual(['auth', 'notfound', 'ratelimit', 'server', 'rejected', 'network']);
  });

  it('asks for the completed tasks of the last 7 days', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: []}));
    await createClient({token: 'tok', apiBase: 'https://x', fetch}).completedTasks('p1', Date.UTC(2026, 9, 9, 13));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://x/open/v1/task/completed',
      body: {projectIds: ['p1'], startDate: '2026-10-02T13:00:00.000+0000', endDate: '2026-10-09T13:00:00.000+0000'},
    });
  });

  it('adds one task with POST /task and several with /task/batch, in order, after the last one', async () => {
    const {calls, fetch} = fakeFetch(call => ({body: call.url.endsWith('/batch') ? {id2etag: {}, id2error: {}} : {id: 'n'}}));
    const client = createClient({token: 'tok', apiBase: 'https://x', fetch});
    const due = {at: Date.UTC(2026, 9, 10, 18), allDay: false, timeZone: 'America/Sao_Paulo'};
    await client.addTasks('p1', [{title: 'Call João', due}], 100);
    await client.addTasks('p1', [
      {title: 'Pay the rent', due: {...due, allDay: true}},
      {title: 'Buy milk', due: null},
    ]);
    expect(calls[0]).toMatchObject({
      url: 'https://x/open/v1/task',
      body: {projectId: 'p1', title: 'Call João', dueDate: '2026-10-10T18:00:00.000+0000', isAllDay: false, timeZone: 'America/Sao_Paulo', sortOrder: 100 + SORT_STEP},
    });
    expect(calls[1]).toMatchObject({
      url: 'https://x/open/v1/task/batch',
      body: {add: [{projectId: 'p1', title: 'Pay the rent', isAllDay: true}, {projectId: 'p1', title: 'Buy milk'}]},
    });
    expect(calls[1].body).not.toHaveProperty('add.1.dueDate');
  });

  it('splits a batch at 50 and fails when TickTick refuses some', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: {id2etag: {}, id2error: {}}}));
    const many = Array.from({length: 51}, (_, index) => ({title: `Task ${index}`, due: null}));
    await createClient({token: 'tok', apiBase: 'https://x', fetch}).addTasks('p1', many);
    expect(calls.map(call => (call.body as {add: unknown[]}).add.length)).toEqual([50, 1]);
    const refusing = fakeFetch(() => ({body: {id2etag: {}, id2error: {x: 'EXCEED_QUOTA'}}}));
    await expect(createClient({token: 'tok', apiBase: 'https://x', fetch: refusing.fetch}).addTasks('p1', many.slice(0, 2))).rejects.toMatchObject({kind: 'rejected'});
  });

  it('completes and deletes on the documented paths', async () => {
    const {calls, fetch} = fakeFetch(() => ({}));
    const client = createClient({token: 'tok', apiBase: 'https://x', fetch});
    await client.complete(TASK);
    await client.remove(TASK);
    expect(calls.map(call => `${call.method} ${call.url.replace('https://x/open/v1', '')}`)).toEqual([
      'POST /project/p1/task/t1/complete',
      'DELETE /project/p1/task/t1',
    ]);
  });

  it('updates title, due and priority; a new list moves the task first', async () => {
    const {calls, fetch} = fakeFetch(call => ({body: call.url.endsWith('/task/t1') ? {...(call.body as object), id: 't1', status: 0} : []}));
    const client = createClient({token: 'tok', apiBase: 'https://x', fetch});
    const updated = await client.update(TASK, {title: 'Call Ana', due: null, priority: 1, listId: 'p1'});
    expect(calls[0]).toMatchObject({
      url: 'https://x/open/v1/task/t1',
      body: {id: 't1', projectId: 'p1', title: 'Call Ana', priority: 1, dueDate: null, startDate: null, isAllDay: false},
    });
    expect(updated).toMatchObject({title: 'Call Ana', priority: 1, due: null});

    await client.update(TASK, {title: 'Call João', due: TASK.due, priority: 5, listId: 'p2'});
    expect(calls[1]).toMatchObject({url: 'https://x/open/v1/task/move', body: [{fromProjectId: 'p1', toProjectId: 'p2', taskId: 't1'}]});
    expect(calls[2]).toMatchObject({url: 'https://x/open/v1/task/t1', body: {projectId: 'p2', title: 'Call João'}});
  });

  it('creates a list', async () => {
    const {calls, fetch} = fakeFetch(() => ({body: {id: 'new', name: 'Garden', kind: 'TASK'}}));
    expect(await createClient({token: 'tok', apiBase: 'https://x', fetch}).createList('Garden')).toEqual({id: 'new', name: 'Garden', inbox: false});
    expect(calls[0]).toMatchObject({method: 'POST', url: 'https://x/open/v1/project', body: {name: 'Garden', kind: 'TASK', viewMode: 'list'}});
  });
});

describe('reopenTask: making a completed task pending again', () => {
  function fakeRequest(answers: Record<string, unknown>) {
    const calls: {method: string; path: string; body: unknown}[] = [];
    const request: Request = async (method, path, body) => {
      calls.push({method, path, body});
      const answer = answers[`${method} ${path}`];
      if (answer instanceof Error) throw answer;
      return answer ?? null;
    };
    return {calls, request};
  }

  it('path 1: TickTick takes status 0 on update', async () => {
    const {calls, request} = fakeRequest({
      'POST /task/t1': {id: 't1', projectId: 'p1', title: 'Call João', content: 'About the contract', status: 0, priority: 5, sortOrder: TASK.sortOrder},
    });
    const result = await reopenTask(request, TASK);
    expect(result.path).toBe('updated');
    expect(result.task).toMatchObject({id: 't1', completedAt: null});
    expect(calls).toEqual([{method: 'POST', path: '/task/t1', body: {id: 't1', projectId: 'p1', title: 'Call João', content: 'About the contract', status: 0}}]);
  });

  it('path 2: the task stays completed, so a copy is created and the original deleted', async () => {
    const {calls, request} = fakeRequest({
      'POST /task/t1': {id: 't1', projectId: 'p1', status: 2},
      'POST /task': {id: 't9', projectId: 'p1', title: 'Call João', status: 0},
    });
    const result = await reopenTask(request, TASK);
    expect(result.path).toBe('recreated');
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(['POST /task/t1', 'POST /task', 'DELETE /project/p1/task/t1']);
    expect(calls[1].body).toMatchObject({projectId: 'p1', title: 'Call João', content: 'About the contract', priority: 5, dueDate: '2026-10-10T18:00:00.000+0000'});
  });

  it('path 2 also when the update is refused or answers nothing, and when the delete fails', async () => {
    for (const answer of [new TickTickError('rejected', 400), new TickTickError('server', 500), null]) {
      const {request} = fakeRequest({'POST /task/t1': answer, 'POST /task': {id: 't9', projectId: 'p1', status: 0}, 'DELETE /project/p1/task/t1': new TickTickError('server')});
      expect((await reopenTask(request, TASK)).path).toBe('recreated');
    }
  });

  it('does not fall back on auth, network or rate-limit failures', async () => {
    for (const kind of ['auth', 'network', 'ratelimit'] as const) {
      const {calls, request} = fakeRequest({'POST /task/t1': new TickTickError(kind)});
      await expect(reopenTask(request, TASK)).rejects.toMatchObject({kind});
      expect(calls).toHaveLength(1);
    }
  });
});
