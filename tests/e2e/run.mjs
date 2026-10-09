// Keyboard-only end-to-end tests against the mock TickTick API (mock/server.mjs).
//
//   npm run package && npm run test:e2e             (Firefox + Chromium)
//   E2E_BROWSERS=firefox npm run test:e2e
//   E2E_ONLY='add items' npm run test:e2e            (scenarios whose title matches)
//
// The built app is served like the Lumen host serves a package (static files,
// SPA fallback) on 127.0.0.1:4173 and the mock on 127.0.0.1:8091, so every call
// is a real cross-origin request with a CORS preflight, as with TickTick. The
// offline package test unzips dist/lumen-lists.mrbd.zip and serves that, and
// also saves a 600x600 capture of every screen in demo mode under
// .e2e-output/screens/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {chromium, firefox} from 'playwright';
import {MOCK_PORT, MOCK_TOKEN, startMockServer} from '../../mock/server.mjs';
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
async function focusUntil(page, key, pattern, limit = 12) {
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

async function waitField(page, timeout = 8000) {
  await page.locator('textarea').first().waitFor({state: 'visible', timeout});
  await page.waitForTimeout(500);
}

async function waitGone(page, text, timeout = 8000) {
  await page.getByText(text, {exact: true}).first().waitFor({state: 'hidden', timeout});
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
    return {tag: field.tagName, type: field.getAttribute('type'), disabled: field.disabled, readOnly: field.readOnly, prevented: event.defaultPrevented};
  });
  assert.equal(probe.tag, 'TEXTAREA');
  assert.equal(probe.disabled, false);
  assert.equal(probe.readOnly, false);
  assert.equal(probe.prevented, false, 'Enter on the text field must not be prevented');
  return probe;
}

async function openApp(browser, name, config, {appUrl = APP, route = '/', locale = 'en-US'} = {}) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}, locale});
  await context.addInitScript(values => {
    if (!sessionStorage.getItem('e2e-config-set')) {
      localStorage.setItem('lumen-lists.dev-config', JSON.stringify(values));
      sessionStorage.setItem('e2e-config-set', '1');
    }
  }, config);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${appUrl}${route}`);
  return {page, context, errors, shot: step => page.screenshot({path: path.join(outDir, `${name}-${step}.png`)})};
}

const session = {'ticktick.token': MOCK_TOKEN, 'ticktick.api': MOCK};

async function openGroceries(page) {
  await waitText(page, 'Groceries');
  await focusUntil(page, 'ArrowDown', /^Groceries/);
  await press(page, 'Enter');
  await waitText(page, 'Add items');
  await page.waitForTimeout(500);
}

const scenarios = {
  async 'setup screen, then the token arrives'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, {});
    await waitText(page, 'Connect TickTick');
    await waitText(page, 'Settings › Account › API Token');
    await page.waitForTimeout(600);
    await shot('setup');
    await page.evaluate(values => localStorage.setItem('lumen-lists.dev-config', JSON.stringify(values)), session);
    await focusUntil(page, 'ArrowDown', /Try again/, 4);
    await press(page, 'Enter');
    await waitText(page, 'Groceries');
    assert.match(await focusLabel(page), /Groceries/);
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

  async 'lists, an item in the cart and back, focus restored on Back'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await waitText(page, 'Groceries');
    await waitText(page, '7 to buy');
    await waitText(page, 'All bought');
    assert.equal(await page.getByText('Recipes').count(), 0, 'note lists are not shown');
    assert.equal(await page.getByText('Old list').count(), 0, 'closed lists are not shown');
    await shot('home');
    await openGroceries(page);
    await waitText(page, '7 of 12 left');
    await focusUntil(page, 'ArrowDown', /^Milk/);
    await press(page, 'Enter');
    await waitText(page, '6 of 12 left');
    assert.match(await focusLabel(page), /^Bananas/, 'focus moves to the next item');
    assert.ok((await writeLines()).includes('POST /project/demo-groceries/task/demo-groceries-open-1/complete'));
    await shot('checked');
    await focusUntil(page, 'ArrowDown', /^In the cart/);
    await press(page, 'Enter');
    await waitText(page, 'Bread');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Milk/, 'the newest in the cart comes first');
    await shot('cart');
    await press(page, 'Enter');
    await page.waitForTimeout(600);
    const reopen = (await writes()).find(write => write.path === '/task/demo-groceries-open-1');
    assert.equal(reopen?.body?.status, 0);
    assert.match(await focusLabel(page), /^Bread/);
    await press(page, 'Escape');
    await waitText(page, '7 of 12 left');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^In the cart/, `Back restores the focus on In the cart (${await focusLabel(page)})`);
    await press(page, 'Escape');
    await waitText(page, 'Pharmacy');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Groceries/, 'Back restores the focus on the list');
    assert.equal(new URL(page.url()).pathname, '/');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'put back: falls back to a new task when TickTick keeps it completed'(browser, name) {
    await mock('/__mock/reset');
    await mock('/__mock/reopen?mode=ignore');
    const {page, context, errors} = await openApp(browser, name, session);
    await openGroceries(page);
    await focusUntil(page, 'ArrowDown', /^In the cart/);
    await press(page, 'Enter');
    await waitText(page, 'Bread');
    await page.waitForTimeout(400);
    assert.match(await focusLabel(page), /^Bread/);
    await press(page, 'Enter');
    await page.waitForTimeout(800);
    const sent = await writes();
    assert.deepEqual(
      sent.map(write => `${write.method} ${write.path}`),
      ['POST /task/demo-groceries-cart-0', 'POST /task', 'DELETE /project/demo-groceries/task/demo-groceries-cart-0'],
    );
    assert.equal(sent[0].body.status, 0);
    assert.deepEqual({title: sent[1].body.title, projectId: sent[1].body.projectId}, {title: 'Bread', projectId: 'demo-groceries'});
    await press(page, 'Escape');
    await waitText(page, '8 of 12 left');
    await waitText(page, 'Bread');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'add items through the text field, review and Back'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openGroceries(page);
    assert.match(await focusLabel(page), /^Add items/);
    await press(page, 'Enter');
    await waitField(page);
    await assertComposerField(page);
    await compose(page, 'Milk, two kilos of rice and coffee filters');
    await shot('written');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Already in the list');
    await waitText(page, 'Add 2 items');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Rice/);
    await shot('review');
    await press(page, 'Enter');
    await waitText(page, 'Add 1 item');
    await press(page, 'Enter');
    await waitText(page, 'Add 2 items');
    await focusUntil(page, 'ArrowDown', /^(Add 2|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowLeft', /^Add 2/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Coffee filters');
    await waitText(page, '9 of 14 left');
    const batch = (await writes()).find(write => write.path === '/task/batch');
    assert.deepEqual(
      batch.body.add.map(task => [task.title, task.content ?? '', task.projectId]),
      [
        ['Rice', '2 kg', 'demo-groceries'],
        ['Coffee filters', '', 'demo-groceries'],
      ],
    );
    assert.ok(batch.body.add[0].sortOrder < batch.body.add[1].sortOrder, 'added in the spoken order, at the end');
    await page.waitForTimeout(500);
    await shot('added');
    // Review took the place of Add items: Back goes to the start screen.
    await press(page, 'Escape');
    await waitText(page, 'Pharmacy');
    assert.equal(new URL(page.url()).pathname, '/');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'review: Edit goes back to the text, Discard drops it'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors} = await openApp(browser, name, session);
    await openGroceries(page);
    await press(page, 'Enter');
    await waitField(page);
    await compose(page, 'pão e manteiga');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Manteiga');
    await focusUntil(page, 'ArrowDown', /^(Add 2|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowLeft', /^Edit/, 3);
    await press(page, 'Enter');
    await waitField(page);
    assert.equal(await page.evaluate(() => document.activeElement?.value), 'pão e manteiga');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Manteiga');
    await focusUntil(page, 'ArrowDown', /^(Add 2|Edit|Discard)/, 4);
    await focusUntil(page, 'ArrowRight', /^Discard/, 3);
    await press(page, 'Enter');
    await waitText(page, '7 of 12 left');
    assert.deepEqual(await writeLines(), []);
    await page.waitForTimeout(500);
    await press(page, 'Enter');
    await waitField(page);
    assert.equal(await page.evaluate(() => document.activeElement?.value), '', 'Discard empties the draft');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'item options: edit through the text field'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openGroceries(page);
    await focusUntil(page, 'ArrowDown', /^Milk/);
    await press(page, 'ArrowRight');
    await waitText(page, 'Dictate or write');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^In the cart/);
    await shot('options');
    await focusUntil(page, 'ArrowDown', /^Edit/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Edit item');
    await page.waitForTimeout(500);
    await assertComposerField(page);
    assert.equal(await page.evaluate(() => document.activeElement?.value), '2 boxes Milk');
    await compose(page, 'three boxes of oat milk');
    await focusUntil(page, 'ArrowDown', /^Save/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Oat milk');
    await waitText(page, '3 boxes');
    const update = (await writes()).find(write => write.path === '/task/demo-groceries-open-1');
    assert.deepEqual({title: update.body.title, content: update.body.content}, {title: 'Oat milk', content: '3 boxes'});
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Oat milk/, 'Back on the list, the edited item keeps the focus');
    await press(page, 'Escape');
    await waitText(page, 'Pharmacy');
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'item options: delete with a confirmation step'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await openGroceries(page);
    await focusUntil(page, 'ArrowDown', /^Tomatoes/);
    await press(page, 'ArrowRight');
    await waitText(page, 'Dictate or write');
    await focusUntil(page, 'ArrowDown', /^Delete/, 3);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted from Groceries');
    await page.waitForTimeout(500);
    await shot('confirm');
    // Back keeps the item.
    await press(page, 'Escape');
    await waitText(page, 'Dictate or write');
    await page.waitForTimeout(400);
    assert.match(await focusLabel(page), /^Delete/);
    assert.deepEqual(await writeLines(), []);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted from Groceries');
    await page.waitForTimeout(400);
    await focusUntil(page, 'ArrowDown', /^Delete/, 3);
    await press(page, 'Enter');
    await waitText(page, '6 of 11 left');
    await waitGone(page, 'Tomatoes');
    assert.deepEqual(await writeLines(), ['DELETE /project/demo-groceries/task/demo-groceries-open-0']);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'new list through the text field'(browser, name) {
    await mock('/__mock/reset');
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await waitText(page, 'Groceries');
    await page.waitForTimeout(400);
    await focusUntil(page, 'ArrowUp', /Lists|Page 1 of 2/, 4);
    await press(page, 'ArrowRight');
    await focusUntil(page, 'ArrowDown', /Name of the new list/, 4);
    await assertComposerField(page);
    await compose(page, 'Garden');
    await shot('new-list');
    await focusUntil(page, 'ArrowDown', /^Create/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Nothing to buy');
    const created = (await writes()).find(write => write.path === '/project');
    assert.deepEqual(created.body, {name: 'Garden', kind: 'TASK', viewMode: 'list'});
    await press(page, 'Escape');
    await waitText(page, 'Garden');
    await page.waitForTimeout(500);
    assert.match(await focusLabel(page), /^Garden/);
    assert.deepEqual(errors, []);
    await context.close();
  },

  async 'errors: network retry, server error with Try again, rollback'(browser, name) {
    await mock('/__mock/reset');
    await mock(`/__mock/fail?path=${encodeURIComponent('^/open/v1/project$')}&status=0&forMs=1200`);
    const {page, context, errors, shot} = await openApp(browser, name, session);
    await waitText(page, "Can't reach TickTick");
    await shot('offline');
    // Retried by itself after 2 s.
    await waitText(page, 'Groceries', 6000);
    await openGroceries(page);
    await mock(`/__mock/fail?path=${encodeURIComponent('/complete$')}&status=500&times=1`);
    await focusUntil(page, 'ArrowDown', /^Milk/);
    await press(page, 'Enter');
    await waitText(page, "Couldn't put Milk in the cart");
    await waitText(page, '7 of 12 left');
    await shot('rollback');
    await press(page, 'Escape');
    await waitText(page, 'Pharmacy');
    await mock(`/__mock/fail?path=${encodeURIComponent('/project/demo-pharmacy/data$')}&status=500&times=1`);
    await focusUntil(page, 'ArrowDown', /^Pharmacy/);
    // Opening reloads the list; a failed refresh keeps what was shown.
    await press(page, 'Enter');
    await waitText(page, 'Sunscreen');
    await context.close();

    await mock('/__mock/reset');
    await mock(`/__mock/fail?path=${encodeURIComponent('^/open/v1/project$')}&status=500&times=1`);
    const failed = await openApp(browser, `${name}-server`, session);
    await failed.page.evaluate(() => localStorage.removeItem('lumen-lists.cache'));
    await waitText(failed.page, 'TickTick is not answering');
    await waitText(failed.page, 'HTTP 500');
    await failed.page.waitForTimeout(400);
    await failed.shot('server');
    await focusUntil(failed.page, 'ArrowDown', /Try again/, 4);
    await press(failed.page, 'Enter');
    await waitText(failed.page, 'Groceries');
    assert.deepEqual([...errors, ...failed.errors], []);
    await failed.context.close();
  },

  async 'Portuguese'(browser, name) {
    const {page, context, errors, shot} = await openApp(browser, name, {demo: '1'}, {locale: 'pt-BR'});
    await waitText(page, 'Mercado');
    await waitText(page, '7 para comprar');
    await waitText(page, 'Tudo comprado');
    await focusUntil(page, 'ArrowDown', /^Mercado/);
    await press(page, 'Enter');
    await waitText(page, 'faltam 7 de 12');
    await press(page, 'Enter');
    await waitField(page);
    await compose(page, 'Leite, dois quilos de arroz e meia dúzia de ovos');
    await focusUntil(page, 'ArrowDown', /^Continuar/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Já está na lista');
    await waitText(page, 'Adicionar 2 itens');
    await waitText(page, '2 kg');
    await waitText(page, 'Ovos');
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
    await waitText(page, 'Groceries');
    await capture('01-ListHome');
    await focusUntil(page, 'ArrowUp', /Lists|Page 1 of 2/, 4);
    await press(page, 'ArrowRight');
    await capture('02-NewList');
    await press(page, 'ArrowLeft');
    await focusUntil(page, 'ArrowDown', /^Groceries/, 4);
    await press(page, 'Enter');
    await waitText(page, '7 of 12 left');
    await focusUntil(page, 'ArrowDown', /^Milk/);
    await capture('03-ListOpen');
    await press(page, 'ArrowRight');
    await waitText(page, 'Dictate or write');
    await capture('04-ListItem');
    await focusUntil(page, 'ArrowDown', /^Delete/, 3);
    await press(page, 'Enter');
    await waitText(page, 'will be deleted');
    await capture('05-ListDelete');
    await press(page, 'Escape');
    await waitText(page, 'Dictate or write');
    await press(page, 'Escape');
    await waitText(page, '7 of 12 left');
    await focusUntil(page, 'ArrowDown', /^In the cart/);
    await press(page, 'Enter');
    await waitText(page, 'Bread');
    await capture('06-ListCart');
    await press(page, 'Escape');
    await waitText(page, '7 of 12 left');
    await focusUntil(page, 'ArrowUp', /^Add items/);
    await press(page, 'Enter');
    await waitField(page);
    await capture('07-ListWrite');
    await compose(page, 'Milk, two kilos of rice and coffee filters');
    await focusUntil(page, 'ArrowDown', /^Continue/, 3);
    await press(page, 'Enter');
    await waitText(page, 'Already in the list');
    await capture('08-ListReview');
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    await context.close();

    const setup = await openApp(browser, `${name}-setup`, {}, {appUrl: PACKAGE_APP});
    await waitText(setup.page, 'Connect TickTick');
    await setup.page.waitForTimeout(900);
    await setup.page.screenshot({path: path.join(screensDir, `${browser.browserType().name()}-09-ListSetup.png`)});
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
