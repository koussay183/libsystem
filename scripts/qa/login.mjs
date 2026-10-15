/**
 * Playwright helpers for the local QA stack (scripts/qa/up.sh must be running,
 * and the shop seeded with `node scripts/qa/seed.mjs <name>`).
 *
 *   import { launch, login } from '/home/user/libsystem/scripts/qa/login.mjs'
 *   const browser = await launch()
 *   const page = await browser.newPage()
 *   await login(page, 'qa-smoke')            // lands on the home page, signed in
 *   await page.goto(url('/stock'))
 *
 * login() works with any Playwright `page` — from this folder's playwright-core
 * or from your own playwright install.
 */

/** Where up.sh serves the emulator-wired app. */
export const BASE_URL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5199'
/** The password seed.mjs gives every QA account. */
export const QA_PASSWORD = 'qa-pass-123'
/** The Chromium build installed on this machine. */
export const CHROMIUM = process.env.QA_CHROMIUM ?? '/opt/pw-browsers/chromium'

export const emailFor = (name) => `${name}@qa.test`
export const url = (path = '/') => new URL(path, BASE_URL).href

/**
 * Launches headless Chromium with this folder's playwright-core.
 * Options are passed through to chromium.launch().
 */
export async function launch(options = {}) {
  const { chromium } = await import('playwright-core')
  return chromium.launch({ executablePath: CHROMIUM, headless: true, ...options })
}

/**
 * Signs `page` in as the seeded shop `name` and waits until the logged-in home
 * page is on screen.
 *
 * @param {import('playwright-core').Page} page
 * @param {string} name     the shop name given to seed.mjs (account <name>@qa.test)
 * @param {object} [opts]
 * @param {'fr'|'ar'} [opts.lang]     force the UI language (default: the app's own, French)
 * @param {string} [opts.password]    default qa-pass-123
 * @param {number} [opts.timeout]     ms, default 60000
 * @returns {Promise<{ email: string, shopId: string }>}
 */
export async function login(page, name, opts = {}) {
  const { lang, password = QA_PASSWORD, timeout = 60_000 } = opts
  const email = emailFor(name)

  if (lang) {
    // i18n reads localStorage('lang') once at startup (src/i18n/index.ts).
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('lang', l)
      } catch {
        /* about:blank and friends */
      }
    }, lang)
  }

  // Two attempts: on a cold dev server Vite may reload the page once while it
  // pre-bundles a dependency it discovered late, which can eat the first submit.
  let lastError
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url('/login'), { waitUntil: 'domcontentloaded', timeout })
      const emailInput = page.locator('input[type="email"]')
      await emailInput.waitFor({ state: 'visible', timeout })
      await emailInput.fill(email)
      await page.locator('input[type="password"]').fill(password)
      await page.locator('form button[type="submit"]').click()

      // Either the app navigates to "/" or the login form shows its error.
      const outcome = await Promise.race([
        page
          .waitForURL((u) => new URL(u).pathname === '/', { timeout })
          .then(() => 'home'),
        page
          // Chakra v3 renders Alert.Root as div.chakra-alert__root (no role).
          .locator('form .chakra-alert__root, form [role="alert"]')
          .first()
          .waitFor({ state: 'visible', timeout })
          .then(() => 'error'),
      ])
      if (outcome === 'error') {
        const text = await page.locator('form').innerText().catch(() => '')
        throw new Error(
          `login(${name}): the app refused ${email}. Did you run "node scripts/qa/seed.mjs ${name}"?\n${text}`,
        )
      }

      // Logged-in shell: the navigation links only exist behind RequireAuth.
      await page.locator('a[href="/caisse"]').first().waitFor({ state: 'attached', timeout })
      // …and the home page itself, not its lazy-chunk spinner.
      await settle(page, { timeout })
      const shopId = await page.evaluate(() => localStorage.getItem('lib.shop.v1') ?? '')
      if (shopId !== name) {
        throw new Error(`login(${name}): signed in, but the app selected shop "${shopId}"`)
      }
      return { email, shopId }
    } catch (err) {
      lastError = err
      if (String(err?.message ?? '').includes('the app refused')) throw err
    }
  }
  throw lastError
}

/**
 * Waits until no spinner is visible — the route's lazy chunk has arrived and
 * the first snapshot has rendered. Never throws: a page that legitimately keeps
 * a spinner (a slow report) just returns after `timeout`, so assert on content
 * afterwards. Call it after every navigation before a screenshot.
 *
 * @returns {Promise<boolean>} true when settled, false on timeout
 */
export async function settle(page, { timeout = 30_000 } = {}) {
  try {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.chakra-spinner')].every((el) => {
          const r = el.getBoundingClientRect()
          return r.width === 0 && r.height === 0
        }),
      undefined,
      { timeout, polling: 100 },
    )
    return true
  } catch {
    return false
  }
}

/**
 * Navigates inside the app (full load of BASE_URL + path) and settles.
 * The session survives: Firebase Auth keeps it in IndexedDB.
 */
export async function goto(page, path, { timeout = 60_000 } = {}) {
  await page.goto(url(path), { waitUntil: 'domcontentloaded', timeout })
  await settle(page, { timeout })
}

/**
 * Convenience: a fresh, isolated context (own IndexedDB, own localStorage)
 * signed in as `name`. Collects uncaught page errors in `errors`.
 *
 * @returns {Promise<{ context, page, errors: string[] }>}
 */
export async function loggedInPage(browser, name, opts = {}) {
  const { viewport = { width: 1366, height: 900 }, ...rest } = opts
  const context = await browser.newContext({ viewport, locale: 'fr-FR' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e?.message ?? e)))
  await login(page, name, rest)
  return { context, page, errors }
}
