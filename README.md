# lumen-lists

Shopping lists on [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) glasses, kept in your
[TickTick](https://ticktick.com) lists and built as a Meta Ray-Ban Display web app with the official
UI Toolkit for Meta Ray-Ban Display: check items off as they go in the cart, add items dictated or
written with the band.

> **Unofficial.** Not affiliated with, endorsed or sponsored by TickTick (Appest Inc.), Meta
> Platforms, Inc. or Rokid. TickTick is a trademark of its owner, used here only to say what the app
> works with.

**Status:** 0.1.0. Tested against a mock of the TickTick Open API and in demo mode; not yet on the
glasses or against a real TickTick account (see [Known limits](#known-limits)).

## What it does

Your TickTick lists are your shopping lists. The phone, the computer and the glasses see the same
items, because the app keeps nothing of its own: it reads and writes TickTick.

| Screen | What you do there |
| --- | --- |
| **Lists** (start) | One row per TickTick list, with how many items are left to buy ("12 to buy", "All bought"). The list you opened last has the focus. **New** (the `+` beside Lists) creates a list. |
| **A list** | "Groceries · 7 of 12 left". *Add items* first, then the items to buy (title, and the quantity or note under it), then *In the cart · 5*. An **index tap** on an item puts it in the cart at once (it is completed in TickTick); if TickTick refuses, it comes back with a message. **Swipe right** on an item opens its options. |
| **Item options** | *In the cart*, *Edit* (the text field with the item's text: dictate or write), *Delete* (asks once more). |
| **In the cart** | What you put in the cart in this list in the last 24 hours. An index tap puts an item back in the list. |
| **Add items** | A text field: an index tap on it opens Lumen's composer, where you dictate or write with the band, as many items as you like ("Milk, two kilos of rice and coffee filters"). Then *Continue*. |
| **Review** | The items understood, each with a checkbox (an index tap unchecks one), then *Add 3*, *Edit* (back to the text) and *Discard*. An item already in the list is shown as such and not added twice. |
| **Connect TickTick** | Shown while the token is missing or TickTick refuses it, with the three steps below and *Try again*. |

The middle tap is Back everywhere: it goes up one screen (from Review, back to the list, keeping
the text), and closes the app from the start screen.

### How dictated or written text becomes items

- Items are split on new lines, commas and the last "and" (English) or "e" (Portuguese) of each
  line: "milk, eggs and bread" gives three items. A decimal comma ("1,5 kg") and a number with "e"
  ("vinte e cinco") are not split.
- A leading quantity becomes the item's second line (the TickTick task's content): "two kilos of
  rice" and "2 kg de arroz" give *Rice* / *Arroz* with "2 kg". Numbers in digits, fractions (½, 1/2)
  or words in English and Portuguese ("twenty-five", "vinte e cinco", "half a", "meio", "a dozen",
  "meia dúzia"), and units such as kg, g, L, ml, lb, oz, boxes, packs, bottles, cans, bags, jars,
  caixas, pacotes, garrafas, latas, sacos, potes, unidades.
- The first letter of each item is capitalized. Articles ("a", "some", "um", "uma") are dropped.
- Both languages are understood whatever the glasses' language is.

## Setup

1. On [ticktick.com](https://ticktick.com): **Settings › Account › API Token**. Create a token and
   copy it.
2. Install the package on the glasses (below), then on your phone open **Lumen › Apps › Lists** and
   paste the token in **TickTick API token**.
3. Open Lists on the glasses: your TickTick lists show up.

The app's settings (`lumen_config` in `public/manifest.webmanifest`):

| Key | Type | |
| --- | --- | --- |
| `ticktick.token` | secret | The TickTick API token. Required. |
| `demo` | text, optional | `1` (or `on`, `true`, `yes`) shows demo lists instead of TickTick. |

Lists shows *task* lists that are not closed (note lists are left out). The app follows setting
changes made on the phone while it is open.

### Installing the package

`npm run package` writes `dist/lumen-lists.mrbd.zip`. Install it from the phone (Lumen companion,
Apps tab, **Add › Offline package from a file**) or from a computer with Lumen's
`scripts/push-webapp.sh dist/lumen-lists.mrbd.zip`. The manifest declares `lumen_internet: true`, so
Lumen brings up the internet (the phone's when the glasses have none) for the calls to TickTick.

## Privacy

- The app talks only to TickTick (`https://api.ticktick.com`), straight from the glasses, with your
  token. There is no server in between, and no analytics.
- The token is a Lumen `secret`: it stays on the glasses, the companion never shows it, and the app
  never logs it, puts it in an address or stores it (only the development fallback in a regular
  browser keeps it in that browser's localStorage, see [Development](#development)).
- On the glasses the app keeps only the names and item counts of your lists (to show the start
  screen at once while it loads) and the id of the list opened last, in the app's own storage.
  Items are always read from TickTick.

## Demo mode

Fictional lists (Groceries, Pharmacy, Hardware store; in Portuguese Mercado, Farmácia, Loja de
ferragens), with no network and nothing stored: every change lives in memory until the app closes.
Turn it on with the `demo` setting (`1`) on the phone, or with `?demo=1` in the address in a browser
(`?demo=0` turns it off). The screenshots of this app are taken in demo mode.

## Development

Node 22. React 19 + Vite + TypeScript with `@wearables-ui-toolkit/mrbd` 129.

```sh
npm ci
npm run dev                  # http://localhost:5173/?demo=1
npm run typecheck
npm test                     # unit tests (Vitest): parser, API client, reopen, config, strings
npx playwright install chromium firefox
npm run package              # builds and writes dist/lumen-lists.mrbd.zip
npm run test:e2e             # Playwright, keyboard only, on a mock TickTick (needs the package)
npm run mock                 # the mock alone, on http://127.0.0.1:8091
npm run icons                # renders public/icon-*.png (monochrome cart)
```

- In a regular browser there is no `window.lumen`, so settings come from the address:
  `http://localhost:5173/?ticktick.token=<token>` (kept in localStorage, removed from the address)
  and, for the mock, `&ticktick.api=http://127.0.0.1:8091` with the token `MOCK_TOKEN` from
  `mock/server.mjs`. Don't paste a real token in a shared browser.
- `npm run test:e2e` serves `dist/` and the unzipped package like Lumen does (static files with an
  SPA fallback on `127.0.0.1`) and runs every scenario in Firefox (Lumen's engine is GeckoView,
  Firefox 156) and Chromium: setup, a refused token, lists, putting items in the cart and back
  (both ways of reopening), adding items through the text field (it checks the field is a real
  `<textarea>` and that Enter on it is not prevented, then fills it the way the composer does),
  review, edit, delete, a new list, network and server errors, Portuguese, and the offline package
  in demo mode with a 600x600 capture of every screen in `.e2e-output/screens/`.
  `E2E_BROWSERS=firefox` and `E2E_ONLY=<regex>` narrow it down.
- The UI Toolkit's structure validator and quality gate (`check-webapp.mjs`) pass on this app.

### Layout

| Path | |
| --- | --- |
| `src/ticktick/` | The TickTick Open API client and the app's types. |
| `src/items/parse.ts` | Text to items (split, quantities, duplicates, edit text). |
| `src/state/` | Loading with retries, the item actions, settings, focus on the way back. |
| `src/pages/` | One file per screen. |
| `src/demo/` | Demo mode: fixtures (also used by the mock) and an in-memory client. |
| `src/i18n/strings.ts` | Every visible string, in English and Portuguese. |
| `mock/server.mjs` | The mock TickTick for the e2e tests. |
| `scripts/` | Packaging (`package-offline.mjs`) and icons. |

## TickTick API use

All calls go to `https://api.ticktick.com/open/v1` with `Authorization: Bearer <token>`:

| Call | For |
| --- | --- |
| `GET /project` | The lists. |
| `GET /project/{id}/data` | A list's open items (and the counts on the start screen). |
| `POST /task/completed` | The cart: items completed in the list in the last 24 hours. |
| `POST /task`, `POST /task/batch` | Adding one item, or several (up to 50 per request). |
| `POST /project/{id}/task/{id}/complete` | Putting an item in the cart. |
| `POST /task/{id}` | Editing an item (title and content). |
| `DELETE /project/{id}/task/{id}` | Deleting an item. |
| `POST /project` | A new list. |

Network failures are retried after 2, 4, 8 and 15 seconds, and lists refresh when the app comes
back into view.

**Putting an item back from the cart** has no documented endpoint. `reopenItem` in
`src/ticktick/client.ts` first sends `POST /task/{id}` with `status: 0`; if TickTick answers with
the task open, that is it. Otherwise it creates a new task with the same title and content in the
list and deletes the completed one, so it doesn't stay in the cart next to its copy (TickTick's
completed history then loses that entry). Which of the two happens with the real API has not been
checked yet.

## Known limits

- Not yet run on the glasses, and not against a real TickTick account: the API mapping follows the
  documentation and is tested against a mock.
- Reopening (above) is unverified against TickTick.
- Lists shared with you read-only should make TickTick refuse changes; the app then shows a message
  and rolls back. Not tested.
- The cart shows at most 200 items (the API's limit).
- The app's JavaScript is about 220 KB gzipped, most of it the UI Toolkit.

## License

MIT, see [LICENSE](LICENSE).
