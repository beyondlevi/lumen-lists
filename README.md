# Unofficial TickTick for Lumen

Your [TickTick](https://ticktick.com) on [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen)
glasses, built as a Meta Ray-Ban Display web app with the official UI Toolkit for Meta Ray-Ban
Display: the tasks pending in every list and in the Inbox, by day; complete, view, edit, delete and
add tasks, dictated or written with the band.

> **Unofficial.** Not made by, affiliated with, endorsed or sponsored by TickTick (Appest Inc.), Meta
> Platforms, Inc. or Rokid. TickTick is a trademark of its owner, used here only to say what the app
> works with. The app talks to TickTick through its public Open API with your own token.

**Status:** 0.2.0. Tested against a mock of the TickTick Open API and in demo mode. Version 0.1.0
(the shopping-list app this grew from) was tried on the glasses with a real TickTick account.

The package id stays `cloud.bynd.lumen.lists` and the setting `ticktick.token`, so installing 0.2.0
over 0.1.0 keeps the token already saved on the phone.

## What it does

| Screen | What you do there |
| --- | --- |
| **Pending** (start, first tab) | Every pending task of every list and of the Inbox, grouped into Overdue, Today, Tomorrow, each of the next days by name, Later and No date; sorted by due date, then priority. Each row: the checkbox in the priority's color (high red, medium yellow, low blue, none gray), the title, and the due date (red when overdue, blue when today) with the list. *Add tasks* first. |
| **Lists** (second tab) | The Inbox, then your lists: "7 pending", "7 pending · 1 overdue", "All done". |
| **New** (third tab) | A text field for a list name, then Create. |
| **A list** | *Add tasks*, the pending tasks with their due dates, and *Completed · N* last. |
| **Options on a row** | Swipe **left** on a task: View, Edit and Delete appear (icons). Swipe left again to move between them, right to go back to the row. |
| **Task** (View) | Title, due date and time, priority, tags, notes and subtasks ("1 of 3 done", listed). Complete, Edit, Delete. |
| **Edit** | Title and Due are real text fields (dictate or write: "tomorrow 3 pm", "amanhã 15h"; empty clears the due date). List and Priority (None, Low, Medium, High) open a choice. Save. |
| **Add tasks** | A text field for one or more tasks: "Call João tomorrow at 3 pm and pay the rent on Friday". Continue. |
| **Review** | The tasks understood, each with its due date and a checkbox (an index tap leaves one out), the List they go to (the list you were in, or the Inbox from Pending), then *Add N*, Edit (back to the text) and Discard. |
| **Completed** | The tasks completed in the list in the last 7 days. An index tap makes one pending again. |
| **Delete** | A confirmation step. Back keeps the task. |
| **Connect TickTick** | While the token is missing or refused: the three steps and Try again. |

An **index tap** on a task completes it at once; if TickTick refuses, it comes back with a message.
The **middle tap** is Back everywhere: up one screen, and out of the app from the start screen.

### How dictated or written text becomes tasks

- Tasks are split on new lines, ";" and commas (not a decimal comma). An "and" / "e" splits only when
  both sides have a due date of their own: "Call João tomorrow at 3 pm and pay the rent on Friday"
  is two tasks, "buy milk and eggs tomorrow" is one.
- The due date is read with [chrono](https://github.com/wanasit/chrono) in English and Portuguese
  ("tomorrow at 3 pm", "next Monday", "in 4 days", "amanhã às 15h", "na sexta", "dia 20 de
  outubro"), whatever the glasses' language, and taken out of the title with the words that led to
  it ("on", "at", "na", "às"…). Without a time, the task is due all day.
- The first letter of the title is capitalized.

### Due dates

The app keeps TickTick's `dueDate`, `isAllDay` and `timeZone`. A timed task shows in the glasses'
time zone; an all-day task is the calendar day it was set for, in its own time zone. New tasks and
edits are saved with the glasses' time zone, all-day tasks at midnight of their day there. Dates and
times are written in the wearer's language (English, or Portuguese for `pt-*`), times as 15:00.

## Setup

1. In TickTick: **Settings › Account › API Token**. Create a token and copy it.
2. Install the package on the glasses (below), then on your phone open **Lumen › Apps › TickTick**
   and paste the token in **TickTick API token**.
3. Open TickTick on the glasses: your tasks and lists show up.

Settings (`lumen_config` in `public/manifest.webmanifest`):

| Key | Type | |
| --- | --- | --- |
| `ticktick.token` | secret | The TickTick API token. Required. |
| `demo` | text, optional | `1` (or `on`, `true`, `yes`) shows demo tasks instead of TickTick. |

### Installing the package

`npm run package` writes `dist/lumen-lists.mrbd.zip`. Install it from the phone (Lumen companion,
Apps tab, **Add › Offline package from a file**, or **Replace the package** on the installed app) or
from a computer with Lumen's `scripts/push-webapp.sh dist/lumen-lists.mrbd.zip`. The manifest
declares `lumen_internet: true`, so Lumen brings up the internet for the calls to TickTick.

## Privacy

- The app talks only to TickTick (`https://api.ticktick.com`), straight from the glasses, with your
  token. There is no server in between, and no analytics.
- The token is a Lumen `secret`: it stays on the glasses, the companion never shows it, and the app
  never logs it or puts it in an address (only the development fallback in a regular browser keeps
  it in that browser's localStorage, see [Development](#development)).
- On the glasses the app keeps only the names and task counts of your lists (to show them at once
  while they load) and the id of the list opened last. Tasks are always read from TickTick.

## Demo mode

Fictional tasks in an Inbox and four lists (Work, Groceries, Personal, Reading; in Portuguese
Caixa de entrada, Trabalho, Mercado, Pessoal, Leitura), dated from today, with no network and
nothing stored. Turn it on with the `demo` setting (`1`) on the phone, or `?demo=1` in the address
in a browser (`?demo=0` turns it off). The screenshots of this app are taken in demo mode.

## TickTick API use

All calls go to `https://api.ticktick.com/open/v1` with `Authorization: Bearer <token>`:

| Call | For |
| --- | --- |
| `GET /project` | The lists (task lists that are not closed; note lists are left out). |
| `GET /project/inbox/data` | The Inbox and its pending tasks (see below). |
| `GET /project/{id}/data` | A list's pending tasks. |
| `POST /task/completed` | Completed: a list's tasks completed in the last 7 days. |
| `POST /task`, `POST /task/batch` | Adding one task, or several (up to 50 per request). |
| `POST /project/{id}/task/{id}/complete` | Completing a task. |
| `POST /task/{id}` | Editing (title, due date, priority); reopening (`status: 0`). |
| `POST /task/move` | Moving a task to another list in Edit, before the update. |
| `DELETE /project/{id}/task/{id}` | Deleting a task. |
| `POST /project` | A new list. |

**How Pending is fetched.** The app reads `GET /project`, then each list's
`GET /project/{id}/data` (four at a time) and the Inbox's, and groups the pending tasks itself. It
does not use `POST /task/filter`: that call returns at most 200 tasks, filters on `startDate` (so
tasks without dates are not certain to come back), and its documentation does not say how it treats
the Inbox. The per-list reads also give the counts on Lists and each list's screen at once.

**The Inbox.** `GET /project` does not list it. The documentation names the Inbox `inbox` in the
`projectIds` of `POST /task/undone` and says `POST /task/completeTasks` uses it when `projectId` is
empty; the app reads it with `GET /project/inbox/data` and takes its real id from the answer (the
`project` there, or the `projectId` of its tasks) for later calls. That `GET /project/inbox/data`
answers is not stated in the documentation for that endpoint.

**Reopening** has no documented endpoint. `reopenTask` in `src/ticktick/client.ts` sends
`POST /task/{id}` with `status: 0`, which reopens the task on TickTick (seen by the owner with 0.1.0).
If TickTick ever answers with the task still completed, it creates a copy in the list and deletes
the completed one.

**Clearing a due date** in Edit sends `dueDate: null` and `startDate: null`; the documentation does
not say how TickTick takes it.

Network failures are retried after 2, 4, 8 and 15 seconds, and everything refreshes when the app
comes back into view.

## Development

Node 22. React 19 + Vite + TypeScript with `@wearables-ui-toolkit/mrbd` 129, and `chrono-node`.

```sh
npm ci
npm run dev                  # http://localhost:5173/?demo=1
npm run typecheck
npm test                     # unit tests (Vitest, in America/Sao_Paulo): parser, due dates, API client, reopen, config, strings
npx playwright install chromium firefox
npm run package              # builds and writes dist/lumen-lists.mrbd.zip
npm run test:e2e             # Playwright, keyboard only, on a mock TickTick (needs the package)
npm run mock                 # the mock alone, on http://127.0.0.1:8091
npm run icons                # renders public/icon-*.png (a list with a check)
```

- In a regular browser there is no `window.lumen`, so settings come from the address:
  `?ticktick.token=<token>` (kept in localStorage, removed from the address) and, for the mock,
  `&ticktick.api=http://127.0.0.1:8091` with the token `MOCK_TOKEN` from `mock/server.mjs`.
- `npm run test:e2e` serves `dist/` and the unzipped package like Lumen does and runs every scenario
  in Firefox (Lumen's engine is GeckoView, Firefox 156) and Chromium: setup, a refused token,
  Pending and completing, the left swipe and its actions, View, Lists and Completed, reopening (both
  ways), adding tasks through the text field with due dates and another list, adding to the Inbox,
  Edit (text fields and choices, moving, clearing the due date), Delete, a new list, network and
  server errors, Portuguese, and the offline package in demo mode with a 600x600 capture of every
  screen in `.e2e-output/screens/`. It checks that each text field is a real `<textarea>` and that
  Enter on it is not prevented, then fills it the way the composer does.
  `E2E_BROWSERS=firefox` and `E2E_ONLY=<regex>` narrow it down.
- The UI Toolkit's structure validator and quality gate (`check-webapp.mjs`) pass on this app.

### Layout

| Path | |
| --- | --- |
| `src/ticktick/` | The TickTick Open API client and the app's types. |
| `src/tasks/` | Due dates (time zones, grouping, formatting), the text parser, labels. |
| `src/state/` | Loading with retries, the task actions, settings, the way back to a row. |
| `src/pages/` | One file per screen. |
| `src/components/` | State screens, the swipe's mirrored arrows, row helpers. |
| `src/demo/` | Demo mode: fixtures (also used by the mock) and an in-memory client. |
| `src/i18n/strings.ts` | Every visible string, in English and Portuguese. |
| `mock/server.mjs` | The mock TickTick for the e2e tests. |

## Known limits

- 0.2.0 has not been run on the glasses or against a real TickTick account yet.
- Recurring tasks are shown and completed as TickTick answers them; the app does not show the
  repeat rule. Tags, notes and subtasks are shown but not edited; reminders are not shown.
- Swiping left reveals the actions because the app mirrors ArrowLeft and ArrowRight inside the
  Toolkit's `SwipeToReveal`; moving between View, Edit and Delete is also mirrored.
- Shared lists you can only read should refuse changes; the app then shows a message and rolls
  back. Not tested.

## License

MIT, see [LICENSE](LICENSE).
