# The SaaS — how it is put together, and how it was cut over

One shop is live on this today, with a catalogue it built by hand with a scanner.
Everything below is written so that shop is never the thing that breaks.

---

## Where it lives

| | |
| --- | --- |
| Firebase project | `libsystem-tn` (Paris, `europe-west9`, Native mode) |
| Pre-SaaS project | `mindora-2ded0` — **frozen, never written to, this is the rollback** |
| Hosting | Netlify |
| Data layout | `shops/{shopId}/products`, `…/sales`, … one subtree per shop |
| Auth | Firebase email + password, self sign-up **off** |
| Back office | `cli/` — accounts, plans, migration, verification |

`europe-west9` was chosen because it is the closest Firestore region to Tunis and
because single-region reads cost about half of multi-region. **It can never be
changed.** A new region means a new project and another migration.

---

## Cut over — done 17 Aug 2026

| | |
| --- | --- |
| shop | Librairie Sofiene |
| shopId | `dtMPyfM3krtS6wgdxhJ3` |
| login | `librairie.sofiene@libsystem.tn` |
| plan | paid until 2027-08-17 |
| imported | 791 documents — 740 products, 30 packs, 14 categories, 3 suppliers, 3 customers, settings |
| not imported | 17 sales, 9 credit entries, 0 purchases — the fresh start that was asked for |
| verified | counts, stock on hand 68 348, catalogue hash `8784e7ae`, all numeric fields typed |

The email is a login, not a mailbox: Firebase never sends to it or verifies it.
There is no `email:set` in the CLI, so changing it means `shops:repair` onto a
new account.

---

## Moving a shop between projects

`migrate:legacy` copies root → `shops/{id}/…` **inside one project**. That is not
this job any more, because the SaaS moved to a project of its own. Two commands
do the crossing instead, and they are deliberately two: a pull that lands on
disk is something you can inspect, diff and keep.

```bash
node cli/lib.mjs pull:legacy                     # old project -> backups/*.json
node cli/lib.mjs import:file --shop <shopId> --dry-run
node cli/lib.mjs import:file --shop <shopId>
node cli/lib.mjs verify      --shop <shopId> --file backups/<that file>
```

`pull:legacy` needs **no service-account key for the old project** — that
project still carries `allow read, write: if true`, so the public web API key
frozen in `.env.legacy` is already enough to read every document. It therefore
keeps working now that the old project sits under a different Google account.

`verify` must exit zero. It compares, file against shop: every collection's
document count, the **total stock on hand**, a checksum over every product's
`(barcode, name, quantity, costPrice, salePrice)`, and the **type** of every
numeric field. That last one is not paranoia: Firestore's REST API returns
integers as *strings*, and a `quantity: "100"` renders identically in the UI
while breaking every comparison and every low-stock check. It is the one fault
in this whole operation that would survive a visual check.

What the import does: copies products, packs, categories, suppliers, settings
untouched; copies customers with `balance` reset to `0`; skips sales, purchases
and credit entries; clears each product's `soldQty / soldRevenue / soldCost /
boughtQty / boughtCost / lastSoldAt`, because the tickets those totals were
added up from are not coming and would otherwise report revenue no sale can
explain. It reuses the same document ids, so it is idempotent — **run it once
more right before the app deploy** to pick up anything added in between.

---

## Ordering — and why it changed

The earlier version of this document deployed the app **before** the rules,
because the old bundle read root paths *in the same project* and would have met
root-denied rules with no way to push a fix (`scripts/pwa.ts` has no
`skipWaiting`, so a deploy does not reach a till until a full load).

Moving to a separate project removed that constraint. The client's installed
bundle points at `mindora-2ded0` and has never heard of `libsystem-tn`, so
locking this project down cannot reach them. **The rules went out first, safely.**

What that also means: the cutover moment is now the **Netlify deploy**. The
instant a till loads the new bundle it changes project, and any sale it rings
after that lands here and not there. So re-run `pull:legacy` + `import:file`
immediately before deploying, and check the sync badge shows nothing pending
first.

After the app deploy, at the till:

1. Sign in. The full catalogue, with correct quantities.
2. The ticket header prints **Librairie Sofiene**, not "Librairie" — the default
   name showing up here is how a wrong settings path announces itself.
3. Ventes and Achats empty, as intended. Fournisseurs and Carnet load. A pack scans.
4. Ring one real one-unit sale, confirm the quantity dropped, ring the return.
5. Create a throwaway product, reload, confirm it persisted, delete it.
6. Press **Sauvegarde** and keep the file — the first post-cutover backup, and
   proof the export follows the new paths.

---

## Abort

The old project was never written to and its permissive rules are untouched, so
aborting is: roll the Netlify deploy back to the pinned build, and put the old
`.env.legacy` values back in `.env.local`. The old app resumes exactly where it
was, with its own data, in its own project. Nothing needs undoing here.

`firestore.rules.rollback` exists for the *same-project* abort and re-opens a
database to the whole internet. It is not needed for this shape of cutover and
should not be deployed to `libsystem-tn`.

---

## The rules, and one trap in them

```
match /shops/{shopId}/{collection}/{document=**}   read: owns(shopId)
                                                   write: owns(shopId) && paid()
match /shops/{shopId}                              get: owns(shopId)
                                                   write: false
everything else, root collections included         no rule = denied
```

**`request.auth != null` is not an authorization check in this project.** The
web API key is compiled into the bundle every shop downloads, so anyone who
views source can call the sign-up endpoint and arrive holding a valid, anonymous
account. Owning a shop — carrying a `shopId` custom claim that only the admin
CLI can set — is the only thing that counts. Self sign-up is *also* off in the
console; that is a second lock on the same door, not a substitute.

**Reads outlive the plan on purpose.** A lapsed shop can still open its books,
look up a debt and take a full backup. It simply cannot record anything new.

**The `{collection}` segment is load-bearing. Do not "simplify" it away.** Under
`rules_version = '2'` a recursive wildcard matches **zero** or more segments, so
`/shops/{shopId}/{document=**}` also matches `/shops/{shopId}` *itself*. Firestore
ORs every matching rule, so the later `allow write: if false` refuses nothing
another match already granted — written the obvious way, a shop could PATCH its
own record. `paidUntil` lives in that record, and while the rules read the plan
from the signed claim, `plan:extend` reads the *document* to work out the new
date; a shop that rewrote it would be feeding a number of its choosing into the
next claim the back office issues. Requiring `{collection}` makes the shortest
matching path `/shops/X/products/Y`, leaving the shop document to the block that
refuses writes. This was found by testing the boundary, not by reading it.

### Proving the boundary

Java is not installed here, so the emulator was never used. The rules were
verified against the live project instead, over the REST API with a real signed
token — which is stronger, since it tests what is actually deployed:

| check | expect |
| --- | --- |
| stranger reads the shop with only the bundled API key | 403 |
| the shop reads its own products | 200 |
| the shop writes a product, and a nested subcollection | 200 |
| **the shop reads another shop** | **403** |
| signed-in, and anonymous, read of root `/products` | 403 |
| listing every shop on the platform | 403 |
| the shop reads its own record | 200 |
| **the shop extends its own plan** | **403** |
| the shop invents a new shop record | 403 |

Re-run that after any change to `firestore.rules`.

---

## Day to day

```bash
node cli/lib.mjs shops:list                        # who, and how much plan is left
node cli/lib.mjs shops:show librairie.sofiene@libsystem.tn
node cli/lib.mjs plan:extend  <email|shopId> --days 365
node cli/lib.mjs shops:suspend <email|shopId>      # writes stop, reading still works
node cli/lib.mjs shops:resume  <email|shopId> --days 30
node cli/lib.mjs password:set --email ... --password ...
node cli/lib.mjs backup --shop <shopId>
node cli/lib.mjs stats                             # docs per shop, against the free tier
```

A plan change reaches an open browser within the hour, or at once on reload.
`suspend` revokes the refresh token so it takes effect on the next reload rather
than at the end of that hour — rewriting a claim cannot invalidate the token
still carrying the old one.

The Admin SDK's **Auth** calls time out from a cold start often enough to notice
(`app/network-timeout` after 25 s). Firestore calls in the same process are
fine. Just run the command again; `shops:create` checks before it writes, so a
timed-out attempt leaves nothing behind.

---

## Cost

Hosting will never be the cost. The built bundle is 1.9 MB (≈0.55 MB gzipped)
across 61 files, `/assets/*` is served `immutable` for a year, and a service
worker precaches all of it — so bandwidth is *(devices × deploys × bundle)*, not
*(devices × page views)*. Fifty shops on two devices each with a monthly deploy
is well under a gigabyte a *year*, against Netlify's 100 GB a *month*.

Firestore reads are the cost model. Free every day: 50 000 reads, 20 000 writes,
1 GiB. Past that, **$0.06 per 100 000 reads** in a single region. A cold app
start on this shop attaches listeners across ~800 documents; warm starts are
near-free because `persistentLocalCache` plus resume tokens only bill what
changed. Call it 1 000–2 000 reads per shop per day → roughly 25–40 shops inside
the free tier, and a million reads a month costs 60 cents.

**Enable Blaze anyway, with a budget alert.** Not to spend — Blaze includes the
same free quota. The reason is that on Spark, exceeding the daily quota does not
bill you, it starts *refusing reads*: a paying client's till would stop working
mid-afternoon and not recover until the quota resets. On Blaze the same busy day
costs a few cents. Know the caveat: a budget alert **notifies, it does not cap**.

---

## What is deliberately NOT in this deploy

**The shared barcode catalogue.** It is the only client-writable collection
outside a shop and the only cross-tenant read surface in the design, so it does
not ship on cutover day. The groundwork is in: `catalogKey()` in
`src/features/stock/barcode.ts` (8–14 digits, never a `2…` in-store code, which
shops mint per-shop and therefore collide by construction) and
`cli/lib.mjs catalog:seed`. Three things to settle first:

- **Names and units only. Never a price.** The receiving shop computes its sale
  price from its own margin on the cost *it* paid, and the till defaults an
  unknown cost to `0` — so a borrowed sale price with no cost behind it mints a
  100 %-margin phantom into that shop's profit report. Category is a free-text
  key into the *contributing* shop's own list and means nothing elsewhere.
- **`allow get`, never `allow read`.** `read` includes `list`, and `list` lets
  one account walk the entire catalogue.
- **Read it off the scan path.** `lookup()` receives raw typed text and pasted
  strings, and there is no error boundary anywhere in `src/` — one
  `doc(db, 'catalog', '')` throws and takes the till with it. Do the lookup from
  "create this product" only.

**Read-cost work**, once a week of real numbers exists in the usage graph:
denormalise `debtStartedAt`/`lastPaymentAt` onto the customer document so
`useAllCreditEntries` can go (capping it instead would silently drop the oldest
debtors from the dashboard), and lifetime spend onto the supplier document so
`usePurchases` needs no documents on the suppliers page.

**App Check** in monitoring mode, then enforced. It closes the "the API key is
in the bundle" hole properly, but it puts a token fetch in front of a till that
must sell through a dropped line, so it is not a cutover-day change.

Already done: the Argent page asked for the newest 500/1500/4000/12000 tickets
depending on the period and re-queried on every switch — up to 18 000 reads to
click through four tabs. It now asks for a date range, so reporting on today
reads today.
