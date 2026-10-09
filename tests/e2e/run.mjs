// Keyboard-only end-to-end tests against the mock TickTick API (mock/server.mjs).
//
//   npm run package && npm run test:e2e             (Firefox + Chromium)
//   E2E_BROWSERS=firefox npm run test:e2e
//   E2E_ONLY='add tasks' npm run test:e2e            (scenarios whose title matches)
//
// The built app is served like the Lumen host serves a package (static files,
// SPA fallback) on 127.0.0.1:4173 and the mock on 127.0.0.1:8091, so every call
// is a real cross-origin request with a CORS preflight, as with TickTick. The
// browser runs in America/Sao_Paulo, as the mock dates its tasks. The offline
// package test unzips dist/lumen-lists.mrbd.zip and serves that, and also saves
// a 600x600 capture of every screen in demo mode under .e2e-output/screens/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {chromium, firefox} from 'playwright';
import {dueDateFor, INBOX_ID, MOCK_PORT, MOCK_TIME_ZONE, MOCK_TOKEN, startMockServer} from '../../mock/server.mjs';
import {startStaticServer} from './static-server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const outDir = path.join(root, '.e2e-output');
const screensDir = path.join(outDir, 'screens');
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const APP = 'http://127.0.0.1:4173';
const PACKAGE_APP = 'http://127.0.0.1:5500';
const browsers = (process.env.E2E_BROWSERS ?? 'firefox,chromium').split(',');
const only = process.env.E2E_ONLY ? new RegExp(process.env.E2E_ONLY, 'i') : null;
const results = [];
/** The page of the scenario running, captured when it fails. */
let lastPage = null;

fs.mkdirSync(screensDir, {recursive: true});

const mock = (pathname, method = 'POST') => fetch(`${MOCK}${pathname}`, {method}).then(response => response.json());
const writes = () => mock('/__mock/writes', 'GET');
const writeLines = async () => (await writes()).map(write => `${write.method} ${write.path}`);

async function focusLabel(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return '(body)';
    return (element.getAttribute('aria-label') || element.textContent || element.tagName).replace(/\s+/g, ' ').trim();
  });
}

async function press(page, key, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
  }
}

/** Moves focus with `key` until its label matches, or fails. */
async function focusUntil(page, key, pattern, limit = 14) {
  for (let i = 0; i <= limit; i += 1) {
    const label = await focusLabel(page);
    if (pattern.test(label)) return label;
    await press(page, key);
  }
  throw new Error(`focus never matched ${pattern}; last: ${await focusLabel(page)}`);
}

async function waitText(page, text, timeout = 8000) {
  await page.getByText(text, {exact: false}).first().waitFor({state: 'visible', timeout});
}

async function waitGone(page, text, timeout = 8000) {
  await page.getByText(text, {exact: true}).first().waitFor({state: 'hidden', timeout});
}

async function waitField(page, timeout = 8000) {
  await page.locator('textarea').first().waitFor({state: 'visible', timeout});
  await page.waitForTimeout(500);
}

/** Whether a row's actions are on screen: View is what shows at its own center. */
async function actionsShown(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[aria-label="View"]')].some(element => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.left < 0 || box.right > window.innerWidth) return false;
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return top != null && (element === top || element.contains(top)) && Number(getComputedStyle(element).opacity) > 0.5;
    }),
  );
}

/** The band hints on screen are exactly these. */
async function hints(page, expected) {
  await page.waitForTimeout(200);
  const shown = await page.locator('.hint-dock').first().evaluate(dock => [...dock.children].map(child => child.textContent.trim()));
  assert.deepEqual(shown, expected);
}

/**
 * What Lumen's composer does when it closes: the text goes into the focused
 * field through the value setter and an `input` event, then `change`.
 */
async function compose(page, text) {
  const tag = await page.evaluate(value => {
    const field = document.activeElement;
    if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) return field?.tagName ?? 'none';
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
    field.dispatchEvent(new Event('input', {bubbles: true}));
    field.dispatchEvent(new Event('change', {bubbles: true}));
    return field.tagName;
  }, text);
  assert.match(tag, /TEXTAREA|INPUT/, 'the composer needs a focused text field');
  await page.waitForTimeout(300);
}

/** The focused element is a real text field, and Enter on it is left to the host (no preventDefault). */
async function assertComposerField(page) {
  const probe = await page.evaluate(() => {
    const field = document.activeElement;
    const event = new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true, cancelable: true});
    field.dispatchEvent(event);
    return {tag: field.tagName, disabled: field.disabled, readOnly: field.readOnly, prevented: event.defaultPrevented, value: field.value};
  });
  assert.equal(probe.tag, 'TEXTAREA');
  assert.equal(probe.disabled, false);
  assert.equal(probe.readOnly, false);
  assert.equal(probe.prevented, false, 'Enter on the text field must not be prevented');
  return probe;
}

async function openApp(browser, name, config, {appUrl = APP, route = '/', locale = 'en-US'} = {}) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}, locale, timezoneId: MOCK_TIME_ZONE});
  await context.addInitScript(values => {
    if (!sessionStorage.getItem('e2e-config-set')) {
      localStorage.setItem('lumen-lists.dev-config', JSON.stringify(values));
      sessionStorage.setItem('e2e-config-set', '1');
    }
  }, config);
  const page = await context.newPage();
  lastPage = page;
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${appUrl}${route}`);
  return {page, context, errors, shot: step => page.screenshot({path: path.join(outDir, `${name}-${step}.png`)})};
}

const session = {'ticktick.token': MOCK_TOKEN, 'ticktick.api': MOCK};

/** From Pending to the Lists tab. */
async function toLists(page) {
  await waitText(page, 'Send the proposal');
  await page.waitForTimeout(400);
  await focusUntil(page, 'ArrowUp', /Page 1 of 3/, 12);
  await press(page, 'ArrowRight');
  await waitText(page, '7 pending · 1 overdue');
  await page.waitForTimeout(400);
}

async function openWork(page) {
  await toLists(page);
  await focusUntil(page, 'ArrowDown', /^Work/);
  await press(page, 'Enter');
  await waitText(page, 'Add tasks');
  await waitText(page, 'Review the onboarding screens');
  await page.waitForTimeout(500);
}

const scenarios = {
  async 'setup screen, then the token arrives'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, {});
    await waitText(page, 'Connect TickTick');
    await waitText(page, 'Settings › Account › API Token');
    await waitText(page, 'Unofficial: not made by TickTick');
    await page.waitForTimeout(600);
    await shot('setup');
    await page.evaluate(values => localStorage.setItem('lumen-lists.dev-config', JSON.stringify(values)), session);
    await focusUntil(page, 'ArrowDown', /Try again/, 4);
    await press(page, 'Enter');
    await waitText(page, 'Send the proposal');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'a refused token shows Connect TickTick'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, {...session, 'ticktick.token': 'an-old-revoked-token'});
    await waitText(page, 'TickTick refused the token');
    await shot('refused');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'Pending: every list and the Inbox, grouped by day; Enter completes'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await waitText(page, 'Send the proposal');
    for (const text of ['Overdue', 'Today', 'Tomorrow', 'Later', 'No date', 'Reply to the landlord', 'Pay the electricity bill', 'Buy coffee filters']) {
      await waitText(page, text);
    }
    assert.equal(await page.getByText('Recipes').count(), 0, 'note lists are not shown');
    // Overdue first, then today: the all-day tasks, then the timed one.
    const titles = await page.locator('[data-task-row]').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')?.split(',')[0]));
    assert.deepEqual(titles.slice(0, 4), ['Send the proposal', 'Pay the electricity bill', 'Reply to the landlord', 'Call João about the contract']);
    await page.waitForTimeout(500);
    await shot('pending');
    await focusUntil(page, 'ArrowDown', /^Reply to the landlord/);
    await press(page, 'Enter');
    await waitGone(page, 'Reply to the landlord');
    assert.match(await focusLabel(page), /^Call João about the contract/, 'the next task takes the place');
    assert.ok((await writeLines()).includes(`POST /project/${INBOX_ID}/task/demo-inbox-0/complete`), 'an Inbox task completes in the Inbox');
    // TickTick refuses: the task comes back, with a toast.
    await mock(`/__mock/fail?path=${encodeURIComponent('/complete$')}&status=500&times=1`);
    await press(page, 'Enter');
    await waitText(page, "Couldn't complete Call João about the contract");
    await waitText(page, 'Call João about the contract');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'swipe left shows View, Edit, Delete; View opens the task; Back returns'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openWork(page);
    await focusUntil(page, 'ArrowDown', /^Call João about the contract/);
    await waitText(page, 'Swipe left: options');
    // On the row, a swipe to the right does nothing; a swipe to the left reveals the actions.
    await press(page, 'ArrowRight');
    assert.match(await focusLabel(page), /^Call João about the contract/, 'right on the row stays on the row');
    assert.equal(await actionsShown(page), false);
    await press(page, 'ArrowLeft');
    assert.match(await focusLabel(page), /^View$/, 'a swipe to the left reveals the actions');
    assert.equal(await actionsShown(page), true);
    await hints(page, ['Index tap: choose', 'Swipe right: next', 'Swipe left: back']);
    await shot('revealed');
    // Inside the actions: right to the next one, left to the previous one.
    await press(page, 'ArrowRight');
    assert.match(await focusLabel(page), /^Edit$/);
    await hints(page, ['Index tap: choose', 'Swipe right: next', 'Swipe left: previous']);
    await press(page, 'ArrowRight');
    assert.match(await focusLabel(page), /^Delete$/);
    await hints(page, ['Index tap: choose', 'Swipe left: previous']);
    await press(page, 'ArrowRight');
    assert.match(await focusLabel(page), /^Delete$/, 'right on the last action does nothing');
    await press(page, 'ArrowLeft');
    assert.match(await focusLabel(page), /^Edit$/);
    await press(page, 'ArrowLeft');
    assert.match(await focusLabel(page), /^View$/);
    // Left on the first action closes them and gives the row back.
    await press(page, 'ArrowLeft');
    assert.match(await focusLabel(page), /^Call João about the contract/, 'left on View goes back to the row');
    await page.waitForTimeout(400);
    assert.equal(await actionsShown(page), false, 'the actions are hidden again');
    await hints(page, ['Index tap: complete', 'Swipe left: options']);
    await waitText(page, 'Swipe left: options');
    await press(page, 'ArrowLeft');
    await press(page, 'Enter');
    await waitText(page, 'Subtasks · 1 of 3 done');
    await waitText(page, 'High priority');
    await waitText(page, 'client, contract');
    await waitText(page, 'Confirm the start date and who signs on their side.');
    await waitText(page, 'Today, ');
    await page.waitForTimeout(600);
    await shot('task');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    await page.waitForTimeout(600);
    assert.match(await focusLabel(page), /^Call João about the contract/, 'Back lands on the task again');
    // The Enter on the task screen's Complete completes and goes back.
    await press(page, 'ArrowLeft');
    await press(page, 'Enter');
    await waitText(page, 'Subtasks · 1 of 3 done');
    await focusUntil(page, 'ArrowDown', /^(Complete|Edit|Delete)/, 10);
    await focusUntil(page, 'ArrowLeft', /^Complete/, 3);
    await press(page, 'Enter');
    await waitText(page, '6 pending');
    assert.ok((await writeLines()).includes('POST /project/demo-work/task/demo-work-1/complete'));
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'Lists: Inbox first, counts; Completed and reopen with status 0'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await toLists(page);
    const rows = await page.locator('[role="list"] [aria-label], [aria-label]').evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('aria-label')).filter(label => /pending|All done/.test(label ?? '')),
    );
    assert.match(rows[0] ?? '', /^Inbox, 3 pending/);
    await waitText(page, 'All done');
    await shot('lists');
    await focusUntil(page, 'ArrowDown', /^Work/);
    await press(page, 'Enter');
    await waitText(page, 'Add tasks');
    await focusUntil(page, 'ArrowDown', /^Completed/);
    await press(page, 'Enter');
    await waitText(page, 'Draft the agenda');
    await waitText(page, 'Done yesterday');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Draft the agenda/);
    await shot('completed');
    await press(page, 'Enter');
    await waitText(page, 'Draft the agenda is pending again');
    const reopen = (await writes()).find(write => write.path === '/task/demo-work-done-0');
    assert.equal(reopen?.body?.status, 0);
    assert.match(await focusLabel(page), /^Book the meeting room/);
    await press(page, 'Escape');
    await waitText(page, '8 pending');
    await page.waitForTimeout(600);
    assert.match(await focusLabel(page), /^Completed/, 'Back lands on Completed');
    await press(page, 'Escape');
    await waitText(page, 'All done');
    assert.equal(new URL(page.url()).pathname, '/');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'reopen falls back to a copy when TickTick keeps the task completed'(browser, name) {
    await mock('/__mock/reset');
    await mock('/__mock/reopen?mode=ignore');
    const {page, context, errors} = await openApp(browser, name, session);
    await openWork(page);
    await focusUntil(page, 'ArrowDown', /^Completed/);
    await press(page, 'Enter');
    await waitText(page, 'Draft the agenda');
    await page.waitForTimeout(400);
    await press(page, 'Enter');
    await page.waitForTimeout(900);
    assert.deepEqual(await writeLines(), ['POST /task/demo-work-done-0', 'POST /task', 'DELETE /project/demo-work/task/demo-work-done-0']);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'add tasks through the text field: due dates, review, another list'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openWork(page);
    assert.match(await focusLabel(page), /^Add tasks/);
    await press(page, 'Enter');
    await waitField(page);
    await assertComposerField(page);
    await compose(page, 'Call Ana tomorrow at 3 pm and pay the rent in 4 days\nbook flights');
    await shot('written');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Add 3 tasks');
    await waitText(page, 'Tomorrow 15:00');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Call Ana/);
    await shot('review');
    await focusUntil(page, 'ArrowDown', /^Book flights/);
    await press(page, 'Enter');
    await waitText(page, 'Add 2 tasks');
    await focusUntil(page, 'ArrowDown', /^List/);
    await press(page, 'Enter');
    await waitText(page, 'Personal');
    await focusUntil(page, 'ArrowDown', /^Personal/);
    await press(page, 'Enter');
    await waitText(page, 'Add 2 tasks');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^List, Personal/);
    await focusUntil(page, 'ArrowDown', /^(Add 2|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowLeft', /^Add 2/, 3);
    await press(page, 'Enter');
    await waitText(page, '2 tasks added');
    const batch = (await writes()).find(write => write.path === '/task/batch');
    assert.deepEqual(
      batch.body.add.map(task => [task.title, task.projectId, task.dueDate, task.isAllDay]),
      [
        ['Call Ana', 'demo-personal', dueDateFor(1, '15:00'), false],
        ['Pay the rent', 'demo-personal', dueDateFor(4), true],
      ],
    );
    assert.equal(batch.body.add[0].timeZone, MOCK_TIME_ZONE);
    // Review took the place of Add tasks: Back goes to the list, then Lists.
    await waitText(page, 'Review the onboarding screens');
    await press(page, 'Escape');
    await waitText(page, '7 pending · 1 overdue');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'add from Pending goes to the Inbox; Edit and Discard in review'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors} = await openApp(browser, name, session);
    await waitText(page, 'Send the proposal');
    await focusUntil(page, 'ArrowUp', /^Add tasks/);
    await press(page, 'Enter');
    await waitField(page);
    await waitText(page, 'Inbox');
    await compose(page, 'renovar o passaporte amanhã às 9h');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Renovar o passaporte');
    await focusUntil(page, 'ArrowDown', /^(Add 1|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowLeft', /^Edit/, 3);
    await focusUntil(page, 'ArrowRight', /^Edit/, 1);
    await press(page, 'Enter');
    await waitField(page);
    assert.equal(await page.evaluate(() => document.activeElement?.value), 'renovar o passaporte amanhã às 9h');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Add 1 task');
    await focusUntil(page, 'ArrowDown', /^(Add 1|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowLeft', /^Add 1/, 3);
    await press(page, 'Enter');
    await waitText(page, '1 task added');
    const created = (await writes()).find(write => write.path === '/task');
    assert.deepEqual([created.body.title, created.body.projectId, created.body.dueDate], ['Renovar o passaporte', INBOX_ID, dueDateFor(1, '09:00')]);
    await waitText(page, 'Renovar o passaporte');
    // Discard empties the text.
    await focusUntil(page, 'ArrowUp', /^Add tasks/);
    await press(page, 'Enter');
    await waitField(page);
    await compose(page, 'something');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Something');
    await focusUntil(page, 'ArrowDown', /^(Add 1|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowRight', /^Discard/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Send the proposal');
    await page.waitForTimeout(500);
    await focusUntil(page, 'ArrowUp', /^Add tasks/);
    await press(page, 'Enter');
    await waitField(page);
    assert.equal(await page.evaluate(() => document.activeElement?.value), '');
    assert.equal((await writeLines()).filter(line => line === 'POST /task').length, 1);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'edit: title and due through text fields, priority and list by choice'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openWork(page);
    await focusUntil(page, 'ArrowDown', /^Review the onboarding screens/);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight');
    assert.match(await focusLabel(page), /^Edit$/);
    await press(page, 'Enter');
    await waitText(page, 'Edit task');
    await waitField(page);
    assert.match(await focusLabel(page), /Task title/);
    const title = await assertComposerField(page);
    assert.equal(title.value, 'Review the onboarding screens');
    await compose(page, 'Review the new onboarding');
    await press(page, 'ArrowDown');
    assert.match(await focusLabel(page), /Due date/);
    const due = await assertComposerField(page);
    assert.equal(due.value, 'Tomorrow');
    await compose(page, 'tomorrow at 4 pm');
    await focusUntil(page, 'ArrowDown', /^Priority/);
    await press(page, 'Enter');
    await waitText(page, 'Medium');
    await focusUntil(page, 'ArrowDown', /^High/);
    await press(page, 'Enter');
    await waitText(page, 'Edit task');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Priority, High/);
    await focusUntil(page, 'ArrowUp', /^List/);
    await press(page, 'Enter');
    await waitText(page, 'Groceries');
    await focusUntil(page, 'ArrowDown', /^Personal/);
    await press(page, 'Enter');
    await waitText(page, 'Edit task');
    await page.waitForTimeout(500);
    await shot('edit');
    await focusUntil(page, 'ArrowDown', /^Save/, 4);
    await press(page, 'Enter');
    await waitText(page, 'Saved');
    const sent = await writes();
    assert.deepEqual(sent.map(write => `${write.method} ${write.path}`), ['POST /task/move', 'POST /task/demo-work-2']);
    assert.deepEqual(sent[0].body, [{fromProjectId: 'demo-work', toProjectId: 'demo-personal', taskId: 'demo-work-2'}]);
    assert.deepEqual(
      [sent[1].body.title, sent[1].body.projectId, sent[1].body.priority, sent[1].body.dueDate, sent[1].body.isAllDay],
      ['Review the new onboarding', 'demo-personal', 5, dueDateFor(1, '16:00'), false],
    );
    await waitText(page, '6 pending');
    await waitGone(page, 'Review the onboarding screens');

    // An empty Due clears the due date; text that is not a date is refused.
    await focusUntil(page, 'ArrowUp', /^Add tasks/);
    await focusUntil(page, 'ArrowDown', /^Prepare the quarterly report/);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    await waitField(page);
    await press(page, 'ArrowDown');
    await compose(page, 'banana');
    await focusUntil(page, 'ArrowDown', /^Save/, 4);
    await press(page, 'Enter');
    await waitText(page, "Couldn't read that date");
    await focusUntil(page, 'ArrowUp', /Due date/, 6);
    await compose(page, '');
    await focusUntil(page, 'ArrowDown', /^Save/, 4);
    await press(page, 'Enter');
    await waitText(page, 'Saved');
    const cleared = (await writes()).find(write => write.path === '/task/demo-work-3');
    assert.deepEqual([cleared.body.dueDate, cleared.body.startDate], [null, null]);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'delete with a confirmation step, from the row and from the task'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openWork(page);
    await focusUntil(page, 'ArrowDown', /^Renew the domain/);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight', 2);
    assert.match(await focusLabel(page), /^Delete$/);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted from Work');
    await page.waitForTimeout(500);
    await shot('confirm');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    assert.deepEqual(await writeLines(), [], 'Back keeps the task');
    await page.waitForTimeout(500);
    await focusUntil(page, 'ArrowDown', /^Renew the domain/);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight', 2);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted from Work');
    await focusUntil(page, 'ArrowDown', /^Delete/, 4);
    await press(page, 'Enter');
    await waitText(page, 'Renew the domain deleted');
    await waitText(page, '6 pending');
    assert.deepEqual(await writeLines(), ['DELETE /project/demo-work/task/demo-work-4']);
    // From the task screen, Delete goes back to the list.
    await focusUntil(page, 'ArrowUp', /^Send the proposal/);
    await press(page, 'ArrowLeft');
    await press(page, 'Enter');
    await waitText(page, 'High priority');
    await focusUntil(page, 'ArrowDown', /^(Complete|Edit|Delete)/, 10);
    await focusUntil(page, 'ArrowRight', /^Delete/, 3);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted from Work');
    await focusUntil(page, 'ArrowDown', /^Delete/, 4);
    await press(page, 'Enter');
    await waitText(page, '5 pending');
    await waitText(page, 'Add tasks');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'new list through the text field'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await waitText(page, 'Send the proposal');
    await page.waitForTimeout(400);
    await focusUntil(page, 'ArrowUp', /Page 1 of 3/, 12);
    await press(page, 'ArrowRight', 2);
    await focusUntil(page, 'ArrowDown', /Name of the new list/, 4);
    await assertComposerField(page);
    await compose(page, 'Garden');
    await shot('new-list');
    await focusUntil(page, 'ArrowDown', /^Create/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Nothing pending');
    const created = (await writes()).find(write => write.path === '/project');
    assert.deepEqual(created.body, {name: 'Garden', kind: 'TASK', viewMode: 'list'});
    await press(page, 'Escape');
    await waitText(page, 'Reading');
    await page.waitForTimeout(900);
    assert.match(await focusLabel(page), /^Garden, All done/, 'Back lands on the new list');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'errors: loading while retrying, the error only after the last try'(browser, name) {
    // The phone's internet comes up 6 s after the app opens: retries at 2 and 4 s fail, the one at 8 s works.
    await mock('/__mock/reset');
    await mock(`/__mock/fail?path=${encodeURIComponent('^/open/v1/project$')}&status=0&forMs=6000`);
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await page.getByRole('status', {name: 'Loading'}).first().waitFor({state: 'visible', timeout: 4000});
    await shot('retrying');
    for (let waited = 0; waited < 9000; waited += 500) {
      assert.equal(await page.getByText("Can't reach TickTick").count(), 0, 'no connection error while retrying');
      if (await page.getByText('Send the proposal').count()) break;
      await page.waitForTimeout(500);
    }
    await waitText(page, 'Send the proposal', 8000);
    await context.close();

    // No internet at all: still loading through the retries (2 + 4 + 8 + 15 s), then the error with Try again.
    await mock('/__mock/reset');
    await mock(`/__mock/fail?path=${encodeURIComponent('^/open/v1/project$')}&status=0&forMs=120000`);
    const offline = await openApp(browser, `${name}-offline`, session);
    const opened = Date.now();
    await offline.page.getByRole('status', {name: 'Loading'}).first().waitFor({state: 'visible', timeout: 4000});
    while (Date.now() - opened < 26000) {
      assert.equal(await offline.page.getByText("Can't reach TickTick").count(), 0, `no connection error at ${Date.now() - opened} ms`);
      await offline.page.waitForTimeout(1000);
    }
    await waitText(offline.page, "Can't reach TickTick", 15000);
    assert.ok(Date.now() - opened >= 28000, 'the error comes after the last retry');
    await offline.page.waitForTimeout(400);
    await offline.shot('offline');
    await mock('/__mock/reset');
    await focusUntil(offline.page, 'ArrowDown', /Try again/, 4);
    await press(offline.page, 'Enter');
    await waitText(offline.page, 'Send the proposal');
    await offline.context.close();

    await mock('/__mock/reset');
    await mock(`/__mock/fail?path=${encodeURIComponent('^/open/v1/project$')}&status=500&times=1`);
    const failed = await openApp(browser, `${name}-server`, session);
    await waitText(failed.page, 'TickTick is not answering');
    await waitText(failed.page, 'HTTP 500');
    await failed.page.waitForTimeout(400);
    await failed.shot('server');
    await focusUntil(failed.page, 'ArrowDown', /Try again/, 4);
    await press(failed.page, 'Enter');
    await waitText(failed.page, 'Send the proposal');
    assert.deepEqual([...errors, ...offline.errors, ...failed.errors], []);
    await failed.context.close();
  },

  async 'Portuguese'(browser, name) {
    const {page, context, errors, shot} = await openApp(browser, name, {demo: '1'}, {locale: 'pt-BR'});
    await waitText(page, 'Enviar a proposta');
    await waitText(page, 'Atrasadas');
    await waitText(page, 'Ontem · Trabalho');
    await waitText(page, 'Caixa de entrada');
    await focusUntil(page, 'ArrowDown', /^Enviar a proposta/);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight');
    assert.match(await focusLabel(page), /^Editar$/);
    await hints(page, ['Indicador: escolher', 'À direita: próxima', 'À esquerda: anterior']);
    const lines = await page.locator('.hint-dock').first().evaluate(dock => new Set([...dock.children].map(child => Math.round(child.getBoundingClientRect().top))).size);
    assert.equal(lines, 1, 'the hints fit on one line');
    await shot('swipe');
    await press(page, 'ArrowLeft', 2);
    await focusUntil(page, 'ArrowUp', /^Adicionar tarefas/);
    await press(page, 'Enter');
    await waitField(page);
    await compose(page, 'Ligar pro João amanhã às 15h e pagar o aluguel daqui a 4 dias');
    await focusUntil(page, 'ArrowDown', /^Continuar/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Adicionar 2 tarefas');
    await waitText(page, 'Amanhã 15:00');
    await waitText(page, 'Pagar o aluguel');
    await page.waitForTimeout(500);
    await shot('review');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'offline package in demo mode: every screen'(browser, name) {
    const {page, context, errors} = await openApp(browser, name, {demo: '1'}, {appUrl: PACKAGE_APP});
    const external = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== PACKAGE_APP && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) external.push(request.url());
    });
    const capture = async file => {
      await page.waitForTimeout(900);
      await page.screenshot({path: path.join(screensDir, `${browser.browserType().name()}-${file}.png`)});
    };
    await waitText(page, 'Send the proposal');
    await focusUntil(page, 'ArrowDown', /^Send the proposal/);
    await capture('01-TTPending');
    await toLists(page);
    await focusUntil(page, 'ArrowDown', /^Work/);
    await capture('02-TTLists');
    await press(page, 'Enter');
    await waitText(page, 'Review the onboarding screens');
    await focusUntil(page, 'ArrowDown', /^Call João about the contract/);
    await capture('03-TTList');
    await press(page, 'ArrowLeft');
    await capture('04-TTSwipe');
    await press(page, 'ArrowRight');
    await capture('04b-TTSwipeEdit');
    await press(page, 'ArrowLeft');
    await press(page, 'Enter');
    await waitText(page, 'Subtasks · 1 of 3 done');
    await capture('05-TTTask');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    await page.waitForTimeout(500);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    await waitText(page, 'Edit task');
    await capture('06-TTEdit');
    await focusUntil(page, 'ArrowDown', /^Priority/);
    await press(page, 'Enter');
    await waitText(page, 'Medium');
    await capture('07-TTEditPriority');
    await press(page, 'Escape');
    await waitText(page, 'Edit task');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    await page.waitForTimeout(500);
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowRight', 2);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted');
    await capture('08-TTDelete');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    await page.waitForTimeout(500);
    await focusUntil(page, 'ArrowUp', /^Add tasks/);
    await press(page, 'Enter');
    await waitField(page);
    await capture('09-TTWrite');
    await compose(page, 'Call João tomorrow at 3 pm and pay the rent in 4 days');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Add 2 tasks');
    await capture('10-TTReview');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    await page.waitForTimeout(500);
    await focusUntil(page, 'ArrowDown', /^Completed/);
    await press(page, 'Enter');
    await waitText(page, 'Draft the agenda');
    await capture('11-TTCompleted');
    await press(page, 'Escape');
    await waitText(page, 'Add tasks');
    await press(page, 'Escape');
    await waitText(page, 'All done');
    await page.waitForTimeout(400);
    await focusUntil(page, 'ArrowUp', /Page 2 of 3/, 8);
    await press(page, 'ArrowRight');
    await capture('12-NewList');
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    await context.close();

    const setup = await openApp(browser, `${name}-setup`, {}, {appUrl: PACKAGE_APP});
    await waitText(setup.page, 'Connect TickTick');
    await setup.page.waitForTimeout(900);
    await setup.page.screenshot({path: path.join(screensDir, `${browser.browserType().name()}-13-TTSetup.png`)});
    await setup.context.close();
  },
};

const mockServer = await startMockServer();
const appServer = await startStaticServer(path.join(root, 'dist'), 4173);
const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-lists-package-'));
for (const [file, data] of Object.entries(unzipSync(fs.readFileSync(path.join(root, 'dist/lumen-lists.mrbd.zip'))))) {
  fs.mkdirSync(path.dirname(path.join(packageDir, file)), {recursive: true});
  fs.writeFileSync(path.join(packageDir, file), data);
}
const packageServer = await startStaticServer(packageDir, 5500);

try {
  for (const browserName of browsers) {
    const browser = await (browserName === 'firefox' ? firefox : chromium).launch();
    for (const [title, scenario] of Object.entries(scenarios)) {
      if (only && !only.test(title)) continue;
      const name = `${browserName}-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
      try {
        await scenario(browser, name);
        results.push(['pass', browserName, title]);
      } catch (error) {
        await lastPage?.screenshot({path: path.join(outDir, `${name}-FAILED.png`)}).catch(() => {});
        results.push(['FAIL', browserName, title, String(error?.message ?? error).split('\n').slice(0, process.env.E2E_VERBOSE ? 12 : 1).join(' | ')]);
      }
    }
    await browser.close();
  }
} finally {
  mockServer.close();
  appServer.close();
  packageServer.close();
}

for (const [status, browserName, title, detail] of results) {
  console.log(`${status} ${browserName}: ${title}${detail ? ` — ${detail}` : ''}`);
}
if (results.length === 0 || results.some(([status]) => status === 'FAIL')) {
  process.exit(1);
}
