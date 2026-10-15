# 05 — Tracking: GTM, GA4, Google Ads and Meta Pixel on the public pages only

| | |
| --- | --- |
| Date | 15 October 2026 |
| Scope | Architecture, consent, event spec, founder setup guide, CSP/headers, engineering spec for marketing tracking on Mektebti.tn |
| Method | Read `index.html`, `src/main.tsx`, `src/App.tsx`, `src/auth/RequireAuth.tsx`, `src/features/landing/*`, `src/lib/serviceWorker.ts`, `scripts/pwa.ts`, `netlify.toml`, the built `dist/`. Checked vendor docs on 15 Oct 2026 (section 8). Measured third-party script sizes with `curl`. |
| Status | **Design only. No code has been changed.** Section 6 is the build spec. Section 7 lists the founder's decisions. |
| Builds on | `docs/launch/02-legal-fiscal-compliance.md` §5.4 (consent position under Loi organique 2004-63), §6.5 (banner text) |

**Labels** (same as docs 01–03): **[F]** fact with a source in brackets, e.g. [T3]. Sources are in section 8. **[E]** estimate. **[D]** a decision only the founder can make (all listed in section 7). **[R]** something found in this repo, with the file.

---

## 0. Executive summary

1. **Tags load only on the marketing pages, never in the shop app.** GTM, and through it GA4, Google Ads and Meta Pixel, runs only on `/decouvrir` and future public pages. It never runs on `/login`, `/`, `/caisse` or any other app route. It never runs on a device where someone has signed in, and never in the installed PWA. The code enforces this. A GTM setting cannot override it.
2. **Opt-in first. Nothing loads before "Accepter".** No request goes to Google or Meta until the visitor accepts. This is Consent Mode v2 "basic" mode [F, T3]. The page still sends `consent default = denied` and then `consent update = granted`, so Google receives the v2 signals. "Advanced" mode (cookieless pings before consent) is a later option and needs the lawyer's agreement [D].
3. **Every ID is a Vite env var. When `VITE_GTM_ID` is unset, nothing happens**: no banner, no `dataLayer`, no request. Each other ID (GA4, Ads, Meta) can be switched off on its own in Netlify. The Google Ads conversion stops without its label.
4. **Six events, plus one this doc adds.** The six requested: `page_view`, `cta_whatsapp_click`, `plan_select`, `login_click`, `lang_switch`, `scroll_depth`. Added: `pricing_view`, so Meta `ViewContent` has a meaningful trigger. The WhatsApp click is the conversion: GA4 `generate_lead` (key event), the Google Ads conversion "WhatsApp – contact (site)", and Meta `Contact`. A plan click also sends Meta `Lead`. Pricing seen sends Meta `ViewContent`.
5. **Why the app must stay clean, with numbers.** The three tag scripts are about **1.1 MB of JavaScript, ~350 KB compressed** [F, measured T38]. The till's boot set today is about **1.40 MB** [R, `dist/`]. Tags in the app would add about 80% to what a low-end till parses. They would also run third-party code on the same origin as the Firestore cache and the Firebase Auth token, on screens that show customers' names, phones and CIN.
6. **The service worker is safe as it stands.** It ignores cross-origin requests (`scripts/pwa.ts` line 296), so tag requests are never cached and can never break offline mode. Two engineering points follow:
   - The tracking code must live in the lazily loaded landing chunk. A build check should prove it is not in the till's boot set.
   - **[R] The service worker strips every response header except `Content-Type` from the HTML shell** (`shellResponse()` in `scripts/pwa.ts`). A CSP or `X-Frame-Options` set in `netlify.toml` would therefore apply only to the first, uncontrolled visit. Fix it before relying on any CSP (§5.2).
7. **[R] Ads attribution bug to fix before any ad spend.** `RequireAuth` redirects `/` to `/decouvrir` and **drops the query string**, so an ad landing on `/?gclid=…&utm_…` loses its attribution. Fix it (one line), and always use `https://<domain>/decouvrir` as the ads' final URL.
8. **Founder work, about 3–4 hours in one sitting** [E]: create the GTM container, GA4 property, Google Ads conversion and Meta dataset (pixel). Then build 10 tags, 9 triggers and 21 variables in GTM using the exact names in §4.5, paste 5 IDs into Netlify, and test with Tag Assistant and Meta's Pixel Helper (now called "Meta Ads Data Advisor") [F, T25].
9. **Engineering work, about 1.5–2 days** [E]: 15 new files (most under 100 lines) and 10 edited files (§6.1), including a build guard that fails the deploy if tag code reaches `index.html` or the till's boot chunks.
10. **Go-live rule:** ship the code with the IDs unset. Set the IDs in Netlify only once the privacy/cookie page that the banner links to is published (doc 02 §6.3). Until then the banner would have nothing to link to.

---

## 1. Architecture

### 1.1 The five invariants (each one is enforced in code, not by GTM configuration)

| # | Rule | Enforced by |
|---|---|---|
| I1 | No tag script in `index.html`, ever. No GTM snippet and no `<noscript>` iframe. | `index.html` is served for every route, including `/caisse` (netlify.toml rewrite). It is also the service worker's offline shell. Build guard (§6.5). |
| I2 | Tags load only on a **marketing path**, in a document that has **never held a signed-in session**, on a device that is **not a shop machine**. | `useMarketingTracking()` decision (§1.3) |
| I3 | Leaving the marketing pages for the app always gets a **fresh document**, so loaded tags are thrown away. | Full-page navigation on "Se connecter", plus `TrackingFirewall` in the main bundle as a safety net (§6) |
| I4 | No consent means no third-party request. | GTM is injected only after the visitor accepts. Events are queued in memory until then and dropped on refusal. |
| I5 | Every ID unset (or malformed) means a no-op. | `readTrackingIds()` returns `null`, or empty per-channel flags (§6.2) |

### 1.2 Where the code lives

```
index.html (no tags)  ─────────────────────────────────────────────── every route, offline shell
  └─ main bundle (till boot set: index, react, chakra, i18n, firebase)
       ├─ src/lib/marketingRoutes.ts      ~0.3 KB  isMarketingPath(), window.__mkTracking type
       └─ src/components/TrackingFirewall.tsx       reloads if tags are live on a non-marketing path
  └─ lazy chunk "marketing" (only fetched on /decouvrir and future public pages)
       ├─ LandingPage.tsx (existing)          instrumented CTAs
       ├─ MarketingLayout.tsx                 route layout: consent banner + tracking context
       └─ tracking/{config,dataLayer,consent,gtm,events,useMarketingTracking,useScrollDepth,ConsentBanner}.ts(x)
            └─ after "Accepter":  https://www.googletagmanager.com/gtm.js?id=GTM-…
                                    ├─ Google tag → GA4
                                    ├─ Google Ads conversion + remarketing + conversion linker
                                    └─ Meta Pixel template → https://connect.facebook.net/en_US/fbevents.js
```

`MarketingLayout` and `LandingPage` must come from **one** dynamic import, so the landing page costs one chunk request rather than two in a row (§6.3, App.tsx).

### 1.3 When GTM loads: the full decision

GTM is injected only if **all** of the following are true:

| Condition | Source of truth |
|---|---|
| `VITE_GTM_ID` is set and matches `^GTM-[A-Z0-9]+$` | build-time env (§1.7) |
| The current path is a marketing path (`/decouvrir` today) | `isMarketingPath()` in `src/lib/marketingRoutes.ts` |
| Firebase Auth has finished loading **and** there is no signed-in user | `useAuth()` |
| `isShopMachine()` is false: nobody has ever signed in on this browser, and it is not the installed PWA | `src/features/landing/shopMachine.ts` [R] |
| The device has not opted out with `?mk_notrack=1` (for the founder's and colleague's phones) | `localStorage['mk:noTrack']` |
| It is not `vite dev` | `import.meta.env.DEV` |
| The visitor accepted analytics and/or ads, now or in the last 180 days, under the current consent version | `localStorage['mk:consent']` |

There is one override, for testing. `?mk_track=1`, or the `gtm_debug` parameter that Tag Assistant adds [F, T6], skips the shop-machine, no-track and dev checks for that browser session. **It never skips the "no signed-in user" check.** Test in a Chrome profile where nobody has ever signed in to Mektebti (§4.0).

A useful side effect: the founder's laptop, where he signs in, is automatically excluded from the statistics.

### 1.4 Why never inside the logged-in app

- **Privacy of shop data.** App screens show shop customers' names, phones, CIN and debts. Meta's pixel has an "automatic configuration" that tracks page events on its own; the GTM template has a switch to disable it [F, T24]. GA4 enhanced measurement can turn every history change into a page view. App URLs carry customer IDs (`/credit/:id`). Doc 02 §5.4 point 4 already requires that the app stays tag-free. `src/main.tsx` states "There is no telemetry here". Keep that sentence true.
- **Performance on low-end tills** [F, measured T38, 15 Oct 2026]:

  | Script | Raw | Compressed on the wire |
  |---|---|---|
  | `gtm.js` | 244 KB | 89 KB |
  | `gtag/js` (GA4 / Ads) | 439 KB | 152 KB |
  | `fbevents.js` (Meta) | 433 KB | 114 KB |
  | **Total** | **~1.1 MB** | **~355 KB** |

  The till's boot set is `index` 155 KB + `react` 219 KB + `chakra` 396 KB + `firebase` 580 KB + `i18n` 49 KB ≈ **1.40 MB raw** [R, `dist/sw.js` ESSENTIAL list, current `dist/` build]. Tags would add about 80% more JavaScript to parse. They would also add timers, beacons and listeners running all day next to the barcode wedge.
- **Offline.** On a dead line the scripts fail to load. They would add network errors to the browser console, which is the app's only forensic record (`src/main.tsx` "black box recorder"), and the owner reads it when something goes wrong.
- **Security (same origin).** GTM can run any code its account holders publish. On the same origin it can read IndexedDB, which holds the Firestore cache with shop data and the Firebase Auth refresh token (`firebaseLocalStorageDb`). See §1.6.

### 1.5 Service worker and offline: what was checked in `scripts/pwa.ts`

| Finding | Consequence for tracking |
|---|---|
| `fetch` handler: `if (url.origin !== self.location.origin) return` (line 296) | Requests to googletagmanager.com, google-analytics.com and facebook.net/com are not intercepted and not cached. They cannot fill the cache or break the Firestore stream. **No change needed.** |
| `PRECACHE` = every emitted `.js`. `ESSENTIAL` = only the entry chunk and its static imports. | The marketing chunk is precached as **optional** (best effort). If tracking code were statically imported from `main.tsx` or `App.tsx`, it would become **essential**, and a failed fetch of it would cost the shop its offline install. The build guard (§6.5) prevents this. |
| `networkShell()` serves the **cached old shell** whenever the network returns HTML from a different build (`isOurBuild`) | A Netlify env change (new IDs, or removing `VITE_GTM_ID`) reaches **returning** visitors only after their new worker activates, usually one or two visits later. **The instant kill switch is in GTM** (pause tags or publish an empty version), not in Netlify (§4.8). |
| `shellResponse()` rebuilds the HTML response with only `Content-Type` | CSP, `X-Frame-Options` and other security headers from `netlify.toml` are dropped on every service-worker-served navigation (§5.2). |
| Offline page (`OFFLINE_HTML`) is a worker-built response without CSP | Unaffected by any CSP. Its inline `onclick` keeps working. |

**Offline behaviour of the design.** Take a visitor who has already accepted and opens `/decouvrir` from the cache with no line. The page renders, `gtm.js` fails (`onerror` → `window.__mkTracking = 'failed'`), `dataLayer` pushes go into a plain array, and nothing retries. The till never downloads the marketing chunk unless someone opens `/decouvrir` on it, and even then tracking is off there (shop machine).

Related finding for the performance owner (not tracking): every landing visitor registers the worker and precaches the whole app (~2 MB) in the background. That is wasted 3G data for a prospect. Consider registering the worker only off-landing.

### 1.6 Same-origin threat model, and the real long-term fix

Anyone who can **publish** the GTM container can run JavaScript on `libsystem-tn.netlify.app`. The guards in §1.3 mean such code never runs in a browser where the app has been used. One narrow case remains: a prospect on the landing page signs in for the first time in another tab. `useMarketingTracking()` reloads the landing tab as soon as Firebase reports a user (§6.2), which closes that window to a fraction of a second.

Mitigations:

1. **GTM access:** only the founder is Admin and Publisher. The colleague gets Edit, not Publish. 2-Step Verification is on for every Google and Meta account.
2. **GTM restrictions:** the page pushes `gtm.blocklist: ['customScripts']`, which blocks Custom HTML tags and Custom JavaScript variables. It also pushes `gtm.allowlist: ['sandboxedScripts']`, so gallery templates such as the Meta Pixel template still run. A blocklist implicitly blocks sandboxed templates unless they are allowlisted, and `sandboxedScripts` does not impose allowlist rules on other classes [F, T4]. Verify in Preview that the Meta template still fires (§4.7).
3. **CSP** (§5) limits where scripts load from and where data can be sent. It also blocks inline scripts, so a Custom HTML tag could not execute anyway.
4. **The real fix [D, later]:** put the marketing site and the app on **different origins**, e.g. `mektebti.tn` / `www.mektebti.tn` for marketing and `app.mektebti.tn` for the app. localStorage and IndexedDB are per origin, so a tag on the marketing site can then never reach shop data. This also drops the shop-machine heuristics. It belongs in the custom-domain work.

### 1.7 Environment variables

| Variable | Format | Example | Used for | When empty |
|---|---|---|---|---|
| `VITE_GTM_ID` | `GTM-` + letters/digits | `GTM-ABC12DE` | Loads the container. **Master switch.** | Everything off: no banner, no `dataLayer` |
| `VITE_GA4_ID` | `G-` + letters/digits | `G-1A2B3C4D5E` | GA4 measurement ID, read by GTM via the data layer | GA4 tags do not fire (`mk_send_ga4 = 'no'`) |
| `VITE_GADS_ID` | `AW-` + digits | `AW-123456789` | Google tag for Ads; the code derives `mk_gads_conversion_id = 123456789` | All Ads tags off |
| `VITE_GADS_CONV_LABEL_WHATSAPP` | letters/digits/`-`/`_` | `AbC-D_efGhIjKl` | Label of the "WhatsApp – contact (site)" conversion action | Conversion tag off; remarketing still on if `VITE_GADS_ID` is set |
| `VITE_META_PIXEL_ID` | digits | `123456789012345` | Meta dataset (pixel) ID | Meta tags off |

- These values are **public** (they ship in the JS bundle) [F, T35]. That is normal for these IDs.
- **Never** put a secret in a `VITE_` variable [F, T35]. The Meta Conversions API token in Phase 2 is `META_CAPI_TOKEN`, without the prefix, and is used in a Netlify Function only (§6.7).
- Set them for the **Production** deploy context only, so deploy previews do not pollute the data [F, T33].
- **Changing a value requires a new build and deploy** [F, T33]. Remember the service-worker delay for returning visitors (§1.5).

---

## 2. Consent: light FR/AR banner, Consent Mode v2, INPDP

### 2.1 Position (aligned with doc 02 §5.4)

- Loi 2004-63 art. 30 requires **express and specific consent** for advertising use. Art. 52 covers transfers abroad (Google and Meta are in the US). Meta's Business Tools Terms require a "clear and prominent notice" on each page where the pixel runs. See doc 02 §5.4 and its sources.
- No Tunisian cookie-specific rule was found (doc 02). We therefore apply the strict reading: **opt-in, equal-prominence choices, withdrawal as easy as consent, no cookie wall, a record of the choice.**
- **Implementation: Consent Mode v2 in "basic" mode, enforced by code.** In basic mode, tags stay blocked until the user responds, nothing is sent to Google before consent, and tags are "completely blocked" when consent is denied [F, T3]. We go one step further than GTM's own consent checks: GTM itself is not loaded before consent. The founder therefore cannot accidentally create a tag that fires without consent.
- **Trade-off, stated plainly:** basic mode gives Google only a "general" conversion model, less detailed than advanced mode's advertiser-specific model [F, T3]. Visitors who refuse are invisible to GA4, Ads and Meta. For a B2B campaign of a few hundred clicks a month this is acceptable [E]. The WhatsApp campaign code (§2.6) recovers source attribution for the leads that matter, without cookies.

### 2.2 Banner UX spec

- **Where:** rendered by `MarketingLayout`, so it appears on every marketing page and on no app page. It is not shown when tracking is off (no ID, shop machine, signed in): there is nothing to consent to.
- **Layout:** a card fixed to the bottom (`inset-inline: 1rem; bottom: 1rem; max-width: 40rem`), z-index 40 (above the WhatsApp float at 30 in `landing.css`). It does not block the page, and the CTAs stay usable. It is `position: fixed`, so it causes no layout shift (CLS 0). While it is open, the WhatsApp float moves up by the banner's height (CSS variable `--mk-consent-offset`, set with a `ResizeObserver`).
- **Three buttons with the same style and size:** **Refuser · Personnaliser · Accepter**. Equal prominence is doc 02's requirement. No pre-ticked boxes.
- **"Personnaliser"** opens two switches, both **off** by default:
  - Mesure d'audience: Google Analytics
  - Publicité: Google Ads, Meta

  plus a **"Enregistrer mes choix"** button.
- **"Gérer mes cookies"** link in the landing footer reopens the panel on the details view, with the current choice pre-filled.
- **"En savoir plus"** links to the privacy page `/confidentialite#cookies`, which must exist before go-live (doc 02 §6.3).
- **Accessibility:** `role="dialog"`, `aria-modal="false"`, `aria-labelledby`. No focus trap (it does not block). Buttons are at least 44 px tall. Visible focus ring. Works at 320 px wide. RTL comes from the `dir` attribute that `applyDirection()` already sets.
- **Language:** follows `i18n.language`, like the landing page.

**Copy.** FR adapts doc 02 §6.5. **AR to be checked by a native speaker and the lawyer [D].**

| Key | FR | AR |
|---|---|---|
| title | Cookies et mesure d'audience | الكوكيز وقيس عدد الزوار |
| body | Avec votre accord, Mektebti.tn utilise des cookies de Google et de Meta pour mesurer l'audience du site et savoir quelle publicité vous a amené ici. Rien n'est activé si vous refusez. Vous pouvez changer d'avis à tout moment via « Gérer mes cookies » en bas de page. | بموافقتك، يستعمل موقع مكتبتي كوكيز من Google و Meta باش نقيسو عدد الزوار ونعرفو أنهو الإشهار اللي جابك لهنا. ما يتفعّل حتى شيء إذا رفضت. تنجم تبدّل رأيك وقت ما تحب من «إعدادات الكوكيز» في أسفل الصفحة. |
| refuse | Refuser | نرفض |
| customize | Personnaliser | نختار بنفسي |
| accept | Accepter | نقبل |
| analytics | Mesure d'audience (Google Analytics) | قيس عدد الزوار (Google Analytics) |
| analyticsHelp | Compter les visites et les clics, de façon agrégée. | نحسبو الزيارات والنقرات بصفة إجمالية. |
| ads | Publicité (Google Ads, Meta) | الإشهار (Google Ads و Meta) |
| adsHelp | Mesurer l'efficacité de nos publicités et vous en montrer de plus pertinentes. | نقيسو نجاعة إعلاناتنا ونوريولك إعلانات تهمّك أكثر. |
| save | Enregistrer mes choix | سجّل اختياراتي |
| more | En savoir plus | اعرف أكثر |
| manage | Gérer mes cookies | إعدادات الكوكيز |

### 2.3 Consent state and storage

`localStorage['mk:consent'] = {"v":1,"analytics":true,"ads":false,"at":"2026-10-15T09:12:00.000Z"}`

- **`v` is the consent version.** Bump `CONSENT_VERSION` whenever a vendor or purpose is added (for example, TikTok later). Everyone is then asked again.
- **Expiry: ask again after 180 days.** This is our choice, not a cited legal rule. It sits within doc 02's 13-month cookie maximum. Adjust it if the lawyer asks [D].
- **This record is the on-device proof of consent:** date, choice and version, as doc 02 §5.4 point 5 asks. A server-side consent log would need a public write endpoint. Add one only if the lawyer insists [D] (§6.7 shows where it would go).
- **localStorage failures** (private mode, blocked storage) mean "not decided". The banner reappears on the next visit, and tracking stays off until a choice is made.

**State machine** (per document):

```
            auth settled, all §1.3 checks pass
 off ─────────────────────────────────────────────► (read mk:consent)
  ▲                                                     │
  │ any check fails                     none/expired    │ stored: refused      stored: granted
  │                                     ▼               ▼                      ▼
  │                                    ask ──Refuser──► refused               on (GTM injected at idle)
  │                                     │                                      ▲
  │                                     └──Accepter / Enregistrer (≥1 yes)─────┘ (GTM injected now)
  │
  └── a choice changed while GTM is already live, or a user signs in → location.reload()
```

Changing a choice after GTM has loaded (for example, withdrawing) always clears the tracking cookies and **reloads the page**. Tags cannot be unloaded from a live document, and a reload is the only clean reset. On refusal, the new document never loads GTM.

### 2.4 Exact `dataLayer` sequence (the order matters)

Google requires the consent default **before** any measurement command; out of order, "consent defaults won't work" [F, T2]. The data layer must be initialised above the container and must never be reassigned [F, T21]. Allowlists and blocklists must be pushed before any tag fires [F, T4].

On a returning visitor who accepted ads but not analytics:

```js
// 1. pushConsentDefault()  — first thing on a marketing page, once per document
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
                             analytics_storage: 'denied', wait_for_update: 500 })
gtag('set', 'ads_data_redaction', true)   // redacts ad click IDs whenever ad_storage is denied [T2]
gtag('set', 'url_passthrough', false)
// 2. pushConsentUpdate(choice)
gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'granted',
                            ad_user_data: 'granted', ad_personalization: 'granted' })
{ event: 'consent_update', consent_analytics: 'denied', consent_ads: 'granted' }
// 3. bootGtm() — config + restrictions, then the container start event
{ 'gtm.allowlist': ['sandboxedScripts'], 'gtm.blocklist': ['customScripts'],
  mk_ga4_id: 'G-…', mk_gads_id: 'AW-…', mk_gads_conversion_id: '123456789',
  mk_gads_label_whatsapp: 'AbC…', mk_meta_pixel_id: '1234…',
  mk_send_ga4: 'no', mk_send_ads: 'yes', mk_send_ads_whatsapp: 'yes', mk_send_meta: 'yes' }
{ 'gtm.start': 1760519520000, event: 'gtm.js' }
// 4. queued + live events (section 3)
{ event: 'page_view', … }
// (script tag for gtm.js is injected now, or at idle for returning visitors)
```

- `wait_for_update` has no effect in our flow, because the update always comes before GTM loads. It is kept so an "advanced mode" switch later is a one-line change.
- `mk_send_*` flags fold "ID present" and "consent given" into one value per channel. GTM triggers test only these flags (§4.5), which keeps the founder's setup simple. GTM's own consent checks stay on as a second layer.
- `gtag()` must push the **`arguments` object**, not an array. Consent commands are only recognised in that form (see the sketch in §6.2).

### 2.5 Withdrawal and the cookie list for the privacy page

On withdrawal, the code deletes these cookies on the current host before reloading. They are also the list to publish in the cookie policy:

| Cookie | Set by | Purpose | Lifetime | Source |
|---|---|---|---|---|
| `_ga` | GA4 | distinguish users | 2 years (default) | [F, T16] |
| `_ga_<container-id>` | GA4 | persist session state | 2 years (default) | [F, T16] |
| `_gcl_au` (`_gcl_` family) | Google Ads conversion linker | measure actions after an ad click | 90 days for the `_gcl_` family | [F, T19] (the page does not name `_gcl_au` itself) |
| `_fbp` | Meta Pixel | browser ID | check in DevTools after the first accept and write the real value in the policy | name from [F, T29]; lifetime **to verify** |
| `_fbc` | Meta Pixel (when the URL has `fbclid`) | Meta click ID | same | name from [F, T29]; lifetime **to verify** |
| `mk:consent` (localStorage) | Mektebti | stores the choice | 180 days | this doc |

GA4 does not log or store IP addresses [F, T17]. That point is useful for the privacy page.

### 2.6 Cookie-free source attribution for WhatsApp leads (recommended, [D])

The real conversion is the WhatsApp conversation, and it happens outside the site. To know which campaign brought each lead, **including leads from visitors who refused cookies**, the code appends a short **campaign code** to the pre-filled WhatsApp text, e.g. `… pour ma librairie. (réf. rentree-2027)`:

- The code is `utm_campaign` (lower-cased, `[a-z0-9-]`, at most 24 characters). Without a campaign it is `gads` if the URL has `gclid`, `gbraid` or `wbraid`, or `meta` if it has `fbclid`. Otherwise nothing is appended.
- It is **campaign-level only, never a per-visitor ID**, so it cannot identify anyone. It is read from the landing URL into memory and never stored. The visitor sees it in the message they choose to send.
- The founder copies the code into the lead sheet next to the phone number. That gives cost per *real* conversation per campaign, which no pixel can give.

---

## 3. Events spec

### 3.1 Fields added by `track()` to every event

| Key | Example | Notes |
|---|---|---|
| `event_id` | `0b6f…-uuid` | `crypto.randomUUID()`. Used as Meta `eventID` and Google Ads `transaction_id`. Lets a Phase 2 Conversions API deduplicate against the pixel [F, T27]. |
| `page_location` | `https://libsystem-tn.netlify.app/decouvrir?utm_source=facebook&utm_campaign=rentree-2027` | Origin + path + **only** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `utm_id`, `gclid`, `gbraid`, `wbraid`, `gad_source`, `fbclid`. Hash dropped. Each value cut to 100 characters. GA4 allows up to 1,000 characters for page location [F, T14]. |
| `page_path` | `/decouvrir` | |
| `page_title` | `document.title` | |
| `ui_language` | `fr` / `ar` | **Not `language`**: GA4 already fills a Language dimension from the browser. |
| *all event-specific keys* | `cta_location: undefined, plan: undefined, …` | **Always sent, as `undefined` when they do not apply.** GTM's data model persists keys between pushes, so without the reset a `plan` from a pricing click would leak into the next `scroll_depth`. |

### 3.2 Event catalogue

| Event (`dataLayer`) | When | Specific keys | Notes |
|---|---|---|---|
| `page_view` | Marketing layout mounts, and on every pathname change between marketing routes (keyed on `location.key`) | none | Hash links (`#tarifs`) do not count. Queued while the banner is unanswered. |
| `pricing_view` *(added)* | `#tarifs` is ≥50% visible for the first time in this page view (`IntersectionObserver`) | `section: 'tarifs'` | Feeds Meta `ViewContent`. Builds the "saw the prices" audience. |
| `plan_select` | Click on a plan's **"Choisir / اختار"** button | `plan: 'month' \| 'year' \| 'life'` (the stable `id` from `copy.ts`, never the translated name) | Pushed **immediately before** the `cta_whatsapp_click` from the same click |
| `cta_whatsapp_click` | Any link that opens WhatsApp | `cta_location: 'hero' \| 'pricing' \| 'final' \| 'final_phone' \| 'float'`, `plan` (pricing only), `lead_source: 'whatsapp'` | The request names this key `location`. It is called `cta_location` here so it is never confused with `window.location` or GA4's `page_location`. |
| `login_click` | Nav **"Se connecter"** | `cta_location: 'nav'` | The link becomes a full navigation. The event uses GTM `eventCallback` and a 600 ms safety timer before `location.assign('/login')`. Ctrl/Cmd/middle-click are left to the browser. |
| `lang_switch` | Language toggle | `lang_from`, `lang_to` | Pushed before `i18n.changeLanguage()` |
| `scroll_depth` | 25 / 50 / 75 / 90% of the page, once each per page view | `percent_scrolled: 25 \| 50 \| 75 \| 90` | `requestAnimationFrame`-throttled passive listener. Not attached when tracking is off. |
| `consent_update` *(internal)* | After a choice | `consent_analytics`, `consent_ads` | For debugging in Tag Assistant. No tag uses it. |

GA4 rules respected: event names start with a letter and use only letters, digits and underscores [F, T13]. Names and parameter names are 40 characters or fewer, values 100 characters or fewer, and there are at most 25 parameters per event [F, T14].

### 3.3 Mapping to GA4, Google Ads and Meta

| `dataLayer` event | GA4 event (params) | Google Ads | Meta Pixel (standard event) |
|---|---|---|---|
| `page_view` | `page_view` (page_location, page_title, ui_language) | **Remarketing** tag + Conversion Linker | **PageView** |
| `pricing_view` | `pricing_view` (section) | no tag (build audiences in GA4 and share them with Ads) | **ViewContent** `{content_name:'tarifs'}`. Meta defines ViewContent as "a visit to a web page you care about" [F, T22]. |
| `plan_select` | `plan_select` (plan) | no tag. Optionally a *secondary* conversion later [D]. | **Lead** `{content_name: plan}`. See note below. |
| `cta_whatsapp_click` | **`generate_lead`** (lead_source='whatsapp', cta_location, plan) → **mark as key event** [F, T12] | **Conversion "WhatsApp – contact (site)"**, category **Contact**, count **One**. Primary. | **Contact** `{content_name: cta_location, content_category: plan}`. Meta: "initiates contact … via … chat" [F, T22]. |
| `login_click` | `login_click` (cta_location) | no tag (GA4 audience of existing clients to *exclude*) | no tag |
| `lang_switch` | `lang_switch` (lang_from, lang_to) | no tag | no tag |
| `scroll_depth` | `scroll_depth` (percent_scrolled) | no tag | no tag |

Notes:

- **Lead on `plan_select` is a deliberate stretch.** Meta defines Lead as "when a sign up is completed" [F, T22]. Choosing a named plan and sending a pre-written "je suis intéressé par la formule X" message is the closest thing this page has to a sign-up. Optimise Meta campaigns for **Contact** (more volume). Keep Lead as the high-intent signal. If a real form (a demo or call-back request) is added later, move Lead to that form and send `plan_select` as a custom event.
- A pricing click therefore sends **both** Lead and Contact to Meta, and only `generate_lead` plus one Ads conversion to Google. This is intended: they answer different questions.
- **Google Ads category "Contact"** exists among Google's conversion categories [F, T9]. **Count "One"** is Google's recommendation for leads [F, T10].
- **No monetary value is sent from the page.** If the founder wants value-based bidding, set "use the same value for each conversion" in the Google Ads conversion settings [D]. GA4 supports TND as a currency [F, T18]. TND support as a Google Ads *account* currency was not confirmed, and the account currency **cannot be changed after creation** [F, T11].
- **Click-to-WhatsApp ads** on Meta, which open WhatsApp directly from the ad, never reach this page. Meta measures those natively. This pixel measures website-traffic campaigns only.

### 3.4 UTM conventions (so reports stay readable)

| Channel | Final URL | Parameters |
|---|---|---|
| Google Ads | `https://<domain>/decouvrir` | **Auto-tagging on** (adds `gclid`). No manual UTMs needed once GA4 and Ads are linked. |
| Meta ads (website traffic) | `https://<domain>/decouvrir` | `utm_source=facebook` (or `instagram`) `&utm_medium=paid_social&utm_campaign=<slug>&utm_content=<ad-name>`. Meta's "URL parameters" box can fill the campaign and ad names dynamically [F, T32, third-party guide; use Meta's "Build a URL parameter" helper]. |
| WhatsApp status / groups | `…/decouvrir?utm_source=whatsapp&utm_medium=referral&utm_campaign=<slug>` | |
| Flyers / stickers (QR) | `…/decouvrir?utm_source=flyer&utm_medium=print&utm_campaign=<slug>` | Print the QR with the UTMs inside. |

Campaign slugs: lowercase, digits and hyphens, at most 24 characters (they double as the WhatsApp campaign code, §2.6). Examples: `hors-saison-2026`, `rentree-2027`, `salon-libraires-2027`.

### 3.5 What to read every Monday (10 minutes) [E]

1. **GA4 → Reports → Acquisition → Traffic acquisition:** sessions and `generate_lead` per session source/medium.
2. **GA4 funnel:** `page_view` → `pricing_view` → `plan_select` → `generate_lead`, per source.
3. **Google Ads / Meta Ads Manager:** cost per conversion (Contact / WhatsApp).
4. **The lead sheet** (WhatsApp code → conversation → demo → signed): cost per **signed shop**, the only number that pays the bills. Doc 03 puts blended acquisition cash at about 510 DT per new shop [E, doc 03].

---

## 4. Founder setup guide (step by step)

Total time about 3–4 hours [E]. UI labels below were checked against vendor help pages on 15 Oct 2026. Google and Meta rename menus often, so if a label differs, look for the nearest equivalent.

### 4.0 Before you start

1. **One business Google account** (e.g. `marketing@…`, not a personal Gmail) owns GTM, GA4 and Google Ads. **One Meta Business portfolio** owns the dataset. Add the colleague as a user. Do not share passwords.
2. Turn on **2-Step Verification** on every account.
3. Create a **separate Chrome profile** called "Mektebti Test" and **never sign in to Mektebti in it**. In your usual profile, where you sign in, tracking is off by design (§1.3).
4. On your own phone and your colleague's phone, open `…/decouvrir?mk_notrack=1` once, so your own visits are not counted. `?mk_notrack=0` undoes it.
5. **[D] Domain:** decide whether ads start on `libsystem-tn.netlify.app` or on `mektebti.tn`. A brand domain looks more trustworthy in ads. It allows DNS verification for Meta, and it opens the origin split of §1.6. If the domain is changed later, update the GA4 stream URL, the Meta domain, the traffic permissions and every ad's final URL.

### 4.1 Google Tag Manager container (≈10 min)

1. Go to <https://tagmanager.google.com> → **Create account**. Account name `Mektebti`, country Tunisia.
2. Container name `mektebti-site`, target platform **Web** → Create → accept the terms.
3. **Close the "Install Google Tag Manager" pop-up without copying the snippet.** The app loads GTM itself, and the snippet must never go into `index.html` (§1.1, I1).
4. Note the ID shown top right: `GTM-XXXXXXX`. This is **`VITE_GTM_ID`**.
5. **Admin → Container Settings → Additional Settings → tick "Enable consent overview"** → Save [F, T5].
6. **Admin → User Management:** founder = Publish (Admin). Colleague = Edit.

### 4.2 GA4 property (≈20 min)

1. Go to <https://analytics.google.com> → Admin → **Create → Property**. Name `Mektebti.tn`, reporting time zone **Tunisia**, currency **Tunisian Dinar (TND)** [F, T18].
2. Business details → Create → choose platform **Web**. Website URL `https://libsystem-tn.netlify.app` (or your domain), stream name `Site Mektebti`.
3. Copy the **Measurement ID** `G-XXXXXXXXXX`. This is **`VITE_GA4_ID`**.
4. In the stream, under **Enhanced measurement → gear icon** [F, T15]:
   - Page views: cannot be turned off [F, T15]. Open its advanced settings and **untick the browser-history page change option**. Our code sends `page_view` itself, and the history option would double-count and count `#tarifs`.
   - **Scrolls: off.** We send `scroll_depth`.
   - **Outbound clicks: off.** WhatsApp clicks arrive as `generate_lead`.
   - **Form interactions: off. Site search: off.**
   - File downloads and video can stay on.
5. **Admin → Data collection and modification → Data retention:** set to **14 months** [D, recommended].
6. **Admin → Data collection:** leave **Google signals off** for now [D]. It is cross-device advertising data and adds consent questions.
7. **Admin → Custom definitions → Create custom dimension** (scope **Event**), one per parameter: `cta_location`, `plan`, `ui_language`, `lead_source`, `percent_scrolled`, `lang_to`, `section`.
8. After the first test events (§4.7): **Admin → Events → `generate_lead` → mark as key event.**

### 4.3 Google Ads account and conversion action (≈30 min)

1. Go to <https://ads.google.com> → create the account in **expert mode** (not Smart campaign). **The billing currency is permanent** [F, T11]. Check whether TND is offered for a Tunisia account; if not, decide between EUR and USD [D].
2. **Goals → Conversions → Summary → + Create conversion action** [F, T8] → **Conversions on a website** → enter your domain → **Scan**.
3. Category **Contact** [F, T9] → create the conversion **manually**:
   - Conversion name: **`WhatsApp – contact (site)`**
   - Value: **"Don't use a value"** to start [D]
   - Count: **One** [F, T10]
   - Click-through window: 30 days. Engaged-view and view-through: defaults.
   - Attribution: the default (data-driven)
4. Tag setup → **Use Google Tag Manager** → copy:
   - **Conversion ID** (digits). Prefix it with `AW-` → **`VITE_GADS_ID`** (e.g. `AW-123456789`).
   - **Conversion Label** → **`VITE_GADS_CONV_LABEL_WHATSAPP`** [F, T7].

   Do **not** use the "Set up in Google Tag Manager" button: it would create a tag with hard-coded IDs, outside our naming.
5. **Admin → Account settings → Auto-tagging: on.**
6. Once GA4 has data: in GA4, **Admin → Product links → Google Ads links → Link**. In Google Ads, keep the native WhatsApp conversion as **Primary**. If you import GA4's `generate_lead`, set it to **Secondary**, or it double-counts.

### 4.4 Meta Business, dataset (pixel) and domain (≈30 min)

1. Go to <https://business.facebook.com> → create or choose the **business portfolio** `Mektebti.tn`, with 2FA required for admins.
2. **Events Manager → Connect data → Web** → name `Mektebti.tn – site` → choose to set up the **Meta Pixel** and to install the code **manually**. Meta now calls pixels "datasets". Copy the **Dataset / Pixel ID** (digits) → **`VITE_META_PIXEL_ID`**.
3. Dataset **Settings**:
   - **Automatic advanced matching: off.** There is no form on the page, and it scrapes form fields.
   - **Automatic event setup / "Track events automatically without code": off.** It reads button text.
   - **Traffic permissions → Create allow list** with your domain(s) [T30, third-party guide; labels may differ]. Only listed domains can then send events with your ID, which stops spoofing. Put your own domain on the list first, or your own events stop arriving.
4. **Domain verification:** Business settings → **Brand safety → Domains → Add**. The methods are DNS TXT, HTML file upload to the web root [F, T26], or a `<meta>` tag in `<head>` [T31, third-party].
   - **On `mektebti.tn`:** use **DNS TXT** at your registrar. Nothing changes in the code.
   - **On `libsystem-tn.netlify.app`:** DNS is not possible. `netlify.app` is on the Public Suffix List [F, T36], so the subdomain is treated as its own registrable domain and should be verifiable by file. Send the downloaded HTML file to the engineers. They add it **unchanged** to `public/`; Netlify serves real files before the SPA rewrite. Then click **Verify**. If the status is not "Verified" at once, check again the next day.

### 4.5 GTM: what to build (exact names)

Import the **"Facebook Pixel" template by *facebookarchive*** first: **Templates → Tag Templates → Search Gallery → "Facebook Pixel" (facebookarchive) → Add to workspace** [F, T24].

**Built-in variables:** make sure **Event** is ticked (Variables → Configure).

**User-defined variables.** All are **Data Layer Variable, version 2**. Variable name = the key in the right-hand column, default value empty.

| GTM variable name | Data Layer Variable Name |
|---|---|
| `DLV - mk_ga4_id` | `mk_ga4_id` |
| `DLV - mk_gads_id` | `mk_gads_id` |
| `DLV - mk_gads_conversion_id` | `mk_gads_conversion_id` |
| `DLV - mk_gads_label_whatsapp` | `mk_gads_label_whatsapp` |
| `DLV - mk_meta_pixel_id` | `mk_meta_pixel_id` |
| `DLV - mk_send_ga4` | `mk_send_ga4` |
| `DLV - mk_send_ads` | `mk_send_ads` |
| `DLV - mk_send_ads_whatsapp` | `mk_send_ads_whatsapp` |
| `DLV - mk_send_meta` | `mk_send_meta` |
| `DLV - event_id` | `event_id` |
| `DLV - page_location` | `page_location` |
| `DLV - page_title` | `page_title` |
| `DLV - ui_language` | `ui_language` |
| `DLV - cta_location` | `cta_location` |
| `DLV - plan` | `plan` |
| `DLV - lead_source` | `lead_source` |
| `DLV - section` | `section` |
| `DLV - percent_scrolled` | `percent_scrolled` |
| `DLV - lang_from` | `lang_from` |
| `DLV - lang_to` | `lang_to` |

Plus one **Lookup Table** variable: **`LT - GA4 event name`**:
- Input variable: `{{Event}}`
- One row: `cta_whatsapp_click` → `generate_lead`
- Tick **Set Default Value** = `{{Event}}`

**Triggers.** All "Some … Events" conditions use **equals `yes`**.

| Trigger name | Type | Fires on |
|---|---|---|
| `Init - GA4` | Initialization | Some Initialization Events: `DLV - mk_send_ga4` equals `yes` |
| `Init - Google Ads` | Initialization | Some: `DLV - mk_send_ads` equals `yes` |
| `CE - GA4 events` | Custom Event | Event name `^(page_view\|pricing_view\|plan_select\|cta_whatsapp_click\|login_click\|lang_switch\|scroll_depth)$`, **tick "Use regex matching"**. Some Custom Events: `DLV - mk_send_ga4` equals `yes`. |
| `CE - page_view - Ads` | Custom Event | Event name `page_view`. Some: `DLV - mk_send_ads` equals `yes`. |
| `CE - cta_whatsapp_click - Ads` | Custom Event | `cta_whatsapp_click`. Some: `DLV - mk_send_ads_whatsapp` equals `yes`. |
| `CE - page_view - Meta` | Custom Event | `page_view`. Some: `DLV - mk_send_meta` equals `yes`. |
| `CE - pricing_view - Meta` | Custom Event | `pricing_view`. Some: `DLV - mk_send_meta` equals `yes`. |
| `CE - plan_select - Meta` | Custom Event | `plan_select`. Some: `DLV - mk_send_meta` equals `yes`. |
| `CE - cta_whatsapp_click - Meta` | Custom Event | `cta_whatsapp_click`. Some: `DLV - mk_send_meta` equals `yes`. |

**Tags.** Set consent on each tag under **Advanced Settings → Consent Settings → "Require additional consent for tag to fire"** [F, T5]:

| Tag name | Tag type | Configuration | Trigger | Additional consent |
|---|---|---|---|---|
| `GT - GA4` | Google Tag | Tag ID `{{DLV - mk_ga4_id}}`. Configuration parameter `send_page_view` = `false`. | `Init - GA4` | `analytics_storage` |
| `GA4 - event` | Google Analytics: GA4 Event | Measurement ID `{{DLV - mk_ga4_id}}`. Event name `{{LT - GA4 event name}}`. Event parameters (name → value): `page_location` → `{{DLV - page_location}}`, `page_title` → `{{DLV - page_title}}`, `ui_language`, `cta_location`, `plan`, `lead_source`, `section`, `percent_scrolled`, `lang_from`, `lang_to`, each → its DLV. | `CE - GA4 events` | `analytics_storage` |
| `GT - Google Ads` | Google Tag | Tag ID `{{DLV - mk_gads_id}}`. Configuration parameter `send_page_view` = `false`. | `Init - Google Ads` | `ad_storage`, `ad_user_data` |
| `Ads - Conversion Linker` | Conversion Linker | defaults | `CE - page_view - Ads` | `ad_storage` |
| `Ads - Remarketing` | Google Ads Remarketing | Conversion ID `{{DLV - mk_gads_conversion_id}}` | `CE - page_view - Ads` | `ad_storage`, `ad_user_data`, `ad_personalization` |
| `Ads - Conversion - WhatsApp` | Google Ads Conversion Tracking | Conversion ID `{{DLV - mk_gads_conversion_id}}`. Conversion Label `{{DLV - mk_gads_label_whatsapp}}`. Transaction ID `{{DLV - event_id}}`. Value empty. | `CE - cta_whatsapp_click - Ads` | `ad_storage`, `ad_user_data` |
| `Meta - PageView` | Facebook Pixel (facebookarchive) | see the Meta settings below. Event Name: Standard → **PageView** | `CE - page_view - Meta` | `ad_storage`, `ad_user_data` |
| `Meta - ViewContent` | Facebook Pixel | Standard → **ViewContent**. Object properties: `content_name` = `tarifs` | `CE - pricing_view - Meta` | same |
| `Meta - Lead` | Facebook Pixel | Standard → **Lead**. `content_name` = `{{DLV - plan}}` | `CE - plan_select - Meta` | same |
| `Meta - Contact` | Facebook Pixel | Standard → **Contact**. `content_name` = `{{DLV - cta_location}}`, `content_category` = `{{DLV - plan}}` | `CE - cta_whatsapp_click - Meta` | same |

**Meta settings, identical on all four Meta tags** (field names from the template source [F, T24]):

- **Facebook Pixel ID(s)** = `{{DLV - mk_meta_pixel_id}}`. If GTM refuses a variable in this field, paste the literal ID. The `mk_send_meta` flag still gates the tag.
- **Event ID** = `{{DLV - event_id}}`
- **Disable Automatic Configuration: ticked**
- **Disable History Event Tracking: ticked.** We send page views ourselves.
- **Consent Granted (GDPR):** `true`. The tag only ever fires after ads consent.
- **Enable Advanced Matching:** off. **Limited Data Use:** off.
- **"Opt in to a Meta-enabled Conversions API integration": untick.** It is ticked by default. Its behaviour is not documented in the template [F, T24], and we do not need it.

Note: the template may try to load a helper script from `cdn.jsdelivr.net` / `unpkg.com` when Meta enables a server-side switch [F, T24]. The CSP in §5 deliberately does not allow those hosts. Check in §4.7 that `fbevents.js` events still go through. Expect a CSP console warning only.

### 4.6 Netlify environment variables (≈10 min)

1. Netlify → site **libsystem-tn** → **Project configuration → Environment variables** [F, T33] (older UIs say "Site configuration").
2. **Add a variable** for each of the 5 keys in §1.7. Choose **different values per deploy context**: fill in **Production** only, and leave Deploy Previews and Branch deploys empty.
3. **Deploys → Trigger deploy → Deploy site.** Variables only take effect after a new build [F, T33].
4. Check: open `https://<domain>/decouvrir?mk_debug=1` in the test profile. The banner appears, and the console prints `[mk-track]` lines.

### 4.7 Test before publishing the container (≈30 min)

**A. GTM Preview (Tag Assistant)** [F, T6]

1. GTM → **Preview** → enter `https://<domain>/decouvrir` → **Connect**. Do this in the "Mektebti Test" profile. The window opens with `gtm_debug` in the URL, which our code treats as a test override.
2. In the site window: click **Accepter**.
3. In Tag Assistant, check the following:

| Action on the site | Expected in Tag Assistant |
|---|---|
| Load + Accepter | Consent: defaults *denied*, then *granted*. `Init` events: `GT - GA4`, `GT - Google Ads` fired. `page_view`: `GA4 - event`, `Ads - Conversion Linker`, `Ads - Remarketing`, `Meta - PageView` fired. |
| Scroll to the prices | `pricing_view`: `GA4 - event`, `Meta - ViewContent`. `scroll_depth`: `GA4 - event` only. |
| Click the hero WhatsApp button | `cta_whatsapp_click`: `GA4 - event` (name `generate_lead`), `Ads - Conversion - WhatsApp`, `Meta - Contact` |
| Click "Choisir" on À vie | `plan_select` (`Meta - Lead`, `GA4 - event`), then `cta_whatsapp_click` with `plan = life` |
| عربي toggle | `lang_switch`: `GA4 - event` |
| "Se connecter" | `login_click` fires, then the page fully reloads to `/login`. **Tag Assistant must show the container disconnected / no tags on `/login`.** |
| Variables tab on the `Init` event | `DLV - mk_ga4_id` shows your G- ID. If it is empty at Init, tell the engineers (ordering problem, §2.4). |
| Errors | Every Meta tag succeeded, which shows `sandboxedScripts` is allowed. No Custom HTML tags exist. |

4. **GA4 → Admin → DebugView:** the same events appear live, with parameters.
5. **Meta → Events Manager → dataset → Test events:** enter the URL, repeat the clicks, and check that `PageView`, `ViewContent`, `Lead`, `Contact` arrive **with an event ID**.
6. **Meta Pixel Helper / "Meta Ads Data Advisor"** Chrome extension [F, T25]: the badge counts events, and it should show no "duplicate" or "pixel fired multiple times" errors. Disable ad blockers for the test.
7. Refuse test: clear site data, reload, click **Refuser**. In DevTools → Network, filter `google|facebook|doubleclick`: **zero requests.**

**B. Publish:** GTM → **Submit** → version name `v1 – landing tracking (consent basic)` → **Publish**.

**C. Google Ads:** after a real click from an ad, the conversion status moves to "Recording conversions". This can take hours. Until then, Tag Assistant is the proof.

### 4.8 Kill switches

| Need | Do this | Takes effect |
|---|---|---|
| Stop **one** vendor now | GTM: pause the tag(s), or remove the trigger, then **Publish** | Immediately, for everyone |
| Stop **all** tracking now | GTM: **Versions → publish an empty version** (or pause all tags) | Immediately |
| Remove the banner and the code path | Netlify: delete `VITE_GTM_ID` → redeploy | New visitors at once. Returning visitors once their service worker updates (§1.5). |

---

## 5. CSP and headers (`netlify.toml`)

### 5.1 Where things stand today [R]

- `netlify.toml` and `firebase.json` set **no CSP and no security headers**, so **nothing blocks GTM today**. Tracking will work without any header change.
- Adding a CSP is still recommended, since the app holds customer data. Two blockers must be fixed first (§5.2), or the CSP will either be ineffective or break the app.

### 5.2 Prerequisites before any CSP is enforced

1. **The service worker drops the headers** (`scripts/pwa.ts`, `shellResponse()`). Every navigation the worker answers, which is every navigation after the first visit, online or offline, is served from a `new Response(body, { headers: { 'Content-Type' } })`. The CSP, `X-Frame-Options`, `Referrer-Policy` and other headers are therefore lost. **Fix:** copy an allowlist of security headers from the network response (sketch in §6.3). The install-time shell is built the same way, so it gets the same fix. A CSP change in `netlify.toml` alone does not change `sw.js`. Online navigations still pick up the new headers, because `networkShell()` re-caches the shell on every same-build navigation.
2. **An inline script in the QR-label print popup** (`src/features/settings/ServicesTab.tsx` ~line 242): `document.write('…<script>window.onload=function(){window.print()}<\/script>…')`. A `window.open('')` popup inherits the opener's CSP, so a policy without `'unsafe-inline'` silently breaks label printing. **Fix:** remove the inline script and print from the opener once the image has loaded (§6.3).
3. **Netlify joins multi-line header values with commas** [F, T34]. For CSP a comma means *a second policy*, and the browser enforces both. **Always write the CSP on one line.**

### 5.3 The policy

Built from Google's per-product lists [F, T1]. Each Google ccTLD must be listed individually [F, T1, T20]: `google.tn` and `google.fr` (diaspora) are both on Google's supported-domains list. Meta does not publish an official CSP list that we found. The Meta hosts used here are `connect.facebook.net` for scripts (the template injects `fbevents.js` from it [F, T24]) and `www.facebook.com` for event hits [T39, third-party]. Confirm them in Report-Only.

Readable form:

```
default-src 'self';
script-src  'self' https://www.googletagmanager.com https://tagmanager.google.com
            https://www.googleadservices.com https://www.google.com https://connect.facebook.net;
style-src   'self' 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com https://fonts.googleapis.com;
img-src     'self' data: blob: https://www.googletagmanager.com https://ssl.gstatic.com https://www.gstatic.com
            https://*.google-analytics.com https://www.googleadservices.com https://*.g.doubleclick.net
            https://pagead2.googlesyndication.com https://*.google.com https://*.google.tn https://*.google.fr
            https://www.facebook.com;
font-src    'self' data: https://fonts.gstatic.com;
connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com
            https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com
            https://www.googleadservices.com https://*.g.doubleclick.net https://ad.doubleclick.net
            https://pagead2.googlesyndication.com https://*.google.com https://*.google.tn https://*.google.fr
            https://www.facebook.com https://connect.facebook.net;
frame-src   https://www.googletagmanager.com;
worker-src  'self';
manifest-src 'self';
object-src  'none';
base-uri    'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

Why each non-obvious entry is there:

- **Firebase:** `firestore.googleapis.com`, `identitytoolkit.googleapis.com` and `securetoken.googleapis.com` are the hosts found in the built bundle [R, `dist/assets/firebase-*.js`].
  - If **reCAPTCHA protection** is ever switched on for Firebase Auth, also add `https://www.gstatic.com` to `script-src` and `https://www.google.com` to `frame-src`. The bundle references `www.google.com/recaptcha` [R].
- **`style-src 'unsafe-inline'`:** needed by Chakra/Emotion's runtime `<style>` tags, the inline `<style>` in `index.html`, and the print popups.
- **`img-src data: blob:`:** QR labels use `data:` URLs (`src/lib/qr.ts`).
- **`tagmanager.google.com`, `fonts.*`, `gstatic`:** only for GTM **Preview mode** [F, T1]. Keeping them lets the founder debug in production.
- **No `'unsafe-eval'`:** GTM Custom JavaScript variables then evaluate to `undefined` [F, T1]. We do not use them, and they are also blocklisted (§1.6).
- **No `'unsafe-inline'` scripts:** GTM's inline snippet is not used (our code injects `gtm.js` as an external script), and Custom HTML tags cannot run.
- **`cdn.jsdelivr.net` / `unpkg.com` deliberately absent** (Meta template helper, §4.5).

### 5.4 `netlify.toml` additions (for the engineers; CSP in Report-Only first)

```toml
# Security headers for every path. The service worker must pass these through
# (scripts/pwa.ts shellResponse) or they only apply to a first, uncontrolled visit.
# The CSP MUST stay on ONE line: Netlify joins multi-line values with commas,
# and a comma in a CSP starts a second policy.
[[headers]]
  for = "/*"
  [headers.values]
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()"
    Content-Security-Policy-Report-Only = "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://tagmanager.google.com https://www.googleadservices.com https://www.google.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://www.googletagmanager.com https://ssl.gstatic.com https://www.gstatic.com https://*.google-analytics.com https://www.googleadservices.com https://*.g.doubleclick.net https://pagead2.googlesyndication.com https://*.google.com https://*.google.tn https://*.google.fr https://www.facebook.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.googleadservices.com https://*.g.doubleclick.net https://ad.doubleclick.net https://pagead2.googlesyndication.com https://*.google.com https://*.google.tn https://*.google.fr https://www.facebook.com https://connect.facebook.net; frame-src https://www.googletagmanager.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"

# The manifest is currently served as application/octet-stream.
[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Cache-Control = "no-cache"
    Content-Type = "application/manifest+json; charset=utf-8"
```

**Notes:**

- **`Permissions-Policy`:** the app uses a keyboard-wedge scanner and `window.print()`, with no camera, WebUSB or WebSerial [R, grep]. If direct USB/serial printing is ever added, loosen `usb` / `serial` to `(self)`.
- **Rollout:**
  - **Week 0:** headers in Report-Only, plus the §5.2 fixes.
  - **Run through every flow:** login, a sale online, a sale offline, ticket print, invoice print, QR label print, backup download, the dashboard, the landing page with tags accepted, and GTM Preview. Watch the console for CSP reports.
  - **After 1–2 clean weeks:** rename the header to `Content-Security-Policy`.
  - There is no `report-to` endpoint yet. Add one later (a small Netlify Function) only if needed.
- **Check after each deploy:**

  ```
  curl -sI https://libsystem-tn.netlify.app/decouvrir | grep -iE 'content-security|x-frame|referrer|permissions'
  curl -sI https://libsystem-tn.netlify.app/manifest.webmanifest | grep -i content-type
  ```

  The Netlify docs do not say whether overlapping `[[headers]]` rules merge [T34]. Confirm with `curl` that `/index.html` still gets `Cache-Control: no-cache` and the security headers.

---

## 6. Implementation spec (for the engineers)

Estimated **1.5–2 days** including QA [E]. Repository style: no semicolons, single quotes, `@/` alias, comments that explain *why*.

### 6.1 File list

| File | New / edit | Bundle | Purpose |
|---|---|---|---|
| `src/lib/marketingRoutes.ts` | new | main (~0.3 KB) | `MARKETING_PATHS`, `isMarketingPath()`, `tagsLiveInThisDocument()`, `window.__mkTracking` type |
| `src/components/TrackingFirewall.tsx` | new | main | Reloads to a clean document if tags are live on a non-marketing path (invariant I3) |
| `src/features/landing/marketing.ts` | new | marketing chunk | Single dynamic-import entry: re-exports `MarketingLayout` and `LandingPage` (one chunk, no waterfall) |
| `src/features/landing/MarketingLayout.tsx` | new | marketing | Route layout: `TrackingContext`, banner, `<Outlet/>` |
| `src/features/landing/tracking/config.ts` | new | marketing | `readTrackingIds()` |
| `src/features/landing/tracking/dataLayer.ts` | new | marketing | `dataLayer()`, `gtag()` |
| `src/features/landing/tracking/consent.ts` | new | marketing | storage, Consent Mode commands, cookie clearing |
| `src/features/landing/tracking/gtm.ts` | new | marketing | `bootGtm()` |
| `src/features/landing/tracking/events.ts` | new | marketing | `track()`, queue, page context, `campaignRef()` |
| `src/features/landing/tracking/useMarketingTracking.ts` | new | marketing | decision, state machine, page views, scroll depth |
| `src/features/landing/tracking/useScrollDepth.ts` | new | marketing | `useScrollDepth()`, `useSectionView()` |
| `src/features/landing/tracking/ConsentBanner.tsx` + `consent.css` + `consentCopy.ts` | new | marketing | the banner (FR/AR copy from §2.2) |
| `src/App.tsx` | edit | main | layout route for marketing pages, `TrackingFirewall`, one dynamic import |
| `src/auth/RequireAuth.tsx` | edit | main | keep `search` on `/` → `/decouvrir` |
| `src/features/landing/LandingPage.tsx` | edit | marketing | instrument CTAs, full-navigation login link, `pricing_view`, footer "Gérer mes cookies", campaign code in WhatsApp text |
| `src/features/landing/landing.css` | edit | marketing | WhatsApp float moves above the banner (`--mk-consent-offset`), footer link style |
| `src/vite-env.d.ts` | edit | n/a | optional typings for the 5 `VITE_*` IDs |
| `.env.example` | edit | n/a | document the 5 variables (empty) |
| `scripts/qa/check-tracking-isolation.mjs` + `package.json` | new / edit | n/a | build guard (§6.5); Netlify build command becomes `npm run build && npm run check:tracking` |
| `netlify.toml` | edit | n/a | §5.4 headers |
| `scripts/pwa.ts` | edit | sw.js | pass security headers through `shellResponse()` (§5.2) |
| `src/features/settings/ServicesTab.tsx` | edit | app | remove the popup's inline `<script>` (CSP prerequisite) |

### 6.2 Signatures and code sketches

**`src/lib/marketingRoutes.ts`** (main bundle: keep it tiny, with no imports)

```ts
/**
 * The public pages, and the only pages where third-party tags may ever run.
 * Adding a public page = add it here AND under <MarketingLayout> in App.tsx.
 */
export const MARKETING_PATHS = ['/decouvrir', '/confidentialite', '/mentions-legales', '/cgv'] as const

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | IArguments>
    /** Set the moment a third-party tag script is injected into THIS document. Never cleared. */
    __mkTracking?: 'loading' | 'loaded' | 'failed'
  }
}

export function tagsLiveInThisDocument(): boolean {
  return window.__mkTracking !== undefined
}
```

**`src/components/TrackingFirewall.tsx`**

```tsx
import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isMarketingPath, tagsLiveInThisDocument } from '@/lib/marketingRoutes'

/**
 * GTM cannot be unloaded. If a visitor walks from a marketing page into the app
 * inside the same document (any SPA link we forgot to make a full navigation),
 * reload so the app screen never shares a document with third-party code.
 * Layout effect: runs before the app route paints. The reload goes through the
 * service worker like any F5, so it works offline too.
 */
export function TrackingFirewall() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    if (tagsLiveInThisDocument() && !isMarketingPath(pathname)) window.location.reload()
  }, [pathname])
  return null
}
```

**`tracking/config.ts`**

```ts
export interface TrackingIds {
  gtmId: string
  ga4Id: string            // '' when unset or malformed
  gadsId: string           // 'AW-123456789' or ''
  gadsConversionId: string // '123456789' (GTM's Ads tags want the number) or ''
  gadsLabelWhatsapp: string
  metaPixelId: string
}

const pick = (raw: string | undefined, re: RegExp) => {
  const v = (raw ?? '').trim()
  return re.test(v) ? v : ''
}

/** null = tracking is OFF for this build. Never throws. Literal env reads so Vite inlines them. */
export function readTrackingIds(): TrackingIds | null {
  const gtmId = pick(import.meta.env.VITE_GTM_ID, /^GTM-[A-Z0-9]{4,12}$/)
  if (!gtmId) return null
  const gadsId = pick(import.meta.env.VITE_GADS_ID, /^AW-\d{6,14}$/)
  return {
    gtmId,
    ga4Id: pick(import.meta.env.VITE_GA4_ID, /^G-[A-Z0-9]{4,16}$/),
    gadsId,
    gadsConversionId: gadsId ? gadsId.slice(3) : '',
    gadsLabelWhatsapp: gadsId ? pick(import.meta.env.VITE_GADS_CONV_LABEL_WHATSAPP, /^[\w-]{6,40}$/) : '',
    metaPixelId: pick(import.meta.env.VITE_META_PIXEL_ID, /^\d{8,20}$/),
  }
}
```

**`tracking/dataLayer.ts`**

```ts
export function dataLayer() {
  // Never reassign an existing dataLayer (Google: it wipes queued messages).
  return (window.dataLayer = window.dataLayer || [])
}

/**
 * Google's gtag(). It MUST push the `arguments` object itself: Consent Mode
 * ignores a plain array. Hence a function declaration, not an arrow.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  dataLayer().push(arguments)
}
```

**`tracking/consent.ts`**

```ts
export interface ConsentChoice { v: number; analytics: boolean; ads: boolean; at: string }

export const CONSENT_KEY = 'mk:consent'
/** Bump when a vendor or purpose is added: everyone is asked again. */
export const CONSENT_VERSION = 1
const MAX_AGE_MS = 180 * 24 * 3600 * 1000

export function readConsent(): ConsentChoice | null           // null = undecided / expired / old version / storage blocked
export function storeConsent(analytics: boolean, ads: boolean): ConsentChoice

let defaulted = false
export function pushConsentDefault(): void {
  if (defaulted) return // once per document; StrictMode and layout remounts call twice
  defaulted = true
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500,
  })
  gtag('set', 'ads_data_redaction', true)
  gtag('set', 'url_passthrough', false)
}

const g = (b: boolean) => (b ? 'granted' : 'denied')
export function pushConsentUpdate(c: Pick<ConsentChoice, 'analytics' | 'ads'>): void {
  gtag('consent', 'update', {
    analytics_storage: g(c.analytics),
    ad_storage: g(c.ads), ad_user_data: g(c.ads), ad_personalization: g(c.ads),
  })
  dataLayer().push({ event: 'consent_update', consent_analytics: g(c.analytics), consent_ads: g(c.ads) })
}

const TRACKING_COOKIE = /^(_ga|_ga_.+|_gid|_gcl_.+|_fbp|_fbc)$/
/** Best effort: deletes on the host and its parent; a public-suffix parent is simply refused by the browser. */
export function clearTrackingCookies(): void {
  const host = location.hostname
  const parent = host.split('.').slice(-2).join('.')
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (!TRACKING_COOKIE.test(name)) continue
    for (const domain of ['', host, '.' + host, '.' + parent]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? '; domain=' + domain : ''}`
    }
  }
}
```

**`tracking/gtm.ts`**

```ts
/**
 * Pushes the config and the container start event NOW (so they sit in the
 * dataLayer ahead of every queued event, which is the order GTM processes),
 * and injects the script now or when the browser is idle.
 */
export function bootGtm(ids: TrackingIds, c: ConsentChoice, opts: { defer: boolean }): void {
  if (window.__mkTracking) return // once per document
  window.__mkTracking = 'loading'
  const yes = (b: boolean) => (b ? 'yes' : 'no')
  const dl = dataLayer()
  dl.push({
    'gtm.allowlist': ['sandboxedScripts'], // gallery templates (Meta) may run…
    'gtm.blocklist': ['customScripts'],    // …Custom HTML and Custom JS variables may not
    mk_ga4_id: ids.ga4Id,
    mk_gads_id: ids.gadsId,
    mk_gads_conversion_id: ids.gadsConversionId,
    mk_gads_label_whatsapp: ids.gadsLabelWhatsapp,
    mk_meta_pixel_id: ids.metaPixelId,
    mk_send_ga4: yes(!!ids.ga4Id && c.analytics),
    mk_send_ads: yes(!!ids.gadsId && c.ads),
    mk_send_ads_whatsapp: yes(!!ids.gadsId && !!ids.gadsLabelWhatsapp && c.ads),
    mk_send_meta: yes(!!ids.metaPixelId && c.ads),
  })
  dl.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const inject = () => {
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(ids.gtmId)
    s.onload = () => { window.__mkTracking = 'loaded' }
    // Offline or an ad blocker: nothing to retry, nothing to show.
    s.onerror = () => { window.__mkTracking = 'failed' }
    document.head.appendChild(s)
  }
  if (!opts.defer) return inject()
  // Returning visitor: never compete with the landing page's first paint on 3G.
  const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(inject, { timeout: 4000 }) : window.setTimeout(inject, 2000))
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
}
```

**`tracking/events.ts`**

```ts
export type CtaLocation = 'hero' | 'pricing' | 'final' | 'final_phone' | 'float' | 'nav'
export type MkEvent =
  | { event: 'page_view' }
  | { event: 'pricing_view'; section: 'tarifs' }
  | { event: 'plan_select'; plan: string }
  | { event: 'cta_whatsapp_click'; cta_location: CtaLocation; plan?: string }
  | { event: 'login_click'; cta_location: 'nav' }
  | { event: 'lang_switch'; lang_from: 'fr' | 'ar'; lang_to: 'fr' | 'ar' }
  | { event: 'scroll_depth'; percent_scrolled: 25 | 50 | 75 | 90 }

type State = 'off' | 'pending' | 'on'
let state: State = 'off'
const queue: Record<string, unknown>[] = []
const MAX_QUEUE = 30

/** 'pending' = banner unanswered: events wait in memory and are dropped on refusal. */
export function setTrackingState(next: State): void {
  state = next
  if (next === 'on') for (const e of queue.splice(0)) dataLayer().push(e)
  if (next === 'off') queue.length = 0
}

/** Every key any event can carry, reset each push (GTM's data model is persistent). */
const RESET = { cta_location: undefined, plan: undefined, lead_source: undefined, section: undefined,
  percent_scrolled: undefined, lang_from: undefined, lang_to: undefined }

export function track(e: MkEvent, then?: () => void): void {
  const payload: Record<string, unknown> = {
    ...RESET,
    ...(e.event === 'cta_whatsapp_click' ? { lead_source: 'whatsapp' } : null),
    ...e,
    event_id: newEventId(),
    page_location: cleanLocation(),
    page_path: location.pathname,
    page_title: document.title,
    ui_language: document.documentElement.lang === 'ar' ? 'ar' : 'fr',
  }
  if (isDebug()) console.info('[mk-track]', state, payload)
  if (state === 'pending') {
    if (queue.length < MAX_QUEUE) queue.push(payload)
  } else if (state === 'on') {
    if (then) {
      const go = once(then)
      payload.eventCallback = go // GTM calls it after the event's tags have run…
      payload.eventTimeout = 400
      window.setTimeout(go, 600)  // …and this covers GTM blocked, slow or absent
    }
    dataLayer().push(payload)
    return
  }
  then?.()
}

export function cleanLocation(href = location.href): string  // origin + path + allowlisted params (section 3.1)
export function campaignRef(search: string): string           // section 2.6; '' when nothing applies
function newEventId(): string                                 // crypto.randomUUID() with a Math.random fallback
function isDebug(): boolean                                   // ?mk_debug=1 → sessionStorage 'mk:debug'
function once(fn: () => void): () => void
```

**`tracking/useMarketingTracking.ts`**

```ts
export type TrackingStatus = 'off' | 'ask' | 'on' | 'refused'
export interface TrackingApi {
  status: TrackingStatus
  /** banner visible: first visit, or reopened from the footer */
  bannerOpen: boolean
  /** true while events are being recorded or queued (ask | on) */
  active: boolean
  current: ConsentChoice | null
  decide(analytics: boolean, ads: boolean): void
  openPanel(): void
  closePanel(): void
}
export const TRACKING_OFF: TrackingApi // status 'off', no-op functions

export function useMarketingTracking(): TrackingApi {
  const { user, loading } = useAuth()
  const location = useLocation()
  const ids = useMemo(readTrackingIds, [])
  const allowed = ids !== null && !loading && !user && isMarketingPath(location.pathname) && deviceMayTrack()
  const [status, setStatus] = useState<TrackingStatus>('off')
  const [panel, setPanel] = useState(false)
  const [current, setCurrent] = useState<ConsentChoice | null>(null)

  // A session appearing here or in another tab while tags run: get a clean document now.
  useEffect(() => {
    if (user && tagsLiveInThisDocument()) window.location.reload()
  }, [user])

  // Decide once auth has settled.
  useEffect(() => {
    if (!allowed || !ids) { setTrackingState('off'); setStatus('off'); return }
    pushConsentDefault()
    const stored = readConsent()
    setCurrent(stored)
    if (!stored) { setTrackingState('pending'); setStatus('ask'); return }
    if (!stored.analytics && !stored.ads) { setTrackingState('off'); setStatus('refused'); return }
    pushConsentUpdate(stored)
    bootGtm(ids, stored, { defer: true }) // config + gtm.js pushed now, script at idle
    setTrackingState('on')
    setStatus('on')
  }, [allowed, ids])

  const decide = useCallback((analytics: boolean, ads: boolean) => {
    const choice = storeConsent(analytics, ads)
    setCurrent(choice)
    setPanel(false)
    if (tagsLiveInThisDocument()) {
      // Tags cannot be reconfigured or unloaded in place: reset with a reload.
      if (!analytics || !ads) clearTrackingCookies()
      window.location.reload()
      return
    }
    if (!ids || (!analytics && !ads)) { setTrackingState('off'); setStatus('refused'); return }
    pushConsentUpdate(choice)
    bootGtm(ids, choice, { defer: false })
    setTrackingState('on') // flushes the page_view etc. queued while the banner was up
    setStatus('on')
  }, [ids])

  const active = status === 'ask' || status === 'on'

  // Virtual page views: once per history entry, StrictMode-safe.
  const lastKey = useRef<string | null>(null)
  useEffect(() => {
    if (!active || lastKey.current === location.key) return
    lastKey.current = location.key
    track({ event: 'page_view' })
  }, [active, location.key])

  useScrollDepth(active, location.key)

  return { status, active, current, decide, bannerOpen: status === 'ask' || panel,
           openPanel: () => setPanel(true), closePanel: () => setPanel(false) }
}

/** §1.3: shop machine, opt-out, dev, and the test override. */
function deviceMayTrack(): boolean {
  const q = new URLSearchParams(location.search)
  try {
    if (q.get('mk_notrack') === '1') localStorage.setItem('mk:noTrack', '1')
    if (q.get('mk_notrack') === '0') localStorage.removeItem('mk:noTrack')
    if (q.has('mk_track') || q.has('gtm_debug')) sessionStorage.setItem('mk:forceTrack', '1')
    if (sessionStorage.getItem('mk:forceTrack') === '1') return true
    if (localStorage.getItem('mk:noTrack') === '1') return false
  } catch {
    /* storage blocked: fall through to the defaults */
  }
  if (import.meta.env.DEV) return false
  return !isShopMachine()
}
```

**`tracking/useScrollDepth.ts`**

```ts
export function useScrollDepth(active: boolean, resetKey: string): void {
  useEffect(() => {
    if (!active) return
    const fired = new Set<number>()
    let raf = 0
    const check = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const pct = max <= 0 ? 100 : (window.scrollY / max) * 100
      for (const t of [25, 50, 75, 90] as const) {
        if (pct >= t && !fired.has(t)) { fired.add(t); track({ event: 'scroll_depth', percent_scrolled: t }) }
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [active, resetKey])
}

/** Fires `onSeen` once when the element is at least half visible. */
export function useSectionView(id: string, active: boolean, onSeen: () => void): void
```

**`MarketingLayout.tsx` and `ConsentBanner.tsx`**

```tsx
const TrackingContext = createContext<TrackingApi>(TRACKING_OFF)
export const useTracking = () => useContext(TrackingContext)

export function MarketingLayout() {
  const tracking = useMarketingTracking()
  return (
    <TrackingContext.Provider value={tracking}>
      <Outlet />
      {tracking.bannerOpen ? <ConsentBanner api={tracking} /> : null}
    </TrackingContext.Provider>
  )
}

export function ConsentBanner({ api }: { api: TrackingApi }) {
  const { i18n } = useTranslation()
  const c = CONSENT_COPY[i18n.language === 'ar' ? 'ar' : 'fr']
  const [details, setDetails] = useState(api.status !== 'ask') // from the footer: straight to the switches
  const [analytics, setAnalytics] = useState(api.current?.analytics ?? false)
  const [ads, setAds] = useState(api.current?.ads ?? false)
  // ResizeObserver → document.body.style.setProperty('--mk-consent-offset', `${height}px`) and reset on unmount
  return (
    <section className="mkc" role="dialog" aria-modal="false" aria-labelledby="mkc-title">
      <h2 id="mkc-title">{c.title}</h2>
      <p>{c.body} <Link to="/confidentialite#cookies">{c.more}</Link></p>
      {details ? (/* two labelled checkboxes (analytics, ads) with their help text */ null) : null}
      <div className="mkc-actions">{/* three buttons, SAME class: */}
        <button className="mkc-btn" onClick={() => api.decide(false, false)}>{c.refuse}</button>
        {details
          ? <button className="mkc-btn" onClick={() => api.decide(analytics, ads)}>{c.save}</button>
          : <button className="mkc-btn" onClick={() => setDetails(true)}>{c.customize}</button>}
        <button className="mkc-btn" onClick={() => api.decide(true, true)}>{c.accept}</button>
      </div>
    </section>
  )
}
```

### 6.3 Changes to existing files

**`src/App.tsx`**: one dynamic import for the layout and the page, a layout route, and the firewall:

```tsx
const loadMarketing = () => import('@/features/landing/marketing') // re-exports both
const MarketingLayout = lazy(() => loadMarketing().then((m) => ({ default: m.MarketingLayout })))
const LandingPage = lazy(() => loadMarketing().then((m) => ({ default: m.LandingPage })))
// …
<BrowserRouter>
  <TrackingFirewall />
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Suspense fallback={<PageFallback />}><MarketingLayout /></Suspense>}>
      <Route path="/decouvrir" element={<Suspense fallback={<PageFallback />}><LandingPage /></Suspense>} />
      {/* future public pages go here AND in MARKETING_PATHS */}
    </Route>
    {/* app routes unchanged */}
```

Never import anything from `features/landing/tracking` in `main.tsx`, `App.tsx` or any app component. The build guard catches it.

**`src/auth/RequireAuth.tsx`** (attribution bug, §0 point 7):

```tsx
const { pathname, search } = useLocation()
if (!user) {
  if (pathname === '/' && !isShopMachine()) return <Navigate to={{ pathname: '/decouvrir', search }} replace />
  return <Navigate to="/login" replace />
}
```

The catch-all `<Route path="*" element={<Navigate to="/" replace />} />` also drops the query. It is minor (only mistyped URLs hit it), but pass `search` through the same way.

**`src/features/landing/LandingPage.tsx`:**

- `const tracking = useTracking()`; `useSectionView('tarifs', tracking.active, () => track({ event: 'pricing_view', section: 'tarifs' }))`.
- Read the campaign code once: `const ref = useMemo(() => campaignRef(location.search), [])`. `waLink(text)` appends ``\n\n(réf. ${ref})`` when `ref` is non-empty ([D] §2.6).
- WhatsApp anchors: `onClick={() => track({ event: 'cta_whatsapp_click', cta_location: 'hero' })}`. Use `'final'`, `'final_phone'` and `'float'` for the other three.
- Plan buttons: `onClick={() => { track({ event: 'plan_select', plan: p.id }); track({ event: 'cta_whatsapp_click', cta_location: 'pricing', plan: p.id }) }}`.
- Language toggle: `track({ event: 'lang_switch', lang_from: lang, lang_to: next })` before `i18n.changeLanguage(next)`.
- **Login: replace `<Link to="/login">` with a full navigation:**

  ```tsx
  <a href="/login" className="mk-btn mk-btn-ghost mk-btn-sm" onClick={(ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return // new tab: let the browser do it
    ev.preventDefault()
    track({ event: 'login_click', cta_location: 'nav' }, () => window.location.assign('/login'))
  }}>{c.nav.login}</a>
  ```

- Footer: `{tracking.status !== 'off' ? <button type="button" className="mk-footer-link" onClick={tracking.openPanel}>{consentCopy.manage}</button> : null}`.
- CSS: `.mk-wa-float { bottom: calc(1rem + var(--mk-consent-offset, 0px)) }`.

**`src/vite-env.d.ts`:** add `readonly VITE_GTM_ID?: string` and the same for the other four.

**`.env.example`:** add a "Marketing tracking (public pages only)" block with the 5 keys left empty. Add a comment: "leave empty locally; set in Netlify for the Production context only".

**`scripts/pwa.ts`** (CSP prerequisite):

```js
// in the generated worker
const PASS_HEADERS = ['Content-Security-Policy', 'Content-Security-Policy-Report-Only', 'X-Frame-Options',
                      'Referrer-Policy', 'Permissions-Policy', 'X-Content-Type-Options']
function shellResponse(body, res) {
  const headers = { 'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8' }
  for (const h of PASS_HEADERS) { const v = res.headers.get(h); if (v) headers[h] = v }
  return new Response(body, { status: 200, headers })
}
```

Update the comment above `shellResponse()` to explain why these headers, and only these, survive.

**`src/features/settings/ServicesTab.tsx`** (CSP prerequisite): drop the `<script>window.onload=…</script>` from the written markup. After `w.document.close()`:

```ts
const img = w.document.images[0]
const go = () => { w.focus(); w.print() }
if (!img || img.complete) go()
else img.addEventListener('load', go, { once: true })
```

**Optional:** `markShopMachine()` (on login) can call a tiny cookie cleaner, so a prospect who becomes a client does not carry `_ga` / `_fbp` cookies into the app's origin. They are harmless, since no tag ever reads them there, but keeping them is untidy.

### 6.4 Behaviour table (what QA should observe)

| Situation | Banner | Third-party requests | `window.dataLayer` |
|---|---|---|---|
| `VITE_GTM_ID` unset | no | none | `undefined` |
| Shop machine / PWA / signed in / `mk_notrack` | no | none | `undefined` |
| First visit, banner unanswered | yes | **none** | consent default + queued events in memory only |
| Refused | no ("Gérer mes cookies" in footer) | **none** | consent default only |
| Accepted (now or stored) | no | GTM → GA4 / Ads / Meta per flags | full sequence §2.4 |
| Accepted, then "Se connecter" | n/a | none on `/login` (fresh document) | `undefined` on `/login` |
| Any app route (`/caisse`…) | never | only self + Firebase | `undefined` |
| Offline, accepted visitor | no | `gtm.js` fails quietly | pushes stay in an array |

### 6.5 Build guard: `scripts/qa/check-tracking-isolation.mjs`

```js
// Fails the build if third-party tag code can reach the till: index.html or the boot set.
import { readFileSync, readdirSync } from 'node:fs'
const dist = new URL('../../dist/', import.meta.url)
const MARKERS = ['googletagmanager.com', 'connect.facebook.net', 'fbevents']
const read = (p) => readFileSync(new URL(p, dist), 'utf8')
const fail = (m) => { console.error('tracking isolation: ' + m); process.exitCode = 1 }

const html = read('index.html')
for (const m of MARKERS) if (html.includes(m)) fail(`index.html mentions ${m}`)

// ESSENTIAL is the till's all-or-nothing boot set, emitted by scripts/pwa.ts as JSON.
const essential = JSON.parse(read('sw.js').match(/const ESSENTIAL = (\[[\s\S]*?\])/)[1])
for (const url of essential) {
  const body = read('.' + url)
  for (const m of MARKERS) if (body.includes(m)) fail(`${url} is in the boot set and mentions ${m}`)
}
const tagged = readdirSync(new URL('assets/', dist))
  .filter((f) => f.endsWith('.js') && MARKERS.some((m) => read('assets/' + f).includes(m)))
console.log('chunks able to load third-party tags:', tagged.join(', ') || '(none)')
```

In `package.json`: `"check:tracking": "node scripts/qa/check-tracking-isolation.mjs"`. In `netlify.toml`: `command = "npm run build && npm run check:tracking"`. Against today's `dist/`, no file contains the markers [R, checked], so the guard passes now. After the change it should list exactly one chunk, the marketing chunk.

### 6.6 QA checklist (engineers, before handing over to the founder)

- [ ] `npm run build` with no tracking vars: the guard passes. `/decouvrir` shows no banner, has no `window.dataLayer`, and makes no third-party requests.
- [ ] Local prod build with fake IDs: `VITE_GTM_ID=GTM-TEST000 npm run build && npx vite preview`, then open `/decouvrir?mk_track=1&mk_debug=1`.
  - The banner appears in FR, and in AR after the toggle (RTL, 320 px, keyboard).
  - Before any click: zero third-party requests.
  - Accepter: the `dataLayer` order matches §2.4. `gtm.js` is requested (it may 404 for the fake ID; that is fine).
  - Refuser, then reload: no banner, no requests.
  - "Gérer mes cookies" → withdraw: cookies cleared, page reloads, no requests.
- [ ] `/?gclid=TEST&utm_campaign=x` in a fresh profile lands on `/decouvrir?gclid=TEST&utm_campaign=x`. The WhatsApp text ends with `(réf. x)`.
- [ ] "Se connecter" after accepting: a full reload. On `/login`, `window.google_tag_manager` is undefined.
- [ ] Sign in once, sign out, open `/decouvrir`: no banner, no requests (shop machine).
- [ ] Installed PWA: `/decouvrir` shows no banner.
- [ ] `/caisse` network panel: only self, `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`.
- [ ] DevTools offline, then reload `/decouvrir` with a stored acceptance: the page renders. The only error is the `gtm.js` network failure.
- [ ] Lighthouse mobile on `/decouvrir`: LCP and CLS are not worse than before. The banner is fixed-position, and `gtm.js` is deferred to idle for returning visitors.
- [ ] Headers (§5.4) visible with `curl -sI`. With the `pwa.ts` change, the same headers also appear on a worker-served navigation (DevTools → Network → document → Response headers).

### 6.7 Phase 2 (later): Meta Conversions API via a Netlify Function

Worth doing only once Meta campaigns have run 2–4 weeks and Events Manager shows browser events being lost [E]. There is no form on the page, so the server event carries only IP, user agent, `_fbp` and `_fbc`. Expect a modest match-quality gain, not a revolution.

- **Endpoint:** `netlify/functions/meta-capi.mts`, served at `/api/meta-capi` (covered by `connect-src 'self'`).
- **Client:** in `track()`, when `mk_send_meta === 'yes'` and the event maps to `PageView | ViewContent | Lead | Contact`, call `navigator.sendBeacon('/api/meta-capi', JSON.stringify({ event_name, event_id, event_source_url, fbp, fbc }))`. Use the same `event_id` as the pixel, so Meta deduplicates them: event name + event ID must match, and the window is 48 hours [F, T27].
- **Server:**
  - Allowlist the event names, check the `Origin` header, and cap the body at 2 KB.
  - Add `event_time` (seconds; at most 7 days old [F, T28]), `action_source: 'website'`, `event_source_url` (required for website events [F, T28]), and `user_data.client_user_agent` (required for website events [F, T29]).
  - Add `client_ip_address` from the request. **Never hash** IP, user agent, `fbp` or `fbc` [F, T29].
  - POST to the Graph API `/{PIXEL_ID}/events` with `access_token`, using the current API version shown in Events Manager.
- **Secrets:** `META_CAPI_TOKEN` (no `VITE_` prefix), scope Functions only, never committed.
- **Off-site conversions:** uploading "signed customer" events with hashed phone numbers from WhatsApp would let Meta optimise for real buyers. It is an advertising use of personal data, so it needs **express consent under art. 30**. Get the lawyer's view first [D].

---

## 7. Decisions for the founder

1. **[D1] Domain before ads:** start ads on `libsystem-tn.netlify.app` or on `mektebti.tn`? Recommendation: `mektebti.tn`, with marketing and app on separate origins soon after (§1.6).
2. **[D2] Consent mode:** basic (no tags before consent; recommended; built here) or advanced (cookieless Google pings before consent; better modelling; needs the lawyer's agreement) [T3].
3. **[D3] WhatsApp campaign code** in the pre-filled message (§2.6): recommended yes.
4. **[D4] Values:** no monetary value per WhatsApp lead at launch (recommended), or a fixed estimated value in Google Ads and Meta.
5. **[D5] Google Ads billing currency** (permanent [T11]): TND if offered for your account, otherwise EUR or USD.
6. **[D6] GA4 settings:** 14-month retention (recommended); Google signals off (recommended for now).
7. **[D7] Access:** who may publish GTM (recommended: founder only). 2FA on Google and Meta.
8. **[D8] Go-live gate:** IDs go into Netlify only after `/confidentialite` (privacy and cookie policy, doc 02 §6.3) is published, and after the AR banner text has been checked by a native speaker and the lawyer.
9. **[D9] Consent duration:** re-ask after 180 days (our default), or another value from the lawyer. A server-side consent log only if the lawyer requires it.
10. **[D10] Meta optimisation:** optimise for `Contact` (recommended), and decide whether to also run Click-to-WhatsApp ads, which bypass the site and this pixel.
11. **[D11] Phase 2:** Meta Conversions API (§6.7) and off-site conversion uploads with hashed phones (lawyer first).

---

## 8. Sources (checked 15 October 2026)

| ID | Source |
|---|---|
| T1 | Google — Content Security Policy guide for Tag Manager, GA, Ads: <https://developers.google.com/tag-platform/security/guides/csp> |
| T2 | Google — Implement consent mode (default/update syntax, ordering, `ads_data_redaction`, `url_passthrough`, `wait_for_update`): <https://developers.google.com/tag-platform/security/guides/consent> |
| T3 | Google — Consent mode concepts (basic vs advanced, cookieless pings, tags with built-in checks): <https://developers.google.com/tag-platform/security/concepts/consent-mode> |
| T4 | Google — Restrict tag deployment (`gtm.allowlist` / `gtm.blocklist`, `customScripts`, `sandboxedScripts`): <https://developers.google.com/tag-platform/tag-manager/web/restrict> |
| T5 | Google Tag Manager Help — Consent configuration (Consent Initialization trigger, "Require additional consent", consent overview): <https://support.google.com/tagmanager/answer/10718549> |
| T6 | Google Tag Manager Help — Preview and debug containers (Tag Assistant): <https://support.google.com/tagmanager/answer/6107056> |
| T7 | Google Tag Manager Help — Google Ads conversion tracking tag (Conversion ID / Label): <https://support.google.com/tagmanager/answer/6105160> |
| T8 | Google Ads Help — Set up conversion tracking for your website: <https://support.google.com/google-ads/answer/12216226> |
| T9 | Google Ads Help — About updated conversion categories (incl. "Contact"): <https://support.google.com/google-ads/answer/9791434> |
| T10 | Google Ads Help — Conversion counting options ("One" recommended for leads): <https://support.google.com/google-ads/answer/3438531> |
| T11 | Google Ads Help — Language, time zone and currency settings (currency permanent): <https://support.google.com/google-ads/answer/9842104> |
| T12 | Google Analytics — Recommended events reference (`generate_lead`): <https://developers.google.com/analytics/devguides/collection/ga4/reference/events> |
| T13 | Google Analytics Help — Event naming rules and reserved names: <https://support.google.com/analytics/answer/13316687> |
| T14 | Google Analytics Help — Event collection limits: <https://support.google.com/analytics/answer/9267744> |
| T15 | Google Analytics Help — Enhanced measurement: <https://support.google.com/analytics/answer/9216061> |
| T16 | Google Analytics Help — GA4 cookie usage (`_ga`, `_ga_<id>`): <https://support.google.com/analytics/answer/11397207> |
| T17 | Google Analytics Help — IP anonymisation (GA4 does not log or store IPs): <https://support.google.com/analytics/answer/2763052> |
| T18 | Google Analytics Help — Supported currencies (TND listed): <https://support.google.com/analytics/answer/9796179> |
| T19 | Google — How Google uses cookies (`_gcl_` family, 90 days): <https://policies.google.com/technologies/cookies> |
| T20 | Google — Supported domains (`.google.tn`, `.google.fr`): <https://www.google.com/supported_domains> |
| T21 | Google — The data layer (initialise above the container, never reassign): <https://developers.google.com/tag-platform/tag-manager/datalayer> |
| T22 | Meta — Pixel standard events reference (Contact, Lead, ViewContent): <https://developers.facebook.com/docs/meta-pixel/reference> |
| T23 | Meta — Pixel consent (`fbq('consent','revoke'/'grant')`): <https://developers.facebook.com/docs/meta-pixel/implementation/gdpr> |
| T24 | Meta (facebookarchive) — GTM web template for the Facebook Pixel, `template.tpl` (fields, injected scripts): <https://github.com/facebookarchive/GoogleTagManager-WebTemplate-For-FacebookPixel> |
| T25 | Meta — Pixel Helper / Meta Ads Data Advisor: <https://developers.facebook.com/docs/meta-pixel/support/pixel-helper> |
| T26 | Meta — Domain verification (HTML file in web root, DNS TXT): <https://developers.facebook.com/docs/sharing/domain-verification/> |
| T27 | Meta — Deduplicate Pixel and server events: <https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events> |
| T28 | Meta — Conversions API server event parameters: <https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event> |
| T29 | Meta — Conversions API customer information parameters (`client_user_agent`, `_fbp`, `_fbc`, no hashing): <https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters> |
| T30 | Hostinger Help (third-party) — Meta pixel traffic permissions (allow/block list): <https://www.hostinger.com/support/?p=895> |
| T31 | IONOS Digital Guide (third-party) — Facebook domain verification, meta-tag method ("paste the meta tag inside the `<head>`"): <https://www.ionos.com/digitalguide/domains/domain-tips/facebook-domain-verification/> |
| T32 | TripleDart (third-party) — Dynamic URL parameters in Meta ads: <https://www.tripledart.com/marketing-tutorials/how-to-add-dynamic-url-parameters-to-meta-ads> |
| T33 | Netlify Docs — Environment variables (contexts, redeploy needed): <https://docs.netlify.com/build/environment-variables/get-started/> |
| T34 | Netlify Docs — Custom headers (multi-line values are comma-joined): <https://docs.netlify.com/manage/routing/headers/> |
| T35 | Vite — Env variables and modes (`VITE_` exposure, typing): <https://vite.dev/guide/env-and-mode> |
| T36 | Public Suffix List (`netlify.app` listed under Netlify): <https://publicsuffix.org/list/public_suffix_list.dat> |
| T37 | This repo — `docs/launch/02-legal-fiscal-compliance.md` §5.4 and §6.5, with its sources (Loi organique 2004-63, Meta Business Tools Terms, Google EU User Consent Policy) |
| T38 | Measured on 15 Oct 2026 with `curl` (raw / compressed bytes): `https://connect.facebook.net/en_US/fbevents.js` 433,365 / 113,993; `https://www.googletagmanager.com/gtag/js?id=…` 439,224 / 151,687; `https://www.googletagmanager.com/gtm.js?id=…` 243,842 / 88,857. Container-specific sizes will differ. |
| T39 | Infomaniak FAQ (third-party) — CSP hosts for the Meta pixel (`connect.facebook.net`, `www.facebook.com`): <https://www.infomaniak.com/en/support/faq/2664/ticketing-add-a-meta-google-tracker-to-the-store> |
