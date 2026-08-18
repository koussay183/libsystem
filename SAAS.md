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
| a shop `get`s one catalogue entry | 200 |
| **a shop `list`s the catalogue** | **403** |
| a shop writes, or invents, a catalogue entry | 403 |
| a stranger with only the bundled key reads, or lists, the catalogue | 403 |
| a shop writes its own `catalog_contributions` | 200 |
| **a shop reads, or writes, another shop's contributions** | **403** |

15/15 as of the catalogue deploy. Re-run it after any change to
`firestore.rules`. The script is not in the repo because it needs a throwaway
shop's password; the pattern is: `shops:create` a `TEST — delete me` shop, sign
in over `identitytoolkit` with the API key from `.env.local`, walk the table with
`fetch`, then delete the account **and** its documents — subcollections first,
since deleting a document leaves its children orphaned.

---

## The shared barcode catalogue

`/catalog` is the only path outside `shops/{shopId}/…`, and it is **read-only for
every client**. It holds what a manufacturer's barcode is called. No price, no
cost, no category, no shop id.

```
/catalog/{code}            get: signed in AND carries a shopId claim
                           list: false        ← walking it is the whole risk
                           write: false       ← for everyone, always
/shops/{id}/catalog_contributions/{code}      the shop's own subtree
```

A shop publishes by writing into **its own subtree**, and `catalog:harvest`
promotes those with the Admin SDK. That indirection is the entire security
design: with no client-writable root collection there is nothing to flood,
nothing to poison, and no per-account bookkeeping needed to make `confirms`
trustworthy. It costs immediacy, which was never the valuable part.

```bash
node lib.mjs catalog:seed --shop <shopId>            # publish a shop's GTIN names
node lib.mjs catalog:seed --shop <shopId> --cnp      # ALSO the 6-digit CNP books
node lib.mjs catalog:harvest [--shop <id>] [--clear] # promote what shops offered
node lib.mjs catalog:fix <code> --name "..."         # settle a disagreement
node lib.mjs catalog:purge <code>                    # the remedy of last resort
```

**The first writer is authoritative; everything after it is evidence.** An absent
code is created. The same name increments `confirms` and touches nothing else. A
*different* name is recorded under `alts` with a count and **does not overwrite**
— a shop calling a pen "Bic bleu" is not evidence that "STYLO BIC CRISTAL" is
wrong, and the last run of a command is the worst possible tiebreaker.
`catalog:fix` is how a human settles one, on purpose.

`--clear` is opt-in, and keeping contributions is the safer default: a kept
contribution is re-offered next harvest, where it either adds a confirmation or
shows up as the same unresolved disagreement — a standing reminder. Deleted, a
disagreement is gone and nobody ever settles it.

**Two id rules, and they must not drift.** `catalogKey()` in
`src/features/stock/barcode.ts` and `catalogId()` in `cli/lib.mjs` are the same
rule written twice, and a disagreement between them raises no error anywhere — it
silently stops finding things.

- 8–14 digits: EAN-8, UPC-A, EAN-13, ITF-14. Always a legal document id.
- **Never a leading `2`**, which GS1 reserves for in-store codes a shop mints
  against its own stock and which therefore collide across tenants by
  construction. The exception is length 14, where the first digit is an ITF-14
  packaging indicator, so the GTIN inside is what is judged.
- Six-digit **CNP** school-book numbers live under `cnp-`. **No shop can
  contribute one** — contributions go through the GTIN rule only. They are a
  national standard, the same titles under the same numbers in every bookshop in
  the country, so they are curated from a checked list. It is the one place a
  wrong name would be wrong for everybody at once.

That id space cannot be widened cheaply later: entries already written under the
old rule become unreachable. It was settled before the first seed for that reason.

**The lookup is off the scan path**, and must stay off it. `lookup()` at the till
sees raw typed and pasted text dozens of times a minute, and an article the shop
already stocks needs no catalogue. It runs from "create this product" instead,
bounded at 700 ms, swallowing every failure into a plain `null`, and it never
overwrites a field the owner has already typed in.

Seeded: 546 entries from Librairie Sofiene's 740 products (194 skipped — no
usable code, a code shared by two of its own articles, or an unusable name).

---

## Signing up a new bookshop

Everything runs from `cli/`, against the service-account key in
`cli/service-account.json`. One command creates the account, the shop and the
plan together:

```bash
cd cli
node lib.mjs shops:create \
  --email librairie.exemple@libsystem.tn \
  --password "un-mot-de-passe-solide" \
  --name "Librairie Exemple" \
  --days 365
```

It prints the three things to hand over: the email, the password, and the shop
id. Then give them **https://libsystem-tn.netlify.app** and nothing else — there
is no sign-up page, on purpose, and there must never be one.

Four things worth knowing before you run it:

- **`--email` is a login, not a mailbox.** Firebase never sends to it and never
  verifies it. `librairie.<something>@libsystem.tn` keeps them tidy and does not
  need the address to exist. There is no `email:set`, so changing one later means
  `shops:repair` onto a new account — pick it deliberately.
- **`--name` is printed on their tickets.** Getting it wrong is visible to their
  customers by the afternoon. It is also the tell that a settings path is wrong:
  a ticket header reading "Librairie" instead of the real name means the shop
  document is not being read.
- **`--days` is the plan, and the rules add a fortnight to it.** A 365-day plan
  really stops writing on day 379. That grace exists so a till that sold offline
  across its own expiry does not have its whole queue refused and rolled back on
  reconnect — see the note on `graceMs()` below.
- **It is safe to run twice.** If the account already exists it attaches to it
  rather than failing, which is exactly what happens after a half-finished first
  attempt. It refuses only if that account already owns a different shop.

Expect `shops:create` to time out occasionally with `app/network-timeout` after
about 25 seconds. That is the Admin SDK's **Auth** cold start, not a failure —
Firestore calls in the same process are fine. Run it again; it checks before it
writes, so a timed-out attempt leaves nothing behind.

Then, so their first day is not a week of typing:

```bash
node lib.mjs catalog:seed --shop <shopId> --cnp --dry-run   # the CNP school books
node lib.mjs catalog:harvest --dry-run                      # what shops have offered
```

And when they call:

```bash
node lib.mjs shops:show librairie.exemple@libsystem.tn
node lib.mjs password:set --email librairie.exemple@libsystem.tn --password "..."
node lib.mjs plan:extend  librairie.exemple@libsystem.tn --days 365
node lib.mjs backup --shop <shopId>
```

`--dry-run` works on everything that writes. Use it first, always.

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

**`shops:suspend` no longer revokes the session, and that is deliberate.** It
used to, which made the suspension bite on the next reload instead of at the end
of that hour — but revoking strands an offline till: its next token refresh fails
permanently, it lands on `/login`, and signing in needs the network it does not
have. Every ticket it queued during the outage is refused in the same instant. A
suspension for a late invoice must never be able to destroy takings a shop has
already collected. So the default is the claim change alone, and the shop keeps
writing for up to an hour on the token it already holds. That hour is the price.

`--revoke` is still there for the case that actually wants it — a compromised
account, where locking it out is worth more than its data. It records `revokedAt`
on the shop, because **revocation cannot be undone**: `shops:resume` warns you,
but the shop still has to sign in again, on the till, with a working line. Have
the password ready.

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

## Still open

Written down because a known gap is cheaper than a rediscovered one.

**A hard reload while offline still lands on the browser's error page.** Chrome
and Edge bypass the service worker for a shift-reload, for the navigation and
every subresource, so the request goes to a network that is not there. This is
exactly what a shopkeeper does when the screen looks wrong. There is no
worker-side API to opt back in — the honest mitigation is `controlledAtLoad` in
`src/lib/serviceWorker.ts`: when it is false after registration settles, this tab
is not offline-protected and the app could say so and ask for a plain F5. Not
built.

**Idempotency for a delivery or a ledger line.** `recordPurchase` mints a fresh
document id per call, so a browser crash or a device swap mid-entry can still
produce two invoices for one delivery — nothing in the data says "this is the
same facture". The cancel-then-retry route that used to cause it is closed, but
the shape remains. A deterministic id, or a client-supplied operation key, is the
fix.

**`removeCustomer` can orphan ledger lines.** It deletes what the query returns,
and offline that query answers from the cache — a line the cache has evicted is
not deleted and outlives the customer under a `customerId` nothing resolves. It
refuses outright when it cannot read the ledger at all, which is the half that
matters; the eviction case needs a CLI sweep to find. Do a delete with a line up
if there is a choice.

**`credit_entries` is excluded from the cross-project migration** (`MIGRATE_SKIP`
in `cli/lib.mjs`), so a shop moved between projects arrives with customer
`balance` values that no ledger lines support: `buildLedger`'s running balance and
`customer.balance` then disagree on every carnet page. Fine for the one shop that
was moved with a deliberate fresh start; a trap for the next one.

**Three copies of the grace window.** `graceMs()` in `firestore.rules`,
`RULES_GRACE_MS` in `cli/lib.mjs`, and `RULES_GRACE_MS` in
`src/auth/AuthContext.tsx`. They cannot be shared — one is a rules expression on
Google's servers, one is in a Node script holding the admin key, one is compiled
into the bundle — so each names the other two. Change one, change three.

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

---

## The catalogue browser, and the school books

The shared catalogue is no longer scan-only. `/catalog` in the app is a browse
screen, and the rules therefore allow `list` — **capped at 120 documents per
query** (`request.query.limit`, the only lever rules have over query size).
Without a limit at or under the cap the query is refused before it reads
anything, which is what keeps an unbounded walk of the collection off the read
bill. Verified live: `limit: 500` and a query with no limit both return 403.

There is still no commercial data in there. Names, brands, categories, units,
barcodes — what an article *is*. Never a shop's cost, margin, supplier or stock.

**Search** is a prefix range over `nameLower`, a folded (lowercased,
accent-stripped) copy of the name written by the CLI, because Firestore has no
case-insensitive comparison and no substring search. `foldName()` in
`cli/lib.mjs` and `foldSearch()` in `useCatalog.ts` must stay identical — a drift
between them raises no error, it just stops finding things. Run
`catalog:reindex` after any seed.

**A name search cannot be combined with a filter.** Each pairing of an equality
filter with an ordering on another field needs its own composite index, and a
missing index does not degrade — the query fails outright.

```bash
node lib.mjs catalog:official --shop <shopId> [--dry-run]  # the state-priced books
node lib.mjs catalog:reindex                               # backfill nameLower
```

### Manuels scolaires — the one place a price is shared

A manuel scolaire costs the same in every librairie in Tunisia because the state
sets it. That price is a fact about the book, like its title, so it travels with
the catalogue entry — and so does the purchase price, because the CNP sells to
booksellers at a fixed discount.

That discount is **not assumed, it is asserted**: across all 52 six-digit CNP
articles in the shop this was built from, `costPrice` is exactly 75 % of
`salePrice`. `catalog:official` recomputes it and **skips any book that does not
match**, reporting it — which immediately caught one (`Base 3 — القرآن الكريم`,
priced at 60 %). A wrong purchase price would put a wrong margin into every shop
that took the book, so guessing was not an option.

51 books are published, `base3` through `sec4`. A shop picks a level, types
quantities, and its shelf is in the system with both prices already right. The
add skips any barcode the shop already stocks, so running it on a shop that
already has them changes nothing.

> **`firestore.indexes.json` was dead until now.** `firebase.json` had no
> `firestore.indexes` key, so `firebase deploy --only firestore:indexes` printed
> "deploying indexes…" and deployed nothing, silently. If a query starts failing
> with `failed-precondition`, check that key exists before anything else.
