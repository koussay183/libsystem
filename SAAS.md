# Going multi-tenant — the cutover runbook

A shop is using this today, with a catalogue it built by hand with a scanner.
**Nothing in this document is optional, and the order is the whole point.**

The single fact that makes it safe: the migration **copies out of** the old root
collections and never writes to or deletes from them. Until you deploy the new
rules, the old app keeps working exactly as it does now. Every step before the
rules deploy is reversible by doing nothing.

---

## What changed in the app

| Before | After |
| --- | --- |
| `products`, `sales`, … at the root | `shops/{shopId}/products`, … |
| `allow read, write: if true` | one shop per signed claim, writes gated on the plan |
| one shared password in the bundle | Firebase Auth, email + password |
| — | `cli/` — accounts, plans, migration, verification |

`src/lib/tenant.ts` holds the shop id and builds every path. It is **not** a
security boundary — it is read from `localStorage` and anyone can edit it. The
rules compare the path against the `shopId` **custom claim** on the ID token,
which only the CLI can set. A tampered value gets `permission-denied`, not data.

---

## Before you start

```bash
cd cli && npm install
```

Then Firebase console → **Project settings → Service accounts → Generate new
private key**, and save it as `cli/service-account.json`. It is gitignored, and
it can do anything to your project — treat it like the keys to the shop.

```bash
node cli/lib.mjs help
```

---

## T-2 days — close the front door

1. Console → **Authentication → Sign-in method** → enable **Email/Password**.
2. Console → **Authentication → Settings → User actions** → **uncheck
   "Enable create (sign-up)"**.

Step 2 matters more than it looks. The Firebase web API key is compiled into the
bundle every shop downloads, so without this anyone who views source can create
themselves an account. The rules never trust `request.auth != null` for exactly
this reason — this is the second lock on the same door, not a substitute.

3. Take the off-machine copy:

```bash
node cli/lib.mjs export-root
```

Copy the file out of `backups/` onto something that is not this PC. There is
already one from before this work started; keep both.

---

## T-1 day — provision and migrate

```bash
node cli/lib.mjs shops:create --email client@example.tn --password "..." \
  --name "Librairie X" --days 365
```

Write down the shop id it prints.

**Check the claim types before going further.** Sign in on a dev machine and run
this in the console:

```js
firebase.auth().currentUser.getIdTokenResult().then(r => console.log(r.claims))
```

`shopId` must be a non-empty **string**, `paidUntil` a **number**. If
`paidUntil` came out as a string or a date, the rules' `is int` guard denies
every write and the shop is silently read-only. Stop and fix the CLI.

Then migrate, dry first:

```bash
node cli/lib.mjs migrate:legacy --shop <shopId> --dry-run
node cli/lib.mjs migrate:legacy --shop <shopId>
node cli/lib.mjs verify --shop <shopId>
```

`verify` must exit zero. It compares, root against shop: every collection's
document count, the **total stock on hand**, and a checksum over every
product's `(barcode, name, quantity, costPrice, salePrice)`. A mismatch means
do not cut over.

What the migration does:

- **copies** products, packs, categories, suppliers, settings — untouched
- **copies** customers with `balance` reset to `0`
- **skips** sales, purchases, credit_entries — the fresh start you asked for
- **clears** each product's `soldQty / soldRevenue / soldCost / boughtQty /
  boughtCost / lastSoldAt`, because the tickets those totals were added up from
  are not coming; left alone they would report revenue no sale can explain
- **keeps** `quantity`, `barcode`, names, all five price fields, thresholds,
  family/variant/unit/category/supplier
- **deletes nothing**

It reuses the same document ids, so it is idempotent. **Run it once more right
before the deploy** to pick up anything the shop added in between.

---

## Cutover day — after closing, till not selling

1. On the shop's machine, check the sync badge in the header shows nothing
   pending, and that it is online.
2. Deploy the app to Netlify. **The rules stay as they are for now** — this is
   deliberate. The new bundle reads `shops/<shopId>/…`, which already exists and
   is already readable under the permissive rules.
3. At the till, accept the update banner or hard-reload, then confirm in
   DevTools → Application → Service Workers that the new version is **active**,
   not waiting. `scripts/pwa.ts` has no `skipWaiting` by design, so a deploy does
   not reach the till until a full load. **Do not skip this.** If the rules go
   out while the till is still running the old root-path bundle, the till dies.
4. Sign in with the email and password. Check:
   - the full catalogue, with correct quantities
   - the ticket header prints the real shop name, **not** "Librairie" — the
     default name showing up here is how a wrong settings path announces itself
   - Ventes and Achats empty, as intended
   - Fournisseurs and Carnet load; a pack scans
5. Ring one real one-unit sale, confirm the product quantity went down, then ring
   the matching return.
6. Create a throwaway product, reload, confirm it persisted, delete it.

**Only now**, deploy the rules:

```bash
firebase deploy --only firestore:rules
```

7. Reload the till once and repeat checks 4–6.
8. From a second browser profile with no account, confirm
   `shops/<shopId>/products` returns `permission-denied`.
9. Press **Sauvegarde** in the app and keep the file — your first post-cutover
   backup, and proof the export follows the new paths.

---

## Abort, valid at any point

```bash
cp firestore.rules.rollback firestore.rules
firebase deploy --only firestore:rules
```

…and roll the Netlify deploy back to the pinned build. The root collections were
never written to or deleted, so the old app resumes exactly where it was.
`firestore.rules.rollback` re-opens the database to the internet — accepted for
the few minutes of an abort and for nothing else. **Put the real rules back
immediately afterwards.** Confirm the till sells before you walk away.

---

## Day to day

```bash
node cli/lib.mjs shops:list                        # who, and how much plan is left
node cli/lib.mjs shops:show client@example.tn      # detail + document counts
node cli/lib.mjs plan:extend client@example.tn --days 365
node cli/lib.mjs shops:suspend client@example.tn   # writes stop, reading still works
node cli/lib.mjs shops:resume  client@example.tn --days 30
node cli/lib.mjs password:set --email ... --password ...
node cli/lib.mjs backup --shop <shopId>
node cli/lib.mjs stats                             # docs per shop, against the free tier
```

A plan change reaches an open browser within the hour, or at once on reload.
`suspend` revokes the refresh token so it takes effect on the next reload rather
than at the end of that hour.

**A lapsed plan is read-only, not locked out.** They can still open their books,
look up a debt and take a full backup — they just cannot record anything new.
The app says so in an orange bar rather than letting saves fail silently.

---

## What is deliberately NOT in this deploy

**The shared barcode catalogue.** It is the only client-writable collection
outside a shop and the only cross-tenant read surface in the design, so it does
not ship on cutover day. The groundwork is in: `catalogKey()` in
`src/features/stock/barcode.ts` (8–14 digits, and never a `2…` in-store code,
which shops mint per-shop and therefore collide by construction), and
`cli/lib.mjs catalog:seed`.

Three things to know before switching it on:

- **Names and units only. Never a price.** The receiving shop computes its sale
  price from its own margin on the cost it paid, and the till defaults an
  unknown cost to `0` — so a borrowed sale price with no cost behind it mints a
  100%-margin phantom into that shop's profit report. Category is a free-text
  key into the *contributing* shop's own list and means nothing elsewhere.
- **`allow get`, never `allow read`.** `read` includes `list`, and `list` lets
  one account walk the entire catalogue.
- **Read it off the scan path.** `lookup()` receives raw typed text and pasted
  strings, and there is no error boundary anywhere in `src/` — one `doc(db,
  'catalog', '')` throws and takes the till with it. Do the lookup from
  "create this product" only.

**Read-cost work**, once a week of real numbers exists in the Firestore usage
graph: denormalise `debtStartedAt`/`lastPaymentAt` onto the customer document so
`useAllCreditEntries` can go (capping it instead would silently drop the oldest
debtors from the dashboard), and lifetime spend onto the supplier document so
`usePurchases` needs no documents on the suppliers page.

Already done in this deploy: the Argent page asked for the newest 500/1500/4000/
12000 tickets depending on the period, re-querying on every switch — up to
18,000 reads to click through four tabs. It now asks for a date range, so
reporting on today reads today.

**App Check** in monitoring mode, then enforced. It closes the "the API key is
in the bundle" hole properly, but it puts a token fetch in front of a till that
must sell through a dropped line, so it is not a cutover-day change.
