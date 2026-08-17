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

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
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
/**
 * Flags that are a yes/no and therefore never eat the next argument.
 *
 * Without this list the parser gave every flag a value if one looked available,
 * so `shops:suspend --revoke librairie@x.tn` bound the EMAIL as the value of
 * --revoke, left nothing in `positional`, and the command died complaining it
 * did not know which shop to suspend. Putting the target first worked and
 * putting the flag first did not, which is the kind of difference nobody guesses
 * from an error message.
 *
 * Declared here rather than handled inside the one command that hit it, because
 * the next boolean flag anybody adds would arrive with the same bug already in
 * place.
 */
const BOOLEAN_FLAGS = new Set([
  'yes',
  'dry-run',
  'revoke',
  'include-history',
  'keep-counters',
  'clear',
  'cnp',
])

const flags = {}
for (let i = 1; i < argv.length; i += 1) {
  const a = argv[i]
  if (a.startsWith('--')) {
    const key = a.slice(2)
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) flags[key] = true
    else {
      flags[key] = next
      i += 1
    }
  } else positional.push(a)
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * MUST match graceMs() in firestore.rules.
 *
 * The rules let a shop write for this long after paidUntil, so that a till
 * which sold offline across its own expiry does not have its whole queue
 * refused and rolled back on reconnect. Two consequences the back office has
 * to respect:
 *   · every plan is effectively this much longer than the date it prints;
 *   · suspending a shop must push paidUntil back PAST this window, or the
 *     suspension does nothing for a fortnight.
 */
const RULES_GRACE_MS = 14 * DAY_MS

/**
 * The id a barcode gets in the shared catalogue.
 *
 * MUST STAY IN STEP WITH catalogKey() IN src/features/stock/barcode.ts — the app
 * looks entries up by exactly this id, so a disagreement between these two
 * functions does not raise an error anywhere, it just silently stops finding
 * things. The full reasoning lives in that file; the rules, briefly:
 *
 *  · 8 to 14 digits, which covers EAN-8, UPC-A, EAN-13 and ITF-14 — every code a
 *    real supplier prints — and is always a legal Firestore document id.
 *  · never a code in the GS1 in-store range (leading 2), because those are minted
 *    per shop against one shop's own stock and collide across tenants by
 *    construction. At fourteen digits the leading digit is an ITF-14 packaging
 *    indicator rather than a prefix, so the GTIN inside is what is judged.
 *  · six-digit CNP school-book numbers get the `cnp-` namespace. They are a
 *    national standard, so they are curated here and never contributed by a shop
 *    — see contributableId.
 */
function catalogId(v) {
  const k = String(v ?? '')
    .trim()
    .replace(/[\s-]/g, '')
  if (/^[0-9]{6}$/.test(k)) return `cnp-${k}`
  // Already namespaced: a contribution document id round-tripping through here.
  if (/^cnp-[0-9]{6}$/.test(k)) return k
  return contributableId(k)
}

/** The subset a SHOP may publish: real manufacturers' barcodes only. */
function contributableId(v) {
  const k = String(v ?? '')
    .trim()
    .replace(/[\s-]/g, '')
  if (!/^[0-9]{8,14}$/.test(k)) return null
  if (k.length !== 14 && k.startsWith('2')) return null
  if (k.length === 14 && k.slice(1).startsWith('2')) return null
  return k
}

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
    _admin = {
      ...app,
      getAuth: auth.getAuth,
      getFirestore: firestore.getFirestore,
      // The catalogue commands need increment() and delete() sentinels: a
      // confirmation count has to go up without reading it first, or two shops
      // seeded in the same minute each write the value they read and one of the
      // two confirmations is lost.
      FieldValue: firestore.FieldValue,
    }
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
  blurb: 'Stop a shop writing, now  <email|shopId> [--revoke]',
  async run() {
    const { db } = await connect()
    const { shopId, user, doc } = await resolveShop(positional[0] ?? flags.email ?? flags.shop)

    /**
     * Revoking the refresh token is OPT-IN, and must stay that way.
     *
     * This command's usual reason is a late invoice, and the shop it is aimed at
     * spends days at a time with no line. Revocation makes that till's next
     * refresh fail permanently: onIdTokenChanged fires null, AuthContext clears
     * the uid and the shopId, and the operator is dropped on /login — where
     * signing in requires the network, which is the one thing he does not have.
     * Every ticket queued during the outage is refused in the same instant, by
     * the sign-out branch rather than by logout(), so nothing has deliberately
     * preserved or wiped the write queue. A suspension for money owed must never
     * be able to destroy takings the shop has already collected.
     *
     * The price of not revoking is that the token the shop already holds keeps
     * satisfying paid() until it expires, up to an hour. An extra hour of writes
     * from a shop that has not paid is a rounding error; a fortnight of lost
     * sales is not. --revoke remains for the case that genuinely needs it — a
     * compromised account, where locking it out is worth more than its data.
     */
    const revoke = Boolean(flags.revoke)

    const question = revoke
      ? `Suspend "${doc?.name ?? shopId}" AND revoke its session? Signs the till out at once; ` +
        'if it is offline it cannot sign back in, and anything it queued is lost.'
      : `Suspend "${doc?.name ?? shopId}"? They keep read access and can still export.`
    if (!(await confirm(question))) {
      return
    }

    // Past the rules grace window, not merely into the past. paidUntil - 1s
    // would leave the shop writing for another fourteen days.
    const paidUntil = Date.now() - RULES_GRACE_MS - DAY_MS
    await db
      .collection('shops')
      .doc(shopId)
      .set(
        {
          paidUntil,
          updatedAt: Date.now(),
          // Recorded because revocation is the one thing shops:resume CANNOT
          // undo, and without a note of it the operator resumes a shop, is told
          // it is fine, and the shop is still sitting on a login screen. There
          // is no un-revoke in the Admin SDK: the shop has to sign in again.
          ...(revoke ? { revokedAt: Date.now() } : {}),
        },
        { merge: true },
      )
    if (user) {
      await mergeClaims(user.uid, { paidUntil })
      if (revoke) await _auth.revokeRefreshTokens(user.uid)
    }
    ok(`${doc?.name ?? shopId} suspended — writes stop, reading and backup still work.`)
    if (revoke) {
      log(c.dim('  Session revoked: the shop is signed out on its next token refresh.'))
      warn('If that till is offline right now it lands on the login screen when it comes back,')
      log(c.dim('  and it cannot get past it without a connection. Its unsent sales go with it.'))
    } else {
      log(c.dim('  The claim is written, but the token they already hold keeps working until it'))
      log(c.dim('  expires — up to an hour. That hour is the deliberate price of not stranding a'))
      log(c.dim('  till that is offline: revoking would drop it on a login screen it cannot pass'))
      log(c.dim('  without a line, taking its queued sales with it. Use --revoke only for a'))
      log(c.dim('  compromised account.'))
    }
  },
}

commands['shops:resume'] = {
  blurb: 'Let a suspended shop write again  <email|shopId> --days N',
  async run() {
    flags.days = flags.days ?? 30

    /**
     * Extending the plan is all a resume normally is — but if the suspension
     * revoked the session, that half does not come back with it.
     *
     * revokeRefreshTokens has no inverse. The shop's stored credential is dead,
     * so however much plan it now has, its till stays on the login screen until
     * somebody signs in on it WITH A WORKING CONNECTION. An operator who does
     * not know that tells the shop it is sorted and then cannot explain why it
     * is not, which is exactly the call this warning exists to prevent.
     */
    const target = positional[0] ?? flags.email ?? flags.shop
    if (target) {
      try {
        const { doc } = await resolveShop(target)
        if (doc?.revokedAt) {
          warn(`This shop's session was revoked on ${fmtDate(doc.revokedAt)} and that cannot be`)
          log(c.dim('  undone here. Extending the plan is not enough: somebody has to sign in on'))
          log(c.dim('  the till itself, and that needs a connection. Have the password ready —'))
          log(c.dim('  `password:set` if it is lost — and do it while the shop has a line.'))
          log('')
        }
      } catch {
        // Let plan:extend produce the real error about an unknown shop; this
        // check is advisory and must never be the thing that fails the command.
      }
    }

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
  blurb:
    'Publish a shop’s product NAMES into the shared catalogue  --shop <shopId> [--cnp] [--dry-run]',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>.')
    const snap = await db.collection('shops').doc(shopId).collection('products').get()

    // @see catalogId — the same rule as the app's catalogKey().
    const key = (v) => (flags.cnp ? catalogId(v) : contributableId(v))

    const candidates = []
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
      candidates.push({ code, name, unit: p.unit ?? null })
    }

    log(
      `  ${candidates.length} candidates from ${snap.size} products${skipped ? `, ${skipped} skipped (no usable code, shared code, or unusable name)` : ''}`,
    )
    log(c.dim('  Names and units only — never a price, never a category.'))

    const plan = await planPromotion(db, candidates, shopId)
    describePromotion(plan)
    if (flags['dry-run']) {
      warn('Dry run. Nothing was written.')
      return
    }
    if (plan.ops.length === 0) return
    if (!(await confirm('Publish these to the shared catalogue?'))) return
    const written = await commitChunked(db, plan.ops, 'writing')
    ok(`${written} catalogue entries written`)
  },
}

/**
 * Works out what publishing these codes would actually change, WITHOUT
 * destroying what is already there.
 *
 * THIS IS THE FIX FOR THE BUG THAT MADE `confirms` MEANINGLESS. The seed used to
 * `set(..., { merge: true })` with `confirms: 0`, `createdAt: Date.now()`, `by`
 * and `name` all in the payload — so running it for a second shop overwrote the
 * first shop's name, moved createdAt forward, reassigned `by`, and reset any
 * accumulated confirmations to zero. Admin SDK, so no rule could have stopped
 * it. It never mattered while nothing read the collection; it matters now.
 *
 * THE FIRST WRITER IS AUTHORITATIVE, and the rest is evidence:
 *
 *  · absent      -> create it, with provenance and confirms 0.
 *  · same name   -> another shop independently agrees. Increment confirms and
 *                   touch NOTHING else. This is the only thing that makes a
 *                   confirmation count mean anything at all.
 *  · other name  -> do NOT overwrite. Record the disagreement under `alts`, with
 *                   a count, and leave the published name alone. A shop calling
 *                   9782070408504 "Petit Prince poche" is not evidence that
 *                   "Le Petit Prince" is wrong, and the last run of a command
 *                   is the worst possible tiebreaker. `catalog:fix` is how a
 *                   human settles it, once, on purpose.
 *
 * Names are compared case- and space-insensitively, because "CAHIER 96P" and
 * "Cahier 96p" are the same shop agreeing with itself in a different mood.
 */
async function planPromotion(db, candidates, by) {
  const { FieldValue } = await loadAdmin()
  const plan = { ops: [], created: 0, confirmed: 0, disputed: [], unchanged: 0 }
  if (candidates.length === 0) return plan

  const fold = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  // getAll takes a bounded number of refs, so the reads are chunked exactly as
  // the writes are.
  const READ_CHUNK = 300
  for (let i = 0; i < candidates.length; i += READ_CHUNK) {
    const slice = candidates.slice(i, i + READ_CHUNK)
    const refs = slice.map((c) => db.collection('catalog').doc(c.code))
    const snaps = await db.getAll(...refs)

    for (let j = 0; j < slice.length; j += 1) {
      const c = slice[j]
      const snap = snaps[j]
      const ref = refs[j]

      if (!snap.exists) {
        plan.created += 1
        plan.ops.push((batch) =>
          batch.set(ref, {
            name: c.name,
            unit: c.unit,
            by,
            confirms: 0,
            createdAt: Date.now(),
          }),
        )
        continue
      }

      const current = snap.data() ?? {}
      if (fold(current.name) === fold(c.name)) {
        plan.confirmed += 1
        plan.ops.push((batch) =>
          batch.set(
            ref,
            {
              confirms: FieldValue.increment(1),
              // Filled in only if the first writer had none. A unit is a fact
              // about the article, not an opinion about it.
              ...(current.unit == null && c.unit != null ? { unit: c.unit } : {}),
            },
            { merge: true },
          ),
        )
        continue
      }

      plan.disputed.push({ code: c.code, published: current.name, offered: c.name })
      plan.ops.push((batch) =>
        batch.set(
          ref,
          { alts: { [fold(c.name)]: FieldValue.increment(1) } },
          { merge: true },
        ),
      )
    }
  }
  return plan
}

/** Says what planPromotion() found, in the CLI's own voice. */
function describePromotion(plan) {
  log('')
  log(`  ${String(plan.created).padStart(5)} new entries`)
  log(`  ${String(plan.confirmed).padStart(5)} confirmed (another shop agrees with the published name)`)
  log(`  ${String(plan.disputed.length).padStart(5)} disagree with the published name — kept, recorded under alts`)
  if (plan.disputed.length > 0) {
    log('')
    for (const d of plan.disputed.slice(0, 12)) {
      log(c.dim(`    ${d.code}  published "${d.published}"  offered "${d.offered}"`))
    }
    if (plan.disputed.length > 12) log(c.dim(`    … and ${plan.disputed.length - 12} more`))
    log(c.dim('  Settle any of these with `catalog:fix <code> --name "..."`.'))
  }
  log('')
}

commands['catalog:harvest'] = {
  blurb: 'Promote what shops offered into the shared catalogue  [--shop <shopId>] [--clear]',
  async run() {
    const { db } = await connect()

    /**
     * Shops never write to /catalog. They write into their own subtree, at
     * shops/{shopId}/catalog_contributions/{code}, which the tenant rules
     * already cover — and this is what moves those offers into the shared
     * collection with the Admin SDK.
     *
     * That indirection is the whole security design of the feature. There is no
     * client-writable root collection, so there is nothing to flood with junk,
     * nothing to poison with a deliberately wrong name, and no per-account
     * bookkeeping to invent to make `confirms` trustworthy. The cost is that a
     * name entered today reaches other shops when this is next run, which is a
     * price worth paying and not much of one: the value is that the names exist
     * at all, not that they arrive within the minute.
     */
    const only = flags.shop
    const shops = only
      ? [(await resolveShop(only)).shopId]
      : (await db.collection('shops').get()).docs.map((d) => d.id)

    let offered = 0
    const perShop = []
    for (const shopId of shops) {
      const snap = await db
        .collection('shops')
        .doc(shopId)
        .collection('catalog_contributions')
        .get()
      if (snap.empty) continue
      const candidates = []
      for (const d of snap.docs) {
        const name = String(d.data().name ?? '').trim()
        // The document id IS the code, written by the client through
        // contributableKey(), but it is re-checked here rather than trusted: it
        // arrived from a browser, and this is the step that puts it in front of
        // every other shop.
        const code = catalogId(d.id)
        if (!code || name === '' || name.length >= 80) continue
        candidates.push({ code, name, unit: d.data().unit ?? null })
      }
      offered += candidates.length
      perShop.push({ shopId, candidates, refs: snap.docs.map((d) => d.ref) })
      log(`  ${shopId.padEnd(24)} ${String(candidates.length).padStart(5)} offered`)
    }

    if (offered === 0) {
      warn('Nothing offered. Shops contribute when they create a barcoded product.')
      return
    }

    let created = 0
    let confirmed = 0
    let disputed = 0
    for (const entry of perShop) {
      const plan = await planPromotion(db, entry.candidates, entry.shopId)
      created += plan.created
      confirmed += plan.confirmed
      disputed += plan.disputed.length
      describePromotion(plan)
      if (flags['dry-run'] || plan.ops.length === 0) continue
      await commitChunked(db, plan.ops, `writing ${entry.shopId}`)

      /**
       * --clear is opt-in, and the default of KEEPING the contributions is the
       * safer one. A contribution left in place is re-offered on the next
       * harvest, where it either agrees with the published name (and adds another
       * confirmation, which is harmless and mildly useful) or shows up as the
       * same disagreement again — a standing reminder that somebody should look
       * at it. Deleted, a disagreement is gone and nobody ever settles it.
       */
      if (flags.clear) {
        await commitChunked(
          db,
          entry.refs.map((ref) => (batch) => batch.delete(ref)),
          `clearing ${entry.shopId}`,
        )
      }
    }

    if (flags['dry-run']) {
      warn('Dry run. Nothing was written.')
      return
    }
    ok(`harvest: ${created} new, ${confirmed} confirmed, ${disputed} disputed`)
    if (!flags.clear) log(c.dim('  Contributions kept. Pass --clear to empty them after a harvest.'))
  },
}

commands['catalog:fix'] = {
  blurb: 'Settle a catalogue entry by hand  <code> --name "..."  [--unit ...]',
  async run() {
    const { db } = await connect()
    const code = catalogId(positional[0])
    if (!code) die('Need a valid catalogue code.', 'Eight to fourteen digits, or a six-digit CNP.')
    const name = flags.name
    if (!name) die('Need --name "the correct name".')
    if (String(name).length >= 80) die('That name is too long for a catalogue entry (80 max).')

    const { FieldValue } = await loadAdmin()
    const ref = db.collection('catalog').doc(code)
    const snap = await ref.get()
    if (snap.exists) {
      const d = snap.data()
      log(`  ${code} is currently "${d.name}"  (by ${d.by ?? '?'}, ${d.confirms ?? 0} confirms)`)
      if (d.alts) log(c.dim(`  alternatives offered: ${Object.keys(d.alts).join(' | ')}`))
    } else {
      log(`  ${code} does not exist yet — this creates it.`)
    }
    if (!(await confirm(`Set ${code} to "${name}"?`))) return

    /**
     * `fixedAt` is what stops a harvest quietly undoing this. A hand-settled
     * name is a decision, and the next shop that offers a different one must not
     * be able to overturn it by running a command — planPromotion never
     * overwrites a published name anyway, but recording the decision is what
     * makes it auditable a year from now.
     */
    await ref.set(
      {
        name: String(name),
        ...(flags.unit ? { unit: String(flags.unit) } : {}),
        fixedAt: Date.now(),
        alts: FieldValue.delete(),
      },
      { merge: true },
    )
    ok(`${code} = "${name}"`)
  },
}

commands['catalog:purge'] = {
  blurb: 'Remove a catalogue entry entirely  <code>',
  async run() {
    const { db } = await connect()
    const code = catalogId(positional[0])
    if (!code) die('Need a valid catalogue code.')
    const ref = db.collection('catalog').doc(code)
    const snap = await ref.get()
    if (!snap.exists) {
      warn(`${code} is not in the catalogue.`)
      return
    }
    log(`  ${code} = "${snap.data().name}"`)
    // The remedy of last resort. Because clients cannot write to /catalog there
    // is no flood to clean up, but a name can still be wrong, offensive, or
    // carry something a shop did not mean to publish — and until this existed
    // the only cure was a hand-written script against the admin key.
    if (!(await confirm(`Delete ${code} from the shared catalogue?`))) return
    await ref.delete()
    ok(`${code} removed`)
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

// ---------------------------------------------------------------------------
// Moving a shop between Firebase projects
// ---------------------------------------------------------------------------
//
// `migrate:legacy` copies root -> shops/{id}/... inside ONE project. When the
// SaaS moves to a project of its own, that is no longer the shape of the job:
// the catalogue has to cross a project boundary. These two commands are that
// crossing, and they are deliberately two commands rather than one — a pull
// that lands on disk is a thing you can inspect, diff and keep, where a direct
// project-to-project pipe is a thing you can only watch fail.

/**
 * Firestore's REST API answers with tagged values — {"integerValue":"100"},
 * not 100. Decoding it is not cosmetic:
 *
 *   integerValue arrives as a STRING. Every price in this app is an integer
 *   number of millimes and every stock level is an integer, so handing the
 *   tagged value straight to Firestore would write quantity:"100" — a string
 *   that renders identically in the UI, sorts wrongly, fails every arithmetic
 *   comparison, and turns `quantity <= lowStockThreshold` into nonsense. It is
 *   the one fault in this whole operation that would survive a visual check.
 */
function decodeRest(value) {
  if (value === null || typeof value !== 'object') return null
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) {
    // Can legitimately arrive as the strings "NaN" / "Infinity".
    const n = Number(value.doubleValue)
    return Number.isFinite(n) ? n : 0
  }
  if ('timestampValue' in value) return new Date(value.timestampValue).getTime()
  if ('bytesValue' in value) return value.bytesValue
  if ('referenceValue' in value) return value.referenceValue
  if ('geoPointValue' in value) return value.geoPointValue
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeRest)
  if ('mapValue' in value) {
    const out = {}
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) out[k] = decodeRest(v)
    return out
  }
  return null
}

/** Reads a VITE_-style env file into a plain object. */
function readEnvFile(path) {
  if (!existsSync(path)) return null
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (t === '' || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    out[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * The most recent export in backups/, so --file can usually be left off.
 *
 * By MODIFIED TIME, not by name. The files in there do not share a prefix —
 * legacy-*, live-*, root-*, and one per shop id — so sorting by filename puts
 * "live-2026-08-17" after "legacy-2026-08-20" and would hand back a stale
 * export, or one of a different shape, with nothing on screen to say so. The
 * caller prints whichever file this returns for the same reason.
 */
function newestBackup() {
  const dir = join(ROOT, 'backups')
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(dir, f)
      return { path, at: statSync(path).mtimeMs }
    })
    .sort((a, b) => a.at - b.at)
  return files.length ? files[files.length - 1].path : null
}

commands['pull:legacy'] = {
  blurb: 'Read the OLD project out to a file over REST, no key needed  [--project --api-key]',
  async run() {
    /**
     * No Admin SDK, and no service-account key for the old project.
     *
     * That is not a shortcut, it is the point: the pre-SaaS project still
     * carries `allow read, write: if true`, so its public web API key — the one
     * that has been shipping inside the shop's app bundle all along — is
     * already enough to read every document. Asking for a second private key
     * to a project we are walking away from would put another credential on
     * this machine and buy nothing.
     *
     * It also means this works when you no longer have console access to that
     * project, only the config the app was built with.
     */
    /**
     * bail() rather than die(), for this command only.
     *
     * die() ends the process with process.exit(). On Windows, exiting while
     * fetch's keep-alive socket is still pooled trips a libuv assertion, so the
     * clear error message gets followed by
     *
     *   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\\win\\async.c
     *
     * Nothing has actually gone wrong when that prints, but an operator reading
     * it has no way to know that, and a back office that looks like it crashed
     * is a back office nobody trusts. Setting exitCode and letting the process
     * end on its own gives the same exit status and a clean screen. It is local
     * to this command because it is the only one that makes an HTTP request.
     */
    const bail = (message, hint) => {
      log(`${c.red('✗')} ${message}`)
      if (hint) log(`  ${c.dim(hint)}`)
      process.exitCode = 1
    }

    const env = readEnvFile(join(ROOT, '.env.legacy')) ?? readEnvFile(join(ROOT, '.env.local'))
    const project = flags.project ?? env?.VITE_FIREBASE_PROJECT_ID
    const apiKey = flags['api-key'] ?? env?.VITE_FIREBASE_API_KEY
    if (!project || !apiKey) {
      return bail(
        'Need the OLD project id and its web API key.',
        'They are the pre-SaaS values in .env.legacy, or pass --project <id> --api-key <key>.',
      )
    }

    log('')
    log(c.bold(`  Reading project ${project} over REST`))
    log(c.dim('  Read-only. Nothing in that project is written to or deleted.'))
    log('')

    const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`
    const out = {}
    let total = 0

    for (const col of SHOP_COLLECTIONS) {
      const docs = []
      let token = ''
      for (;;) {
        const url =
          `${base}/${col}?pageSize=300` +
          (token ? `&pageToken=${encodeURIComponent(token)}` : '') +
          `&key=${apiKey}`
        const res = await fetch(url)
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          if (res.status === 401 || res.status === 403) {
            return bail(
              `${col}: ${res.status} from ${project}.`,
              'That project no longer has permissive rules, or the API key is wrong. ' +
                'Use the key from the bundle the shop is actually running.',
            )
          }
          return bail(`${col}: ${res.status} ${res.statusText}`, body.slice(0, 300))
        }
        const page = await res.json()
        for (const d of page.documents ?? []) {
          const fields = {}
          for (const [k, v] of Object.entries(d.fields ?? {})) fields[k] = decodeRest(v)
          // The document id is the last path segment, and it is what every
          // cross-reference in this data points at.
          docs.push({ id: d.name.slice(d.name.lastIndexOf('/') + 1), ...fields })
        }
        if (!page.nextPageToken) break
        token = page.nextPageToken
      }
      out[col] = docs
      total += docs.length
      log(`  ${col.padEnd(16)} ${String(docs.length).padStart(6)}`)
    }

    if (total === 0) {
      return bail(
        'That project answered, but every collection came back empty.',
        'Wrong project id? The shop data is not where this is looking.',
      )
    }

    const dir = join(ROOT, 'backups')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const file = join(dir, `legacy-${project}-${stamp}.json`)
    writeFileSync(
      file,
      JSON.stringify(
        {
          app: 'lib-manager',
          version: 1,
          source: 'legacy-rest',
          project,
          exportedAt: new Date().toISOString(),
          collections: out,
        },
        null,
        1,
      ),
    )
    log('')
    ok(`${total} documents -> ${file}`)
    log(c.dim('  Next: import:file --shop <shopId> --file <this file>'))
    log(c.dim('  Then:  verify      --shop <shopId> --file <this file>'))
    log('')
  },
}

commands['import:file'] = {
  blurb: 'Write a pulled file into a shop in THIS project  --shop <shopId> [--file <path>]',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>. Run `shops:list` to find it.')
    const shopSnap = await db.collection('shops').doc(shopId).get()
    if (!shopSnap.exists) die(`No shop ${shopId} in this project. Create it first with shops:create.`)

    const file = flags.file ?? newestBackup()
    if (!file) die('No --file given and nothing in backups/.', 'Run pull:legacy first.')
    if (!existsSync(file)) die(`No such file: ${file}`)

    let parsed
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      die(`${file} is not readable JSON.`, String(err?.message ?? err))
    }
    const source = parsed.collections ?? parsed
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      die(`${file} does not look like a lib-manager export.`)
    }

    const dry = !!flags['dry-run']
    const keepHistory = !!flags['include-history']
    const keepCounters = !!flags['keep-counters']

    log('')
    log(c.bold(`  ${file}`))
    log(c.dim(`  -> shops/${shopId}  (${shopSnap.data().name ?? shopId})`))
    if (parsed.project) {
      log(c.dim(`  pulled from project ${parsed.project} at ${parsed.exportedAt ?? '?'}`))
    }
    log('')

    const unknown = Object.keys(source).filter((k) => !SHOP_COLLECTIONS.includes(k))
    const ops = []
    let copied = 0
    let counterResets = 0
    let balanceResets = 0

    for (const col of SHOP_COLLECTIONS) {
      const docs = Array.isArray(source[col]) ? source[col] : []
      const skip = MIGRATE_SKIP.includes(col) && !keepHistory
      log(
        `  ${col.padEnd(16)} ${String(docs.length).padStart(6)}  ` +
          (skip ? c.dim('skipped') : c.green('copy')),
      )
      if (skip) continue

      for (const raw of docs) {
        if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || raw.id === '') {
          die(
            `${col}: a document in the file has no usable id.`,
            'The export is malformed — re-run pull:legacy.',
          )
        }
        /**
         * `id` comes OUT of the body. The export keeps it inside the document
         * for readability, but liveCollection builds objects as
         * `{ id: d.id, ...d.data() }` — the spread lands last, so an `id` field
         * inside the document silently overrides the real document id. Today
         * they agree; the moment anyone hand-edits an export they stop
         * agreeing, and then every productId in a pack and every customerId on
         * a ledger line resolves against the wrong document.
         */
        const { id, ...data } = raw

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

        const ref = db.collection('shops').doc(shopId).collection(col).doc(id)
        ops.push((batch) => batch.set(ref, data, { merge: true }))
        copied += 1
      }
    }

    log('')
    if (unknown.length) warn(`ignored unknown collection(s) in the file: ${unknown.join(', ')}`)
    log(`  ${c.bold(String(copied))} documents to write`)
    if (counterResets) log(`  ${counterResets} products will have their lifetime totals cleared`)
    if (balanceResets) log(`  ${balanceResets} customers will have their balance reset to 0`)
    log(c.dim('  The file is not modified. The old project is not touched at all.'))
    log('')

    if (copied === 0) {
      die('Nothing to write.', 'Every collection in that file is empty or skipped.')
    }
    if (dry) {
      warn('Dry run. Nothing was written.')
      return
    }
    if (!(await confirm(`Write ${copied} documents into shops/${shopId}?`))) return

    const written = await commitChunked(db, ops, 'writing')
    ok(`${written} documents written into shops/${shopId}`)

    await db
      .collection('shops')
      .doc(shopId)
      .set(
        {
          migratedAt: Date.now(),
          migratedDocs: written,
          importedFrom: parsed.project ?? 'file',
          importedAt: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true },
      )
    log('')
    log(c.dim('  Re-runnable: the same ids are reused, so running it again just refreshes.'))
    log(c.dim(`  Now prove it: verify --shop ${shopId} --file "${file}"`))
    log('')
  },
}

commands['verify'] = {
  blurb: 'Prove a migration landed: counts, stock sum, checksum  --shop <shopId> [--file <path>]',
  async run() {
    const { db } = await connect()
    const shopId = flags.shop ?? positional[0]
    if (!shopId) die('Need --shop <shopId>.')

    /**
     * What is being compared against.
     *
     * `--file` exists because after a move between projects there is no root
     * collection left to compare against — the truth about what the shop used
     * to hold lives in the pull, on disk. Without it, "verify" in a fresh
     * project would be comparing the shop against nothing and reporting that
     * nothing is missing.
     */
    const file = flags.file ? String(flags.file) : null
    let source = {}
    let label = 'root'

    if (file) {
      if (!existsSync(file)) die(`No such file: ${file}`)
      let parsed
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'))
      } catch (err) {
        die(`${file} is not readable JSON.`, String(err?.message ?? err))
      }
      const cols = parsed.collections ?? parsed
      for (const col of SHOP_COLLECTIONS) source[col] = Array.isArray(cols[col]) ? cols[col] : []
      label = 'file'
      log('')
      log(c.dim(`  against ${file}`))
    } else {
      for (const col of SHOP_COLLECTIONS) {
        const snap = await db.collection(col).get()
        source[col] = snap.docs.map((d) => d.data())
      }
      const anything = SHOP_COLLECTIONS.reduce((n, col) => n + source[col].length, 0)
      if (anything === 0) {
        die(
          'Every root collection in this project is empty, so there is nothing to verify against.',
          'Moving between projects? Pass --file <the pull:legacy export> instead.',
        )
      }
    }

    /**
     * A checksum over the fields that would actually hurt to lose, not over the
     * whole document: ids and text can be eyeballed, but a barcode or a price
     * that changed in transit is invisible and expensive.
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
    log(`  ${'collection'.padEnd(16)} ${label.padStart(7)} ${'shop'.padStart(7)}`)
    for (const col of SHOP_COLLECTIONS) {
      const sourceDocs = source[col]
      const shopSnap = await db.collection('shops').doc(shopId).collection(col).get()
      const expected = MIGRATE_SKIP.includes(col) ? 0 : sourceDocs.length
      const good = shopSnap.size === expected
      if (!good) failures += 1
      log(
        `  ${col.padEnd(16)} ${String(sourceDocs.length).padStart(7)} ${String(shopSnap.size).padStart(7)}` +
          `  ${good ? c.green('ok') : c.red(`expected ${expected}`)}`,
      )

      if (col === 'products') {
        const shopDocs = shopSnap.docs.map((d) => d.data())
        const sum = (docs) => docs.reduce((n, p) => n + (Number(p.quantity) || 0), 0)
        const sourceSum = sum(sourceDocs)
        const shopSum = sum(shopDocs)
        const sourceHash = hash(fingerprint(sourceDocs))
        const shopHash = hash(fingerprint(shopDocs))

        /**
         * The one fault that survives a visual check.
         *
         * Firestore's REST API returns integers as STRINGS. A price or a stock
         * level that arrived as "100" instead of 100 renders identically
         * everywhere in the app, and then sorts wrongly, fails every
         * comparison, and makes `quantity <= lowStockThreshold` meaningless.
         * Nobody would ever spot it by looking, so it is checked by type.
         */
        const NUMERIC = ['quantity', 'costPrice', 'salePrice', 'costPriceHT', 'vatRate', 'lowStockThreshold']
        const mistyped = []
        for (const d of shopSnap.docs) {
          const data = d.data()
          for (const field of NUMERIC) {
            if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'number') {
              mistyped.push(`${d.id}.${field} = ${JSON.stringify(data[field])}`)
            }
          }
        }

        log('')
        log(
          `  stock on hand    ${label} ${String(sourceSum).padStart(7)}   shop ${String(shopSum).padStart(7)}` +
            `  ${sourceSum === shopSum ? c.green('ok') : c.red('MISMATCH')}`,
        )
        log(
          `  catalogue hash   ${label} ${sourceHash}   shop ${shopHash}` +
            `  ${sourceHash === shopHash ? c.green('ok') : c.red('MISMATCH')}`,
        )
        log(
          `  numeric fields   ${mistyped.length === 0 ? c.green('all real numbers') : c.red(`${mistyped.length} stored as text`)}`,
        )
        for (const m of mistyped.slice(0, 5)) log(c.red(`    ${m}`))
        if (mistyped.length > 5) log(c.red(`    …and ${mistyped.length - 5} more`))
        log('')
        if (sourceSum !== shopSum) failures += 1
        if (sourceHash !== shopHash) failures += 1
        if (mistyped.length) failures += 1
      }
    }

    log('')
    if (failures) {
      die(`${failures} check(s) failed — do NOT cut over.`)
    }
    ok(`Every check passed. The catalogue in the shop is identical to ${label}.`)
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
