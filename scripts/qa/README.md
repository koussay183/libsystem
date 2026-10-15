# Local QA harness

Test the **logged-in** app end to end on this machine, with **no production
access**: Firebase Auth + Firestore emulators (project `demo-mektebti`, the
repo's real `firestore.rules`), a seeded demo bookshop, and a Vite dev server
wired to the emulators. Playwright signs in with a helper.

Nothing here can reach the real `libsystem-tn` project:

- `demo-*` project ids have no backend; the emulators answer everything.
- `seed.mjs` refuses to run unless both emulator hosts are loopback and the
  project id starts with `demo-`, and it never loads a credential.
- The app only connects to the emulators when `import.meta.env.DEV` is true
  **and** `VITE_USE_EMULATORS=1` (`src/lib/firebase.ts`). A production build
  (`npm run build`, i.e. Netlify) compiles that branch away, so the flag has no
  effect there.

## Prerequisites

Node 22, Java 21 (for the Firestore emulator), the root `npm install` already
done, and Chromium at `/opt/pw-browsers/chromium` (override with
`QA_CHROMIUM=/path/to/chrome`). `up.sh` runs `npm install` in `scripts/qa`
(firebase-tools, firebase-admin, playwright-core 1.56.1, which matches the
installed Chromium 141) the first time.

## Usage

All commands from the repo root.

```bash
bash scripts/qa/up.sh                 # start emulators + vite :5199 (idempotent, flock-guarded)
node scripts/qa/seed.mjs qa-demo      # (re)create account + shop "qa-demo"
node scripts/qa/smoke.mjs             # full self-test: up, seed qa-smoke, rules check, login, stock page
bash scripts/qa/down.sh               # stop everything up.sh started (emulator data is discarded)
```

| Service     | Address                  |
|-------------|--------------------------|
| App (Vite)  | http://127.0.0.1:5199    |
| Auth        | http://127.0.0.1:9099    |
| Firestore   | http://127.0.0.1:8080    |
| Project id  | `demo-mektebti`          |

State lives in `/tmp/qa` (override with `QA_STATE_DIR`): `logs/emulators.log`,
`logs/vite.log`, `run/*.pid`, `up.lock`, and the smoke screenshots
`smoke-home.png` / `smoke.png`.

`up.sh` leaves healthy services alone. It refuses to start if a port is held by
something else, for example a plain `npm run dev` on 5199 without the emulator
flag. In that case it says so; stop that process or run `down.sh`.

## Seeding

```bash
node scripts/qa/seed.mjs <name> [--plan active|lapsed|blocked] [--empty]
node scripts/qa/seed.mjs --wipe-all     # empty both emulators (all shops, all accounts)
```

- **Account:** `<name>@qa.test`, password `qa-pass-123`, uid `<name>-uid`. The
  uid is deliberately different from the shop id. Custom claims are
  `{ shopId: '<name>', paidUntil }`, exactly what `cli/lib.mjs shops:create`
  sets.
- **`--plan`:**
  - `active` (default): paidUntil = 2099-12-31.
  - `lapsed`: 2 days past, still inside the 14-day rules grace window. The
    banner shows and writes still work.
  - `blocked`: past the grace window. Reads work and every write is refused.
- **`--empty`:** only the account, `shops/<name>` and `settings/shop`. Use it
  to test first-run and empty states.
- Running the seed again wipes `shops/<name>/**` and re-seeds it. Other shops
  are untouched. The history is deterministic per name; dates are relative to
  now.
- `<name>` must match `[a-z0-9][a-z0-9-]{1,40}`. Use one name per agent or test
  (`qa-pos`, `qa-credit`…) so parallel tests don't reset each other's data.

What a full seed contains (`shops/<name>/…`, shapes from `src/types/models.ts`,
money in integer millimes, timestamps in epoch ms):

| Collection       | Contents |
|------------------|----------|
| `products`       | 43 articles. EAN-13 codes `6191234xxxxxC` with valid check digits; one hand-added article has `barcode: null`. Two variant families (Stylo BIC Cristal ×4, Surligneur Stabilo Boss ×2). HT + VAT 0/7/19 → `costPrice`, `margin`, `salePrice`. Some low stock and one out of stock (Stylo plume Pelikan). Lifetime `sold*`/`bought*` totals agree with the seeded sales and purchases. |
| `categories`     | 8 (Cahiers, Écriture, Papeterie, Livres scolaires, …) |
| `suppliers`      | 3 (products and purchases refer to them by name, as the app does) |
| `customers`      | 5, all with a non-zero `balance` that equals the sum of their `credit_entries` |
| `credit_entries` | 8 lines: hand-written debits and payments, plus 2 linked to credit tickets (`saleId`, `ticketNo`). One debt is 75 days old and was never paid, so it is overdue for a reminder. |
| `sales`          | About 40 tickets over the last 21 days, including today. Includes discounts, change given, one `kind: 'invoice'` facture and 2 tickets on credit (`partial` and `credit`). |
| `purchases`      | 3 supplier invoices: fully paid, half paid and unpaid, so there is supplier debt |
| `packs`          | Pack rentrée 1ère année (with an in-store `2…` barcode) and Pack collège 7ème année |
| `settings/shop`  | Name `Librairie QA · <name>`, address, matricule placeholder, margins, VAT, `moneyMode: 'dinar'`, 3 QR services (Photocopie, Impression, Reliure) |

The seed also writes `shops/<name>` (the CLI's shop record) and 9 entries in
the global `catalog/{code}` (5 of the shop's own codes, 3 it doesn't stock yet,
and 1 "official" school book).

**All names, phone numbers, prices and VAT rates are invented test data.** They
are not market prices, tax rules or real people.

## Playwright

`login.mjs` exports:

- `login(page, name, { lang?, password?, timeout? })`: signs in and waits for
  the logged-in home page. It throws a clear error if the account is not seeded.
- `loggedInPage(browser, name, { viewport?, lang? })`: creates a fresh isolated
  context, logs in and returns `{ context, page, errors }`. `errors` collects
  uncaught page errors.
- `launch(opts)`: headless Chromium from `/opt/pw-browsers/chromium` with this
  folder's playwright-core.
- `goto(page, path)`: full navigation to `BASE_URL + path`, then settle.
- `settle(page)`: waits until no spinner is visible. Use it before screenshots.
- `url(path)`, `BASE_URL`, `QA_PASSWORD`, `emailFor(name)`.

`login()` takes any Playwright `page`, so it also works with your own
`playwright` install (for example `/tmp/claude-0/shots/node_modules`).

```js
// /tmp/my-test.mjs — run with: node /tmp/my-test.mjs
import { launch, loggedInPage, goto } from '/home/user/libsystem/scripts/qa/login.mjs'

const browser = await launch()
const { page, errors } = await loggedInPage(browser, 'qa-demo', {
  lang: 'ar',                                   // RTL Tunisian Arabic UI
  viewport: { width: 390, height: 844 },        // phone
})
await goto(page, '/credit')
await page.screenshot({ path: '/tmp/qa/credit-ar.png', fullPage: true })
console.log('page errors:', errors)
await browser.close()
```

Routes behind the login: `/`, `/caisse`, `/stock`, `/catalog`, `/packs`,
`/invoices`, `/suppliers`, `/credit`, `/credit/cust-c1` … `cust-c5`,
`/dashboard`, `/reports`, `/backup`, `/settings`.

To test a scanner at the till, type an EAN into the focused page followed by
Enter. For example, `6191234000158` is "Cahier 96 pages Seyès". Read the codes
from the stock page or from the emulator.

## Inspecting data

```bash
# one document over the emulator REST API (admin access, bypasses rules):
curl -s -H 'Authorization: Bearer owner' \
  'http://127.0.0.1:8080/v1/projects/demo-mektebti/databases/(default)/documents/shops/qa-demo/settings/shop'
```

Or use firebase-admin from a script in `scripts/qa` with
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` set. See `seed.mjs` for the pattern
(`seedShop()` and `wipeAll()` are exported).

## Troubleshooting

- **`up.sh` says a port is in use:** run `bash scripts/qa/down.sh`. If the port
  belongs to a process `up.sh` did not start, stop it yourself.
- **The emulator does not start:** read `/tmp/qa/logs/emulators.log`. The
  Firestore emulator jar is cached in `~/.cache/firebase/emulators/`, and
  `scripts/qa/node_modules/.bin/firebase setup:emulators:firestore` downloads
  it again.
- **Data disappeared:** the emulators keep data in memory only. Re-seed after
  every `up.sh` that started them (`smoke.mjs` does this itself).
- **You changed `firestore.rules`:** the emulator normally picks up the edited
  file on its own. To be sure it did, run `down.sh`, `up.sh`, then re-seed.
