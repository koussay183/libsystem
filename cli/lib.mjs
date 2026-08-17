#!/usr/bin/env node
/**
 * lib-manager admin CLI — runs on the owner's own PC, never in a browser.
 *
 * This is the whole back office: it creates a shop's account, moves its plan
 * dates around, and performs the one-time migration of the pre-SaaS data into
 * a shop of its own. It talks to Firebase with the Admin SDK, which bypasses
 * the security rules — so it is the only thing in this project that can write
 * across tenants, and the only reason it is safe is that it lives on one
 * machine behind one service-account key.
 *
 *   node cli/lib.mjs help
 *
 * Nothing here is imported by src/, so firebase-admin can never reach the
 * client bundle. It has its own package.json for the same reason: Netlify
 * installs the app's dependencies and never sees this folder.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// ---------------------------------------------------------------------------
// Terminal niceties. A back office used at 11pm should be readable.
// ---------------------------------------------------------------------------

const useColour = stdout.isTTY && !process.env.NO_COLOR
const paint = (code, s) => (useColour ? `[${code}m${s}[0m` : String(s))
const c = {
  bold: (s) => paint('1', s),
  dim: (s) => paint('2', s),
  red: (s) => paint('31', s),
  green: (s) => paint('32', s),
  yellow: (s) => paint('33', s),
  blue: (s) => paint('36', s),
}
const log = (...a) => console.log(...a)
const ok = (s) => log(`${c.green('✓')} ${s}`)
const warn = (s) => log(`${c.yellow('!')} ${s}`)

/** Ends the process with a message rather than a stack trace. */
function die(message, hint) {
  log(`${c.red('✗')} ${message}`)
  if (hint) log(`  ${c.dim(hint)}`)
  process.exit(1)
}

async function confirm(question) {
  if (flags.yes) return true
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = (await rl.question(`${c.yellow('?')} ${question} ${c.dim('(yes/no)')} `)).trim()
  rl.close()
  return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y'
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const command = argv[0] ?? 'help'
const positional = []
const flags = {}
for (let i = 1; i < argv.length; i += 1) {
  const a = argv[i]
  if (a.startsWith('--')) {
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) flags[key] = true
    else {
      flags[key] = next
      i += 1
    }
  } else positional.push(a)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Every collection a shop owns. Order matters only for readability. */
const SHOP_COLLECTIONS = [
  'products',
  'packs',
  'categories',
  'suppliers',
  'customers',
  'credit_entries',
  'sales',
  'purchases',
  'settings',
]

/**
 * What the legacy migration carries over, and what it deliberately leaves.
 *
 * The shop's catalogue is hours of a person's work with a scanner in their
 * hand: it moves. The transaction history is a handful of test tickets and the
 * owner asked for a clean start: it stays behind, in the root collections,
 * where it can still be read if anyone ever wants it.
 */
const MIGRATE_KEEP = ['products', 'packs', 'categories', 'suppliers', 'settings']
const MIGRATE_RESET_BALANCE = ['customers']
const MIGRATE_SKIP = ['sales', 'purchases', 'credit_entries']

/** Lifetime totals that only mean anything next to the tickets behind them. */
const PRODUCT_COUNTERS = [
  'soldQty',
  'soldRevenue',
  'soldCost',
  'boughtQty',
  'boughtCost',
  'lastSoldAt',
]

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

function credentialsPath() {
  if (flags.key) return flags.key
  const candidates = [
    join(HERE, 'service-account.json'),
    join(ROOT, 'service-account.json'),
  ]
  for (const p of candidates) if (existsSync(p)) return p
  return null
}

let _db = null
let _auth = null
let _admin = null

/**
 * Loaded on demand rather than at the top of the file: `help`, and every
 * "you forgot an argument" message, has to work before `npm install` has been
 * run in this folder.
 */
async function loadAdmin() {
  if (_admin) return _admin
  try {
    const [app, auth, firestore] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
      import('firebase-admin/firestore'),
    ])
    _admin = { ...app, getAuth: auth.getAuth, getFirestore: firestore.getFirestore }
    return _admin
  } catch {
    die(
      'firebase-admin is not installed.',
      'Run:  cd cli  &&  npm install',
    )
  }
}

async function connect() {
  if (_db) return { db: _db, auth: _auth }
  const path = credentialsPath()
  if (!path) {
    die(
      'No service-account key found.',
      'Firebase console → Project settings → Service accounts → Generate new private key,\n' +
        '  save it as cli/service-account.json (already gitignored), or pass --key <path>.',
    )
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    die(`Could not read ${path} as JSON.`)
  }
  if (!parsed.project_id) die(`${path} does not look like a service-account key.`)
  const admin = await loadAdmin()
  admin.initializeApp({ credential: admin.cert(parsed), projectId: parsed.project_id })
  _db = admin.getFirestore()
  _auth = admin.getAuth()
  log(c.dim(`· project ${parsed.project_id}`))
  return { db: _db, auth: _auth }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const fmtDate = (ms) =>
  ms ? new Date(ms).toISOString().slice(0, 10) : c.dim('—')

function planState(paidUntil) {
  if (!paidUntil) return c.red('no plan')
  const left = Math.ceil((paidUntil - Date.now()) / DAY_MS)
  if (left < 0) return c.red(`expired ${-left}d ago`)
  if (left <= 14) return c.yellow(`${left}d left`)
  return c.green(`${left}d left`)
}

/** Turns --days / --until into an absolute epoch-ms deadline. */
function deadlineFromFlags(base = Date.now()) {
  if (flags.until) {
    const t = Date.parse(`${flags.until}T23:59:59Z`)
    if (Number.isNaN(t)) die(`--until "${flags.until}" is not a date I can read (use YYYY-MM-DD).`)
    return t
  }
  if (flags.days) {
    const n = Number(flags.days)
    if (!Number.isFinite(n)) die(`--days "${flags.days}" is not a number.`)
    return base + Math.round(n * DAY_MS)
  }
  return null
}

/** Finds a shop by its id, or by the email of the account attached to it. */
async function resolveShop(target) {
  const { db, auth } = await connect()
  if (!target) die('Which shop? Give a shop id or the account email.')

  if (target.includes('@')) {
    let user
    try {
      user = await auth.getUserByEmail(target)
    } catch {
      die(`No account with the email ${target}.`, 'Run `shops:list` to see what exists.')
    }
    const shopId = user.customClaims?.shopId
    if (!shopId) {
      die(
        `${target} exists but is not attached to a shop.`,
        'Run `shops:repair --email ' + target + ' --shop <shopId>` to attach it.',
      )
    }
    const snap = await db.collection('shops').doc(shopId).get()
    return { shopId, user, doc: snap.exists ? snap.data() : null }
  }

  const snap = await db.collection('shops').doc(target).get()
  if (!snap.exists) die(`No shop with the id ${target}.`)
  const data = snap.data()
  let user = null
  if (data.uid) {
    try {
      user = await _auth.getUser(data.uid)
    } catch {
      user = null
    }
  }
  return { shopId: target, user, doc: data }
}

/**
 * Writes claims WITHOUT dropping the ones already there.
 *
 * setCustomUserClaims replaces the whole object, so reading first is the only
 * way an added claim does not silently delete shopId — which would lock the
 * shop out of its own data.
 */
async function mergeClaims(uid, patch) {
  const { auth } = await connect()
  const user = await auth.getUser(uid)
  const next = { ...(user.customClaims ?? {}), ...patch }
  const size = Buffer.byteLength(JSON.stringify(next), 'utf8')
  if (size > 900) {
    die(`Custom claims would be ${size} bytes; Firebase allows 1000.`)
  }
  await auth.setCustomUserClaims(uid, next)
  return next
}

/** Commits in chunks — Firestore refuses more than 500 writes in one batch. */
async function commitChunked(db, operations, label) {
  const CHUNK = 400
  let done = 0
  for (let i = 0; i < operations.length; i += CHUNK) {
    const batch = db.batch()
    for (const op of operations.slice(i, i + CHUNK)) op(batch)
    await batch.commit()
    done += Math.min(CHUNK, operations.length - i)
    if (operations.length > CHUNK) log(c.dim(`  ${label}: ${done}/${operations.length}`))
  }
  return done
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const commands = {}

commands['help'] = {
  blurb: 'Show this list',
  run() {
    log('')
    log(c.bold('  lib-manager admin'))
    log(c.dim('  node cli/lib.mjs <command> [options]'))
    log('')
    const width = Math.max(...Object.keys(commands).map((k) => k.length))
    for (const [name, def] of Object.entries(commands)) {
      log(`  ${c.blue(name.padEnd(width))}  ${def.blurb}`)
    }
    log('')
    log(c.bold('  Common options'))
    log(`  ${c.dim('--key <path>')}   service-account key (default cli/service-account.json)`)
    log(`  ${c.dim('--yes')}          do not ask for confirmation`)
    log(`  ${c.dim('--dry-run')}      say what would happen, change nothing`)
    log('')
    log(c.bold('  First run'))
    log(c.dim('  1. cd cli && npm install'))
    log(c.dim('  2. put the service-account key in cli/service-account.json'))
    log(c.dim('  3. node lib.mjs shops:create --email x@y.z --password ... --name "Librairie X" --days 365'))
    log('')
  },
}

commands['shops:create'] = {
  blurb: 'Create an account and its shop  --email --password --name [--days 365]',
  async run() {
    const { db, auth } = await connect()
    const email = flags.email
    const password = flags.password
    const name = flags.name
    if (!email || !password) die('Need --email and --password.')
    if (String(password).length < 6) die('Firebase requires a password of at least 6 characters.')
    if (!name) die('Need --name (what the shop is called, printed on its tickets).')

    const paidUntil = deadlineFromFlags() ?? Date.now() + 365 * DAY_MS

    // Reuse an existing account rather than failing: running this twice after a
    // half-finished first attempt is exactly what happens in practice.
    let user = null
    try {
      user = await auth.getUserByEmail(email)
      warn(`${email} already exists — attaching it instead of creating it.`)
      if (user.customClaims?.shopId) {
        die(
          `${email} is already attached to shop ${user.customClaims.shopId}.`,
          'Use `plan:set` to change its plan, or pick another email.',
        )
      }
    } catch (err) {
      if (err?.code && err.code !== 'auth/user-not-found') throw err
    }

    if (flags['dry-run']) {
      log(c.dim(`  would create ${email}, a shop named "${name}", plan until ${fmtDate(paidUntil)}`))
      return
    }

    if (!user) {
      user = await auth.createUser({ email, password, displayName: name })
      ok(`account created  ${c.dim(user.uid)}`)
    } else {
      await auth.updateUser(user.uid, { password, displayName: name })
      ok(`account password set  ${c.dim(user.uid)}`)
    }

    // The shop document first, so a failure here leaves an account with no
    // claim — harmless, it simply cannot sign in yet — rather than a claim
    // pointing at a shop that does not exist.
    const shopRef = db.collection('shops').doc()
    await shopRef.set({
      name,
      email,
      uid: user.uid,
      plan: flags.plan ?? 'standard',
      paidUntil,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    ok(`shop created  ${c.dim(shopRef.id)}`)

    await mergeClaims(user.uid, { shopId: shopRef.id, paidUntil })
    ok(`claims set  shopId=${shopRef.id}  paidUntil=${fmtDate(paidUntil)}`)

    log('')
    log(c.bold('  Hand these to the shop:'))
    log(`    email     ${email}`)
    log(`    password  ${password}`)
    log(`    shop id   ${shopRef.id}`)
    log('')
  },
}

commands['shops:list'] = {
  blurb: 'Every shop, its plan and how much of it is left',
  async run() {
    const { db } = await connect()
    const snap = await db.collection('shops').orderBy('createdAt').get()
    if (snap.empty) {
      warn('No shops yet. Create one with `shops:create`.')
      return
    }
    log('')
    for (const d of snap.docs) {
      const s = d.data()
      log(
        `  ${c.bold((s.name ?? '—').padEnd(24))} ${(s.email ?? '—').padEnd(28)} ` +
          `${fmtDate(s.paidUntil).padEnd(12)} ${planState(s.paidUntil).padEnd(20)} ${c.dim(d.id)}`,
      )
    }
    log('')
    log(c.dim(`  ${snap.size} shop(s)`))
    log('')
  },
}

commands['shops:show'] = {
  blurb: 'One shop in detail, with a document count  <email|shopId>',
  async run() {
    const { db } = await connect()
    const { shopId, user, doc } = await resolveShop(positional[0] ?? flags.email ?? flags.shop)
    log('')
    log(`  ${c.bold(doc?.name ?? '(no shop document)')}`)
    log(`  ${c.dim('shop id  ')} ${shopId}`)
    log(`  ${c.dim('email    ')} ${doc?.email ?? user?.email ?? '—'}`)
    log(`  ${c.dim('uid      ')} ${doc?.uid ?? user?.uid ?? '—'}`)
    log(`  ${c.dim('plan     ')} ${doc?.plan ?? '—'}`)
    log(`  ${c.dim('until    ')} ${fmtDate(doc?.paidUntil)}  ${planState(doc?.paidUntil)}`)
    if (user) {
      log(`  ${c.dim('claims   ')} ${JSON.stringify(user.customClaims ?? {})}`)
      log(`  ${c.dim('disabled ')} ${user.disabled ? c.red('yes') : 'no'}`)
    } else {
      warn('No auth account is attached to this shop.')
    }
    log('')
    for (const col of SHOP_COLLECTIONS) {
      const count = await db.collection('shops').doc(shopId).collection(col).count().get()
      log(`  ${col.padEnd(16)} ${String(count.data().count).padStart(6)}`)
    }
    log('')
  },
}

commands['plan:set'] = {
  blurb: 'Set the plan deadline  <email|shopId> --days N | --until YYYY-MM-DD [--plan name]',
  async run() {
    const { db } = await connect()
    const { shopId, user, doc } = await resolveShop(positional[0] ?? flags.email ?? flags.shop)
    const paidUntil = deadlineFromFlags()
    if (paidUntil === null && !flags.plan) die('Need --days, --until, or --plan.')

    const patch = { updatedAt: Date.now() }
    if (paidUntil !== null) patch.paidUntil = paidUntil
    if (flags.plan) patch.plan = flags.plan

    if (flags['dry-run']) {
      log(c.dim(`  would set ${JSON.stringify(patch)} on ${shopId}`))
      return
    }

    await db.collection('shops').doc(shopId).set(patch, { merge: true })
    if (paidUntil !== null) {
      if (!user) die('The shop document was updated, but no account is attached to carry the claim.')
      await mergeClaims(user.uid, { paidUntil })
    }
    ok(`${doc?.name ?? shopId}: ${flags.plan ? `plan ${flags.plan}, ` : ''}until ${fmtDate(paidUntil ?? doc?.paidUntil)}`)
    log(c.dim('  The shop picks this up within the hour, or at once if they reload.'))
  },
}

commands['plan:extend'] = {
  blurb: 'Add days to the plan, from today or from its end  <email|shopId> --days N',
  async run() {
    const { db } = await connect()
    const { shopId, user, doc } = await resolveShop(positional[0] ?? flags.email ?? flags.shop)
    const days = Number(flags.days)
    if (!Number.isFinite(days)) die('Need --days N.')
    // Extending an unexpired plan adds to its end; extending a lapsed one
    // starts from today, so nobody pays for the weeks they were locked out.
    const from = Math.max(Date.now(), doc?.paidUntil ?? 0)
    const paidUntil = from + Math.round(days * DAY_MS)

    if (flags['dry-run']) {
      log(c.dim(`  would move ${shopId} from ${fmtDate(doc?.paidUntil)} to ${fmtDate(paidUntil)}`))
      return
    }
    await db.collection('shops').doc(shopId).set({ paidUntil, updatedAt: Date.now() }, { merge: true })
    if (user) await mergeClaims(user.uid, { paidUntil })
    ok(`${doc?.name ?? shopId}: until ${fmtDate(paidUntil)}  ${planState(paidUntil)}`)
  },
}

commands['shops:suspend'] = {
  blurb: 'Stop a shop writing, now  <email|shopId>',
  async run() {
    const { db } = await connect()
    const { shopId, user, doc } = await resolveShop(positional[0] ?? flags.email ?? flags.shop)
    if (!(await confirm(`Suspend "${doc?.name ?? shopId}"? They keep read access and can still export.`))) {
      return
    }
    const paidUntil = Date.now() - 1000
    await db.collection('shops').doc(shopId).set({ paidUntil, updatedAt: Date.now() }, { merge: true })
    if (user) {
      await mergeClaims(user.uid, { paidUntil })
      // Rewriting a claim cannot invalidate the token that is already carrying
      // the old one, and that token is good for up to an hour. Revoking the
      // refresh token is what makes the suspension take effect on the next
      // reload instead of at the end of the hour.
      await _auth.revokeRefreshTokens(user.uid)
    }
    ok(`${doc?.name ?? shopId} suspended — writes stop, reading and backup still work.`)
    log(c.dim('  Takes effect on their next reload; the outstanding token expires within the hour.'))
  },
}

commands['shops:resume'] = {
  blurb: 'Let a suspended shop write again  <email|shopId> --days N',
  async run() {
    flags.days = flags.days ?? 30
    await commands['plan:extend'].run()
  },
}

commands['password:set'] = {
  blurb: 'Set an account password  --email --password',
  async run() {
    const { auth } = await connect()
    if (!flags.email || !flags.password) die('Need --email and --password.')
    if (String(flags.password).length < 6) die('At least 6 characters.')
    const user = await auth.getUserByEmail(flags.email).catch(() => die(`No account ${flags.email}.`))
    await auth.updateUser(user.uid, { password: flags.password })
    ok(`password set for ${flags.email}`)
  },
}

commands['shops:repair'] = {
  blurb: 'Attach an existing account to a shop  --email --shop <shopId>',
  async run() {
    const { db, auth } = await connect()
    if (!flags.email || !flags.shop) die('Need --email and --shop.')
    const user = await auth.getUserByEmail(flags.email).catch(() => die(`No account ${flags.email}.`))
    const snap = await db.collection('shops').doc(flags.shop).get()
    if (!snap.exists) die(`No shop ${flags.shop}.`)
    const paidUntil = snap.data().paidUntil ?? Date.now() + 30 * DAY_MS
    await mergeClaims(user.uid, { shopId: flags.shop, paidUntil })
    await db.collection('shops').doc(flags.shop).set(
      { uid: user.uid, email: flags.email, updatedAt: Date.now() },
      { merge: true },
    )
    ok(`${flags.email} → shop ${flags.shop}`)
  },
}

commands['migrate:legacy'] = {
  blurb: 'Move the pre-SaaS root collections into one shop  --shop <shopId> [--dry-run]',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>. Run `shops:list` to find it.')
    const shopSnap = await db.collection('shops').doc(shopId).get()
    if (!shopSnap.exists) die(`No shop ${shopId}. Create it first with shops:create.`)

    const dry = !!flags['dry-run']
    const keepHistory = !!flags['include-history']
    const keepCounters = !!flags['keep-counters']

    log('')
    log(c.bold(`  Migrating the root collections into shops/${shopId}`))
    log(c.dim(`  target: ${shopSnap.data().name ?? shopId}`))
    log('')

    // ---- read everything first, so nothing is written on a partial read ----
    const source = {}
    for (const col of SHOP_COLLECTIONS) {
      const snap = await db.collection(col).get()
      source[col] = snap.docs
      const verdict = MIGRATE_SKIP.includes(col) && !keepHistory ? c.dim('skipped') : c.green('copy')
      log(`  ${col.padEnd(16)} ${String(snap.size).padStart(6)}  ${verdict}`)
    }
    log('')

    const ops = []
    let copied = 0
    let counterResets = 0
    let balanceResets = 0

    for (const col of SHOP_COLLECTIONS) {
      const skip = MIGRATE_SKIP.includes(col) && !keepHistory
      if (skip) continue
      for (const d of source[col]) {
        const data = { ...d.data() }

        if (col === 'products' && !keepCounters && !keepHistory) {
          // The tickets these totals were added up from are not coming with
          // them. Left in place they would report revenue no sale can explain.
          let touched = false
          for (const field of PRODUCT_COUNTERS) {
            if (data[field] !== undefined) {
              delete data[field]
              touched = true
            }
          }
          if (touched) counterResets += 1
        }

        if (MIGRATE_RESET_BALANCE.includes(col) && !keepHistory) {
          // The ledger lines behind this balance are staying behind, so the
          // balance has to start at zero or the carnet shows a debt with no
          // history to explain or settle it.
          if (data.balance) balanceResets += 1
          data.balance = 0
        }

        // The SAME document id on the way in: that is what makes re-running
        // this safe, and what keeps every reference between documents
        // (customerId on a ledger line, productId in a pack) pointing at the
        // thing it always pointed at.
        const ref = db.collection('shops').doc(shopId).collection(col).doc(d.id)
        ops.push((batch) => batch.set(ref, data, { merge: true }))
        copied += 1
      }
    }

    log(`  ${c.bold(String(copied))} documents to write`)
    if (counterResets) log(`  ${counterResets} products will have their lifetime totals cleared`)
    if (balanceResets) log(`  ${balanceResets} customers will have their balance reset to 0`)
    log(c.dim('  Nothing is deleted from the root collections — they stay as the backup.'))
    log('')

    if (dry) {
      warn('Dry run. Nothing was written.')
      return
    }
    if (!(await confirm('Write these into the shop?'))) return

    const written = await commitChunked(db, ops, 'writing')
    ok(`${written} documents written into shops/${shopId}`)

    await db.collection('shops').doc(shopId).set(
      { migratedAt: Date.now(), migratedDocs: written, updatedAt: Date.now() },
      { merge: true },
    )
    log('')
    log(c.dim('  Re-runnable: the same ids are reused, so running it again just refreshes.'))
    log(c.dim('  Run it once more right before you deploy, to pick up anything added since.'))
    log('')
  },
}

commands['catalog:seed'] = {
  blurb: 'Publish a shop’s barcoded product NAMES into the shared catalogue  --shop <shopId>',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>.')
    const snap = await db.collection('shops').doc(shopId).collection('products').get()

    /**
     * The same key the app's catalogKey() uses, and for the same reasons:
     * 8-14 digits only, so it is always a legal Firestore document id; and
     * never a 2xxxxxxxxxxx code, because those are minted per shop by
     * generateInStoreCode and collide across tenants by construction.
     */
    const key = (v) => {
      const k = String(v ?? '').trim().replace(/[\s-]/g, '')
      if (!/^[0-9]{8,14}$/.test(k)) return null
      if (/^2[0-9]{12}$/.test(k)) return null
      return k
    }

    const ops = []
    let skipped = 0
    const seen = new Set()
    // Codes this shop itself cannot resolve: it sells two different articles
    // under one printed code, so it has no single name to contribute.
    const ambiguous = new Set()
    const counts = new Map()
    for (const d of snap.docs) {
      const k = key(d.data().barcode)
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    for (const [k, n] of counts) if (n > 1) ambiguous.add(k)

    for (const d of snap.docs) {
      const p = d.data()
      const code = key(p.barcode)
      if (!code || ambiguous.has(code)) {
        skipped += 1
        continue
      }
      if (seen.has(code)) continue
      seen.add(code)
      const name = String(p.name ?? '').trim()
      if (name === '' || name.length >= 80) {
        skipped += 1
        continue
      }
      const ref = db.collection('catalog').doc(code)
      /**
       * NAME AND UNIT ONLY. Deliberately no price and no category.
       *
       * A price would be actively harmful, not merely private: the receiving
       * shop derives its selling price from ITS OWN margin on the cost it
       * paid, and the till defaults an unknown cost to zero — so a borrowed
       * sale price with no cost behind it mints a 100%-margin phantom into
       * that shop's profit report. A category is a free-text key into the
       * CONTRIBUTING shop's own category list and means nothing elsewhere.
       */
      ops.push((batch) =>
        batch.set(
          ref,
          {
            name,
            unit: p.unit ?? null,
            by: shopId,
            confirms: 0,
            createdAt: Date.now(),
          },
          { merge: true },
        ),
      )
    }

    log(`  ${ops.length} catalogue entries from ${snap.size} products${skipped ? `, ${skipped} skipped (no usable code, shared code, or unusable name)` : ''}`)
    log(c.dim('  Names and units only — never a price, never a category.'))
    warn('The catalogue is not wired into the app yet. This only fills it.')
    if (flags['dry-run']) {
      warn('Dry run. Nothing was written.')
      return
    }
    if (!(await confirm('Publish these to the shared catalogue?'))) return
    const written = await commitChunked(db, ops, 'writing')
    ok(`${written} catalogue entries published`)
  },
}

commands['export-root'] = {
  blurb: 'Dump the pre-SaaS ROOT collections to a JSON file on this PC',
  async run() {
    const { db } = await connect()
    const out = {}
    let total = 0
    for (const col of SHOP_COLLECTIONS) {
      const snap = await db.collection(col).get()
      out[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      total += snap.size
      log(`  ${col.padEnd(16)} ${String(snap.size).padStart(6)}`)
    }
    const dir = join(ROOT, 'backups')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const file = join(dir, `root-${stamp}.json`)
    writeFileSync(
      file,
      JSON.stringify(
        { app: 'lib-manager', version: 1, source: 'root', exportedAt: new Date().toISOString(), collections: out },
        null,
        1,
      ),
    )
    ok(`${total} documents → ${file}`)
    log(c.dim('  Copy this off the machine before the cutover.'))
  },
}

commands['verify'] = {
  blurb: 'Prove a migration landed: counts, stock sum and a checksum  --shop <shopId>',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>.')

    /**
     * A checksum over the fields that would actually hurt to lose, not over
     * the whole document: ids and text can be eyeballed, but a barcode or a
     * price that changed in transit is invisible and expensive.
     */
    const fingerprint = (docs) =>
      docs
        .map((p) =>
          [p.barcode ?? '', p.name ?? '', p.quantity ?? 0, p.costPrice ?? 0, p.salePrice ?? 0].join('|'),
        )
        .sort()
        .join(String.fromCharCode(10))

    const hash = (text) => {
      // FNV-1a. Not cryptography — just a stable number two lists can be
      // compared by without printing thousands of lines.
      let h = 0x811c9dc5
      for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
      }
      return h.toString(16).padStart(8, '0')
    }

    let failures = 0
    log('')
    log(`  ${'collection'.padEnd(16)} ${'root'.padStart(7)} ${'shop'.padStart(7)}`)
    for (const col of SHOP_COLLECTIONS) {
      const rootSnap = await db.collection(col).get()
      const shopSnap = await db.collection('shops').doc(shopId).collection(col).get()
      const expected = MIGRATE_SKIP.includes(col) ? 0 : rootSnap.size
      const good = shopSnap.size === expected
      if (!good) failures += 1
      log(
        `  ${col.padEnd(16)} ${String(rootSnap.size).padStart(7)} ${String(shopSnap.size).padStart(7)}` +
          `  ${good ? c.green('ok') : c.red(`expected ${expected}`)}`,
      )

      if (col === 'products') {
        const rootDocs = rootSnap.docs.map((d) => d.data())
        const shopDocs = shopSnap.docs.map((d) => d.data())
        const sum = (docs) => docs.reduce((n, p) => n + (Number(p.quantity) || 0), 0)
        const rootSum = sum(rootDocs)
        const shopSum = sum(shopDocs)
        const rootHash = hash(fingerprint(rootDocs))
        const shopHash = hash(fingerprint(shopDocs))
        log('')
        log(`  stock on hand    root ${String(rootSum).padStart(7)}   shop ${String(shopSum).padStart(7)}  ${rootSum === shopSum ? c.green('ok') : c.red('MISMATCH')}`)
        log(`  catalogue hash   root ${rootHash}   shop ${shopHash}  ${rootHash === shopHash ? c.green('ok') : c.red('MISMATCH')}`)
        log('')
        if (rootSum !== shopSum) failures += 1
        if (rootHash !== shopHash) failures += 1
      }
    }

    log('')
    if (failures) {
      die(`${failures} check(s) failed — do NOT cut over.`)
    }
    ok('Every check passed. The catalogue in the shop is byte-identical to root.')
    log('')
  },
}

commands['stats'] = {
  blurb: 'Document counts per shop, and the shared catalogue',
  async run() {
    const { db } = await connect()
    const shops = await db.collection('shops').get()
    log('')
    let grand = 0
    for (const shop of shops.docs) {
      let total = 0
      for (const col of SHOP_COLLECTIONS) {
        const n = await db.collection('shops').doc(shop.id).collection(col).count().get()
        total += n.data().count
      }
      grand += total
      log(`  ${c.bold((shop.data().name ?? shop.id).padEnd(24))} ${String(total).padStart(7)} docs`)
    }
    const cat = await db.collection('catalog').count().get()
    log('')
    log(`  ${c.dim('shared catalogue')} ${String(cat.data().count).padStart(15)} entries`)
    log(`  ${c.dim('all shops')} ${String(grand).padStart(22)} docs`)
    log('')
    log(c.dim('  Free tier: 50k reads/day, 20k writes/day, 1 GiB stored.'))
    log('')
  },
}

commands['backup'] = {
  blurb: 'Write one shop to a JSON file on this PC  --shop <shopId>',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>.')
    const out = {}
    let total = 0
    for (const col of SHOP_COLLECTIONS) {
      const snap = await db.collection('shops').doc(shopId).collection(col).get()
      out[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      total += snap.size
      log(`  ${col.padEnd(16)} ${String(snap.size).padStart(6)}`)
    }
    const dir = join(ROOT, 'backups')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const file = join(dir, `${shopId}-${stamp}.json`)
    writeFileSync(
      file,
      JSON.stringify(
        { app: 'lib-manager', version: 1, shopId, exportedAt: new Date().toISOString(), collections: out },
        null,
        1,
      ),
    )
    ok(`${total} documents → ${file}`)
  },
}

// ---------------------------------------------------------------------------

const def = commands[command]
if (!def) {
  log(`${c.red('✗')} Unknown command "${command}".`)
  commands.help.run()
  process.exit(1)
}

try {
  await def.run()
} catch (err) {
  log('')
  die(err?.message ?? String(err), err?.code ? `code: ${err.code}` : undefined)
}
