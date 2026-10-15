# 07 — Web launch notes: landing, SEO, tracking, Netlify

| | |
| --- | --- |
| Date | 15 October 2026 |
| Scope | What the "web" workstream changed, the Netlify variables to set, and the manual steps only the founder can do |
| Builds on | 02 (legal), 04 (marketing/SEO), 05 (tracking), and the web audit findings |

## 1. What changed, in one screen

- **`/decouvrir` and `/ar/decouvrir` are now static HTML**, prerendered at build time from the same `LandingPage` component (`scripts/landing.ts`, `src/features/landing/prerender.tsx`). A prospect downloads about 14 KB of HTML (gzip, CSS inlined), one ~4 KB script and the logos: no React, Chakra, Firebase or service worker. Crawlers and WhatsApp/Facebook previews get the real text, title, description, canonical, hreflang, Open Graph/Twitter tags (`/brand/og-image-fr.png`, `og-image-ar.png`) and JSON-LD (Organization, WebSite, SoftwareApplication with the three offers in TND, FAQPage).
- **Arabic has its own URL**, `/ar/decouvrir`. The language link on each page goes to the other one.
- **The bare domain** sends a visitor who never signed in on this browser to `/decouvrir` *before* the till's code downloads, keeping `?gclid=…&utm_…` (inline script in `index.html`). A till (anybody ever signed in, or the installed app) carries on to the app as before.
- **Draft legal pages**: `/mentions-legales`, `/confidentialite` (with the cookie list at `#cookies`), `/cgv`. French only, marked "version provisoire", every unknown in `[brackets]` highlighted, `noindex`, not in the sitemap.
- **Landing copy**: short FAQ (internet cuts, own scanner/printer, payment, data safety, contract, which PC), footer with legal links, « Demander une démo » instead of « Essayer », « Payez une seule fois » instead of « Le plus rentable », the 500 DT setup now says it includes the scanner and the ticket printer, « Hors ligne » instead of « 100 % utilisable hors ligne », a `tel:` link, accessibility fixes (comparison table labels, focus ring, contrast, `<main>`, skip link, language link names). Prices unchanged: 83 DT/mois + 500 DT, 1er mois offert; 2 000 DT/an; 3 400 DT à vie.
- **Tracking** (`src/lib/analytics.ts`, banner in `src/features/landing/consent.ts`): GTM and, through it, GA4 / Google Ads / Meta Pixel, exactly as designed in doc 05. Public pages only, only when `VITE_GTM_ID` is set, never on a browser where anybody signed in, Consent Mode v2 default *denied*, and GTM is not even requested before « Accepter ». The build fails if tag code becomes reachable from the till (`scripts/pwa.ts`).
- **Netlify**: all routing in `netlify.toml` (`public/_redirects` deleted: it shadowed every rule), real 404s for missing `/assets/*`, `/brand/*`, `/_m/*`; real `robots.txt` and `sitemap.xml` (generated with the site URL); manifest served as `application/manifest+json`; HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, `X-Frame-Options` + `frame-ancestors 'self'`; a day of caching for `/brand/*`. **The build now fails on Netlify when a `VITE_FIREBASE_*` value is missing** (it used to ship the "setup needed" screen to every till).
- **Till**: the service worker precaches the brand PNGs (logo no longer missing offline after an update), keeps the security headers on the pages it serves, refuses HTML where a script was expected, and lets the public pages through without caching them. Firebase Auth no longer loads Google's sign-in iframe on phones (`initializeAuth`, sessions kept). The till's offline boot set is unchanged (plus one 1 KB chunk).

## 2. Netlify environment variables

Project configuration → Environment variables. Any change needs a new deploy.

| Variable | Needed | Contexts | What it does |
| --- | --- | --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | **Yes** | Every context that builds | The till's Firebase project. **The Netlify build now stops with an error if one is missing.** |
| `VITE_SITE_URL` | No | Production | Canonical origin of the public pages (canonical, hreflang, Open Graph, sitemap, robots). Default `https://libsystem-tn.netlify.app`. No trailing slash. |
| `VITE_GTM_ID` | For tracking | **Production only** | `GTM-XXXXXXX`. Master switch: unset = no banner, no `dataLayer`, no request. |
| `VITE_GA4_ID` | Optional | Production only | `G-…`, read by GTM through the data layer (`mk_ga4_id`). |
| `VITE_GADS_ID` | Optional | Production only | `AW-123456789`. |
| `VITE_GADS_CONV_LABEL_WHATSAPP` | Optional | Production only | Label of the « WhatsApp – contact (site) » conversion. |
| `VITE_META_PIXEL_ID` | Optional | Production only | Digits only. |
| `VITE_GOOGLE_SITE_VERIFICATION` | Optional | Production | Search Console token → `<meta name="google-site-verification">` on the public pages. |
| `VITE_BING_SITE_VERIFICATION` | Optional | Production | Bing token → `<meta name="msvalidate.01">`. |

**Go-live rule for tracking (doc 05 §0.10, doc 02 §5.4):** put the tracking IDs in Netlify only after `/confidentialite` has been validated by a lawyer and the Arabic banner text read by a native speaker. The banner links to that page.

Testing tracking without polluting data: `?mk_track=1&mk_debug=1` on a fresh browser profile (console prints `[mk-track]`), `?mk_notrack=1` once on the founders' phones. A browser where anybody ever signed in is never tracked, on purpose.

## 3. Manual steps, in order

1. **Netlify**
   - Set the variables above (Firebase first, or the next deploy fails, which is the point).
   - Deploy previews use the production Firebase project and the repo is public. Until a staging project exists: Project configuration → Build & deploy → Deploy previews: **off** (or "require approval"), and Environment variables → Site policies → **Require approval** for untrusted deploys. Better: make the GitHub repo private.
   - Look for the "This site is hosted on Netlify…" HTML comment Netlify injects into `index.html` (Post processing / snippet injection); remove it if the UI allows, otherwise ask support.
2. **After the deploy, check** (replace the host when the domain changes):
   ```
   curl -sI https://libsystem-tn.netlify.app/decouvrir | grep -iE '^(HTTP|content-type|x-frame|content-security|strict-transport)'
   curl -s  https://libsystem-tn.netlify.app/decouvrir | grep -c '<h1'          # 1
   curl -s  https://libsystem-tn.netlify.app/ar/decouvrir | grep -o 'dir="rtl"'
   curl -sI https://libsystem-tn.netlify.app/robots.txt | grep -i content-type  # text/plain
   curl -sI https://libsystem-tn.netlify.app/sitemap.xml | grep -i content-type # xml
   curl -sI https://libsystem-tn.netlify.app/manifest.webmanifest | grep -i content-type  # application/manifest+json
   curl -sI https://libsystem-tn.netlify.app/assets/nope.js | head -1           # 404, not 200
   curl -sI https://libsystem-tn.netlify.app/caisse | grep -i content-type      # text/html (the app)
   ```
   Then on a real till: open `/`, sell, reload, cut the network, reload (F5, not Ctrl+Shift+R): the till must still open. Open `/decouvrir` on the till: online it shows the static page; offline the app's own copy.
3. **Google Search Console**: add a URL-prefix property for `https://libsystem-tn.netlify.app/`, verify with `VITE_GOOGLE_SITE_VERIFICATION` (redeploy), submit `/sitemap.xml`, inspect `/decouvrir` and `/ar/decouvrir` and request indexing. **Bing Webmaster Tools**: import from Search Console. Once mektebti.tn exists, add a Domain property there (DNS TXT).
4. **Previews**: Facebook Sharing Debugger on both URLs (image, title, description), then paste the link in a WhatsApp chat. Rich Results Test on both URLs (JSON-LD parses; no star snippet is expected — there are no reviews, and none must be invented).
5. **GTM / GA4 / Ads / Meta**: follow doc 05 §4 step by step; the data-layer names in this code are the ones it uses (`page_view`, `pricing_view`, `plan_select`, `cta_whatsapp_click`, `login_click`, `lang_switch`, `scroll_depth`, `consent_update`, and the `mk_*` variables). One event was added: **`cta_phone_click`** (the new « Appeler » `tel:` link, `cta_location: 'final'`). Add it to the GA4 regex trigger (`…|cta_phone_click|…`) and, if wanted, as a second Ads conversion "Appel – clic (site)".
6. **Ads final URLs**: `/decouvrir` for French ads, `/ar/decouvrir` for Arabic ones. Not `/`.
7. **New shops**: hand out `https://libsystem-tn.netlify.app/login` (SAAS.md still says the bare domain, which now shows the sales page on a browser nobody has signed in on yet).

## 4. The domain: never move the tills by redirect

Every till keeps its offline sales queue, its session, its parked tickets and the shop-machine flag in browser storage that belongs to **`https://libsystem-tn.netlify.app` exactly**. A host-wide 301 to another domain strands that data and freezes the service worker on its last build. `netlify.toml` says so at the top.

1. Register `mektebti.tn` (and `.com` defensively), choose apex **or** www once, add it to Netlify as primary domain. Netlify keeps the netlify.app address working; check `curl -I https://libsystem-tn.netlify.app/` still answers 200.
2. Add the new domain to Firebase Auth → Authorized domains (keep the old one).
3. Set `VITE_SITE_URL=https://mektebti.tn` and redeploy: canonical, sitemap and previews move; nothing else does.
4. Optionally 301 **only the marketing paths** from the old host (`/decouvrir`, `/ar/decouvrir`, the legal pages), with host-qualified rules placed **above** the public-page rewrites in `netlify.toml`. Never `/*`, never `/sw.js`, never an app path.
5. Moving existing tills is a per-till operation (backup, green sync badge, sign in on the new origin), described in the audit's phased plan. Not before every badge is green.

Also register `libsystem.tn` or stop issuing logins under it: shop logins use that domain and nobody owns it.

## 5. Next steps not done here

- **Content-Security-Policy.** Only `frame-ancestors 'self'` is enforced today. The full policy is in doc 05 §5.3: ship it as `Content-Security-Policy-Report-Only` first. Prerequisites: (a) the inline script in `index.html` needs its hash in `script-src` — today `'sha256-ger6yPMMdfVSRRq2I7ULHT9qytnU4Yd9EGgCjQgwVb8='`, recompute after any edit of that script; (b) the QR-label print window (`src/features/settings/ServicesTab.tsx`) writes an inline `<script>` and must print from the opener instead. The service worker already passes CSP headers through.
- **Legal pages**: a Tunisian lawyer fills the `[brackets]` and validates the three pages (doc 02 §6). Then remove `noindex` (`legalHead` in `src/features/landing/seo.ts`) and add them to `sitemapXml`. An Arabic version is recommended.
- **Soft 404s**: unknown paths still get the app shell with status 200 (the SPA catch-all). Replacing `/*` with the explicit app routes plus a real 404 needs a test of every till deep link first.
- **Missing `/assets` files** now answer 404, but Netlify may still attach the one-year `immutable` header of the `/assets/*` rule to that 404. Harmless for the service worker (it never stores a non-200), worth a `curl -I` after the first deploy.
- **Prospects who visited before this release** still have the old service worker; it serves them the app's copy of the landing until it updates (a day or two). Nothing to do.
- Outside this workstream's files, found on the way: `src/i18n/index.ts` reads `localStorage` unguarded at import (blank screen with storage blocked); `App.tsx` still warms the till chunks for anonymous visitors of the app's own `/decouvrir` route; `package.json`'s `deploy` script would publish a second copy on Firebase Hosting.

## 6. Founder decisions

1. **The annual plan costs more than the monthly one in every year** (monthly: 500 + 11 × 83 = 1 413 DT in year 1, then 996 DT/year; annual: 2 000 DT/year). The page states the prices without comparing them; only « Le plus rentable » was removed (true only after ~3 years). Reprice or reposition the annual plan before running ads (doc 03 has options).
2. FAQ « Comment payer ? » says *espèces, chèque ou virement*: confirm, or tell us what to write.
3. « Accès à vie » needs a definition (minimum guaranteed years, what happens if the service stops): the CGV draft has the placeholders.
4. TTC or HT on the prices; the CGV draft says « [TTC ou HT à préciser] ».
5. The hero promises « Demander une démo » (no "free", no "in your shop"): say if a free on-site demo can be promised.
6. Campaign code appended to the WhatsApp message (`(réf. rentree-2027)` from `utm_campaign`, `gads` / `meta` from click ids): on by default, cookie-free; say if you prefer it off.
7. A real testimonial (written permission from Librairie Sofiene) to replace the generic « Déjà en service… » line.
8. Make the GitHub repo private and lock the legacy `mindora-2ded0` Firestore rules (audit finding; not a code change).

No Firestore rules change is needed for any of this.
