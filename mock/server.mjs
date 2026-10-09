// A stand-in for the TickTick Open API (https://api.ticktick.com/open/v1) for
// the e2e tests: the same fictional lists as demo mode (src/demo/fixtures.json),
// kept in memory. It checks the Bearer token, answers CORS with `*` (also on
// errors, as TickTick does) and records every write.
//
//   node mock/server.mjs            (listens on 127.0.0.1:8091)
//   GET  /__mock/writes             writes received so far: [{method, path, body}]
//   POST /__mock/reset              back to the fixtures, no writes, no failures
//   POST /__mock/fail?path=<regex>&status=<code>&times=<n>
//                                   the next n requests whose path matches fail with
//                                   that status; status 0 drops the connection.
//                                   With &forMs=<ms> instead of times, every match fails for that long
//                                   (browsers repeat a GET whose connection dropped).
//   POST /__mock/reopen?mode=status|ignore|reject
//                                   how POST /task/{id} treats `status: 0` on a completed
//                                   task: reopen it (default), ignore it, or answer 400.
//                                   The real behaviour is not documented.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const MOCK_TOKEN = 'mock-ticktick-token-for-e2e-tests-only';
export const MOCK_PORT = 8091;
const SORT_STEP = 2 ** 30;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const formatDate = ms => new Date(ms).toISOString().replace('Z', '+0000');
const parseDate = value => Date.parse(String(value).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));

function load() {
  const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'src/demo/fixtures.json'), 'utf8')).en;
  const now = Date.now();
  const projects = fixtures.map((list, index) => ({id: list.id, name: list.name, closed: false, kind: 'TASK', viewMode: 'list', sortOrder: index}));
  // A note list and a closed list: the app must not show them.
  projects.push({id: 'notes', name: 'Recipes', closed: false, kind: 'NOTE', viewMode: 'list', sortOrder: 9});
  projects.push({id: 'archived', name: 'Old list', closed: true, kind: 'TASK', viewMode: 'list', sortOrder: 10});
  const tasks = fixtures.flatMap(list => [
    ...list.open.map((entry, index) => ({
      id: `${list.id}-open-${index}`,
      projectId: list.id,
      title: entry.title,
      content: entry.note,
      status: 0,
      sortOrder: (index + 1) * SORT_STEP,
    })),
    ...list.cart.map((entry, index) => ({
      id: `${list.id}-cart-${index}`,
      projectId: list.id,
      title: entry.title,
      content: entry.note,
      status: 2,
      sortOrder: (list.open.length + index + 1) * SORT_STEP,
      completedTime: formatDate(now - entry.minutesAgo * 60_000),
    })),
  ]);
  return {projects, tasks};
}

export function startMockServer(port = MOCK_PORT, host = '127.0.0.1') {
  let state = load();
  let writes = [];
  let failures = [];
  let reopenMode = 'status';
  let nextId = 1;

  const send = (res, status, body) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=UTF-8', ...CORS});
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const task = id => state.tasks.find(entry => entry.id === id);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (url.pathname.startsWith('/__mock/')) {
        if (url.pathname === '/__mock/writes') return send(res, 200, writes);
        if (url.pathname === '/__mock/reset') {
          state = load();
          writes = [];
          failures = [];
          reopenMode = 'status';
          return send(res, 200, {ok: true});
        }
        if (url.pathname === '/__mock/fail') {
          failures.push({
            pattern: new RegExp(url.searchParams.get('path') ?? '.'),
            status: Number(url.searchParams.get('status') ?? 500),
            times: url.searchParams.has('forMs') ? Infinity : Number(url.searchParams.get('times') ?? 1),
            until: url.searchParams.has('forMs') ? Date.now() + Number(url.searchParams.get('forMs')) : Infinity,
          });
          return send(res, 200, {ok: true});
        }
        if (url.pathname === '/__mock/reopen') {
          reopenMode = url.searchParams.get('mode') ?? 'status';
          return send(res, 200, {ok: true});
        }
        return send(res, 404, {error: 'unknown mock control'});
      }

      if (req.headers.authorization !== `Bearer ${MOCK_TOKEN}`) {
        return send(res, 401, {errorCode: 'unauthorized'});
      }
      const failure = failures.find(entry => entry.times > 0 && Date.now() < entry.until && entry.pattern.test(url.pathname));
      if (failure) {
        failure.times -= 1;
        if (failure.status === 0) {
          req.socket.destroy();
          return;
        }
        return send(res, failure.status, {errorCode: 'mock_failure'});
      }

      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return send(res, 400, {errorCode: 'bad_json'});
      }
      const route = url.pathname.replace(/^\/open\/v1/, '');
      const method = req.method;
      if (method !== 'GET' && route !== '/task/completed') writes.push({method, path: route, body: raw ? body : null});
      let match;

      if (method === 'GET' && route === '/project') {
        return send(res, 200, state.projects);
      }
      if (method === 'POST' && route === '/project') {
        const project = {id: `p${nextId++}`, name: String(body.name ?? ''), closed: false, kind: 'TASK', viewMode: body.viewMode ?? 'list', sortOrder: 0};
        state.projects.push(project);
        return send(res, 200, {id: project.id, name: project.name, color: '', sortOrder: 0, viewMode: project.viewMode, kind: 'TASK'});
      }
      if (method === 'GET' && (match = /^\/project\/([^/]+)\/data$/.exec(route))) {
        const project = state.projects.find(entry => entry.id === decodeURIComponent(match[1]));
        if (!project) return send(res, 404, {errorCode: 'project_not_found'});
        const tasks = state.tasks.filter(entry => entry.projectId === project.id && entry.status === 0);
        return send(res, 200, {project, tasks, columns: []});
      }
      if (method === 'POST' && route === '/task/completed') {
        const from = body.startDate ? parseDate(body.startDate) : -Infinity;
        const to = body.endDate ? parseDate(body.endDate) : Infinity;
        const ids = Array.isArray(body.projectIds) ? body.projectIds : null;
        const done = state.tasks.filter(entry => {
          if (entry.status !== 2 || (ids && !ids.includes(entry.projectId))) return false;
          const at = parseDate(entry.completedTime);
          return at >= from && at <= to;
        });
        return send(res, 200, done.slice(0, 200));
      }
      if (method === 'POST' && route === '/task/batch') {
        const id2etag = {};
        for (const entry of body.add ?? []) {
          const created = {id: `t${nextId++}`, projectId: entry.projectId, title: entry.title, content: entry.content ?? '', status: 0, sortOrder: entry.sortOrder ?? 0};
          state.tasks.push(created);
          id2etag[created.id] = 'etag';
        }
        return send(res, 200, {id2etag, id2error: {}});
      }
      if (method === 'POST' && route === '/task') {
        if (!body.title || !body.projectId) return send(res, 400, {errorCode: 'missing_field'});
        const created = {id: `t${nextId++}`, projectId: body.projectId, title: body.title, content: body.content ?? '', status: 0, sortOrder: body.sortOrder ?? 0};
        state.tasks.push(created);
        return send(res, 200, created);
      }
      if (method === 'POST' && (match = /^\/task\/([^/]+)$/.exec(route))) {
        const found = task(decodeURIComponent(match[1]));
        if (!found) return send(res, 404, {errorCode: 'task_not_found'});
        if ('status' in body && found.status === 2 && reopenMode === 'reject') return send(res, 400, {errorCode: 'invalid_status'});
        if (typeof body.title === 'string') found.title = body.title;
        if (typeof body.content === 'string') found.content = body.content;
        if (body.status === 0 && found.status === 2 && reopenMode === 'status') {
          found.status = 0;
          delete found.completedTime;
        }
        return send(res, 200, found);
      }
      if (method === 'POST' && (match = /^\/project\/([^/]+)\/task\/([^/]+)\/complete$/.exec(route))) {
        const found = task(decodeURIComponent(match[2]));
        if (!found) return send(res, 404, {errorCode: 'task_not_found'});
        found.status = 2;
        found.completedTime = formatDate(Date.now());
        return send(res, 200);
      }
      if (method === 'DELETE' && (match = /^\/project\/([^/]+)\/task\/([^/]+)$/.exec(route))) {
        const id = decodeURIComponent(match[2]);
        if (!task(id)) return send(res, 404, {errorCode: 'task_not_found'});
        state.tasks = state.tasks.filter(entry => entry.id !== id);
        return send(res, 200);
      }
      return send(res, 404, {errorCode: 'no_route'});
    });
  });
  return new Promise(resolve => server.listen(port, host, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startMockServer();
  console.log(`TickTick mock on http://127.0.0.1:${MOCK_PORT} (token: ${MOCK_TOKEN})`);
}
