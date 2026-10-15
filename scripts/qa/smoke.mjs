#!/usr/bin/env node
/**
 * End-to-end smoke test of the QA harness itself.
 *
 *   node scripts/qa/smoke.mjs
 *
 * 1. ensures the stack is up (scripts/qa/up.sh — a no-op when it already is);
 * 2. seeds the shop "qa-smoke";
 * 3. checks the REAL firestore.rules are enforced (own shop readable and
 *    writable, another shop refused) using the account's emulator ID token;
 * 4. signs in with Playwright, reaches the home page, opens the stock page and
 *    waits for seeded products; screenshots to $QA_STATE_DIR (default /tmp/qa):
 *    smoke-home.png and smoke.png.
 *
 * Exits non-zero, with the reason, on any failure.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedShop } from './seed.mjs'
import { launch, loggedInPage, settle, url } from './login.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const STATE = process.env.QA_STATE_DIR ?? '/tmp/qa'
const SHOP = process.env.QA_SMOKE_SHOP ?? 'qa-smoke'
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST}`
const PROJECT = 'demo-mektebti'

/** Product names seed.mjs always creates, outside any variant family. */
const EXPECTED = [
  'Agrafeuse de bureau',
  'Cahier 96 pages Seyès',
  'Calculatrice scientifique Casio fx-82',
  'Classeur à levier A4',
  'Gomme blanche Maped',
  'Ramette papier A4 80 g — 500 feuilles',
]

const step = (msg) => console.log(`[smoke] ${msg}`)

async function rulesCheck(email, password) {
  const signIn = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  if (!signIn.ok) throw new Error(`auth emulator sign-in failed: ${signIn.status} ${await signIn.text()}`)
  const { idToken } = await signIn.json()
  const headers = { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' }
  const base = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`

  const ownRead = await fetch(`${base}/shops/${SHOP}/products?pageSize=1`, { headers })
  const ownWrite = await fetch(`${base}/shops/${SHOP}/qa_probe/ping`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { at: { integerValue: String(Date.now()) } } }),
  })
  const otherRead = await fetch(`${base}/shops/some-other-shop/products?pageSize=1`, { headers })
  const shopDocWrite = await fetch(`${base}/shops/${SHOP}?updateMask.fieldPaths=paidUntil`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { paidUntil: { integerValue: '0' } } }),
  })
  // Clean the probe up again with the same token.
  await fetch(`${base}/shops/${SHOP}/qa_probe/ping`, { method: 'DELETE', headers })

  const result = {
    ownRead: ownRead.status,
    ownWrite: ownWrite.status,
    otherShopRead: otherRead.status,
    ownShopDocWrite: shopDocWrite.status,
  }
  const ok =
    result.ownRead === 200 &&
    result.ownWrite === 200 &&
    result.otherShopRead === 403 &&
    result.ownShopDocWrite === 403
  if (!ok) throw new Error(`firestore.rules not behaving as expected: ${JSON.stringify(result)}`)
  return result
}

async function main() {
  mkdirSync(STATE, { recursive: true })

  step('ensuring the stack is up (scripts/qa/up.sh)')
  execFileSync('bash', [join(HERE, 'up.sh')], { stdio: 'inherit' })

  step(`seeding shop "${SHOP}"`)
  const seeded = await seedShop(SHOP)
  step(`seeded: ${JSON.stringify(seeded.summary)}`)

  step('checking firestore.rules through the emulator')
  const rules = await rulesCheck(seeded.email, seeded.password)
  step(`rules OK: ${JSON.stringify(rules)}`)

  const browser = await launch()
  try {
    step(`logging in as ${seeded.email}`)
    const { page, errors } = await loggedInPage(browser, SHOP)

    // The home page is the logged-in landing route.
    // login() has already waited for the shell and settled the home page; the
    // home page's own "open the till" button is the proof it rendered.
    await page.locator('main a[href="/caisse"]').first().waitFor()
    await page.screenshot({ path: join(STATE, 'smoke-home.png') })
    step(`home reached: ${page.url()}  -> ${join(STATE, 'smoke-home.png')}`)

    // Navigate the way a user does: through the sidebar, staying in the SPA.
    const stockLink = page.locator('a[href="/stock"]:visible').first()
    if (await stockLink.count()) await stockLink.click()
    else await page.goto(url('/stock'))
    await page.waitForURL((u) => new URL(u).pathname === '/stock')
    await settle(page)

    await page.waitForFunction(
      (names) => names.filter((n) => document.body.innerText.includes(n)).length >= 3,
      EXPECTED,
      { timeout: 60_000 },
    )
    const seen = await page.evaluate(
      (names) => names.filter((n) => document.body.innerText.includes(n)),
      EXPECTED,
    )
    await page.screenshot({ path: join(STATE, 'smoke.png'), fullPage: true })
    step(`stock page shows seeded products: ${seen.join(' | ')}`)
    step(`screenshot -> ${join(STATE, 'smoke.png')}`)

    if (errors.length) {
      step(`uncaught page errors (${errors.length}):\n  ${errors.join('\n  ')}`)
    }
    console.log(
      JSON.stringify({ ok: true, shop: SHOP, rules, productsSeen: seen.length, pageErrors: errors.length }),
    )
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(`[smoke] FAILED: ${err?.stack ?? err}`)
  process.exit(1)
})
