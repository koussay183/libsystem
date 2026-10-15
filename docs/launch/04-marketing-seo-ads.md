# 04 — Marketing, SEO and paid ads: launch plan for Mektebti.tn

| | |
| --- | --- |
| Date | 15 October 2026 |
| Scope | Landing content audit and new copy (FR + Tunisian Arabic), technical SEO for the Vite SPA on Netlify, keywords, Google Ads, Meta ads, 30-day social calendar, sales script and demo checklist, rentrée campaign |
| Method | Read `src/features/landing/*`, `index.html`, `public/*`, `netlify.toml`, `scripts/pwa.ts`, `src/App.tsx`, `src/auth/RequireAuth.tsx`. Loaded the live page in headless Chromium (Playwright) at 1366 px and 390 px, FR and AR. Checked HTTP headers with curl. Searched the Meta Ad Library (country = Tunisia) and Google Autocomplete (gl = tn). Read Google, Meta and Netlify docs. |
| Builds on | `01-market-research.md` (personas, objections, competitors, claims to avoid) and `02-legal-fiscal-compliance.md` (consent, legal pages, what not to claim). This document does not repeat them; it points to them. |
| Status | Plan and copy, ready to implement. **Nothing here has been tested with shop owners.** Every number marked [E] is an estimate to replace with real data after 2 weeks of spend. |

**Labels**

- **[F]** Fact, with a source in section 12 (e.g. [G1], [N2]).
- **[M]** Measured by me on 15 Oct 2026 (Playwright, curl, Ad Library, Autocomplete). Method in section 12.
- **[E]** My estimate; the assumptions are stated.
- **[H]** Hypothesis to check.

Money is in Tunisian dinars. As in doc 01, **9.600 DT** means 9 dinars 600 millimes.

---

## 0. Summary

### 0.1 What I found

1. **The page looks premium, but it says too little and proves nothing.** The live `/decouvrir` has about **310 visible words** [M]. It has no testimonial, no FAQ, no photo of the hardware, no word on data safety, no legal links and no "who we are". The hero CTA says *Essayer*, but there is no self-serve trial: setup costs 500 DT and needs a visit.
2. **Crawlers and link previews see an empty shell.** Every URL returns the same `index.html`, with a spinner and no content [M]. The page has:
   - no canonical tag, no Open Graph tags, no JSON-LD (0 found) [M];
   - no Arabic URL: Arabic exists only after a click, and is stored in `localStorage`;
   - no real `/robots.txt` or `/sitemap.xml`: both return the HTML shell with status 200 [M];
   - a `manifest.webmanifest` served as `application/octet-stream` [M].

   A link shared on WhatsApp or Facebook shows no preview image. In Tunisia, that is how this product will be passed from libraire to libraire.
3. **A prospect downloads the whole till app.** Opening `/decouvrir` costs **44 requests and about 416 KB of compressed JavaScript** [M]. That includes Firebase (129 KB), Chakra (99 KB) and the prefetched till, stock and home chunks. It also **installs the shop's offline service worker on the prospect's phone** [M]. That is slow on 3G and wasted on a visitor.
4. **One fix solves points 2 and 3: a static, prerendered landing.** Serve plain HTML for `/decouvrir` (FR) and `/ar/decouvrir` (AR), with inline CSS, real text, meta tags, JSON-LD and zero app JavaScript. The design in section 2 also keeps the shop tills safe.
5. **Competitors started advertising to librairies this month** [M, Meta Ad Library]:
   - **ASM-POS**, from 9 Oct 2026, in Arabic: « إذا عندك مكتبة، التنظيم ما عادش اختيار » ("if you have a bookshop, organising is no longer optional"). Its hashtags say `#nacef #homologé`.
   - **Swiver**, from 7 Oct 2026: « Fini les carnets et les fichiers Excel », « À partir de 1,6 DT/jour », « +14 000 entrepreneurs ».
   - **Cyber Gerance**: « À partir de 449 DT/an ».
   - **TechNova**: « 99 DT au lieu de 450 DT ».

   Mektebti costs more (doc 01 §2.3). It must win on **specificity and proof**: packs scolaires, the carnet built for the kridi, installed and loaded for you, Arabic, and a real client shop.
6. **"Best solution in Tunisia" is a goal, not a claim.** There is no proof yet (2 clients). Use the defensible version everywhere: **« La caisse conçue pour les librairies tunisiennes »**. Doc 01 §5.3 lists the claims to avoid.
7. **Search demand exists, but it is small and mostly French** [M, Autocomplete]. Google suggests "logiciel caisse librairie", "logiciel gestion librairie", "logiciel caisse tunisie prix" and "caisse enregistreuse tunisie loi / obligation". Arabic suggestions are mostly Saudi or Algerian wording. **« كاسة » alone means a hammam glove or a glass** in search. **« مكتبتي » is generic**, and Autocomplete hints at same-name local shops (« مكتبتي المروج 6 », « مكتبتي اريانة »). Do not bid on either word alone.
8. **First 30 days of paid tests: about 1,050 DT** [E]. That is Google Search at 15 DT/day plus Meta click-to-WhatsApp at 20 DT/day. There are clear kill and scale rules (§4.9, §5.6). **The WhatsApp click is the primary conversion.** Tags load only after consent (doc 02 §5.4).

### 0.2 The 12 actions, in order

| # | Action | Who | When |
| --- | --- | --- | --- |
| 1 | Approve the copy deck (§1.6) and fill the `{…}` placeholders: final prices, hardware models, client name, support hours | Founder | Day 0 |
| 2 | Ship quick wins: `robots.txt`, `sitemap.xml`, manifest content type, OG/Twitter tags, canonical and JSON-LD in `index.html` as a stop-gap, footer legal links | Dev | Day 1 |
| 3 | Set up WhatsApp Business: greeting, away message, quick replies, labels (§7.1) | Sales | Day 1 |
| 4 | Create the Facebook Page, Instagram and TikTok profiles (§2.10); start the calendar (§6) | Sales | Day 1–2 |
| 5 | Film 3 screen-and-hands videos at the client shop or with the demo kit (§1.7) | Both | Day 2–4 |
| 6 | Prerender `/decouvrir` and `/ar/decouvrir` as static HTML (§2.3), with the new copy | Dev | Day 2–5 |
| 7 | Consent banner + GTM + GA4 + Google Ads + Meta Pixel, on the static landing only (§4.7, doc 02 §5.4) | Dev | Day 3–5 |
| 8 | Google Search Console + Bing; submit the sitemap (§2.10) | Dev | Day 5 |
| 9 | Launch Google Search (C1 + C3 first) and Meta click-to-WhatsApp (§4, §5) | Founder | Day 5–7 |
| 10 | Field-test offline selling on a real shop PC, including a reload during an outage. Only then use the offline claims marked [!] | Dev + Sales | Week 1 |
| 11 | Record a video testimonial at Librairie Sofiene (with written permission); add it to the page and the ads | Sales | Week 2 |
| 12 | Google Business Profile as a service-area business; ask real clients for reviews, with no incentive (§2.10) | Founder | Week 2 |

---

## 1. Landing page: content audit and new copy

### 1.1 What was checked [M]

| Check (15 Oct 2026) | Result |
| --- | --- |
| Visible words (FR, desktop) | **310** |
| Page height | 4,278 px desktop; 5,666 px mobile (390 px) |
| H1 | « Vendez plus vite. Gérez sans cahier. » (one H1, good) |
| H2s | Features, Pourquoi, 3 étapes, Prix, Prêt pour la rentrée |
| Requests / JS on first load | 44 requests; ~416 KB compressed JS, including `firebase` 129 KB, `chakra` 99 KB, `react` 67 KB, and the prefetched `CaissePage` and `StockPage` chunks |
| Service worker | Registered and controlling the page for a first-time visitor |
| Horizontal overflow at 360 and 390 px | None. The product mock is cropped on purpose. In RTL the floating WhatsApp button covers the mock's price column (cosmetic) |
| `<link rel=canonical>`, `og:*`, `twitter:*`, JSON-LD | **None** |
| Arabic version | Only after the « عربي » click (stored in `localStorage`); no URL of its own, no `hreflang` |
| `/robots.txt`, `/sitemap.xml` | 200 `text/html`: the SPA shell (missing files) |
| `/manifest.webmanifest` | `application/octet-stream` (should be `application/manifest+json`) |
| `/brand/*.png` | `max-age=0, must-revalidate` (revalidated on every view) |
| Contact paths | WhatsApp only (5 links + floating button). No `tel:` link: the phone number itself links to WhatsApp. No form. |
| Legal links | None (doc 02 gap G11) |
| `hero.chips` in `copy.ts` | Defined but never rendered (dead copy) |

The screenshots are in the session scratchpad. They are not committed.

### 1.2 Scorecard

Scores out of 5; 3 means "acceptable for launch".

| Dimension | Score | Evidence | Fix |
| --- | --- | --- | --- |
| **Clarity**: what and for whom | 4 | Kicker « La caisse des librairies tunisiennes » + H1 + product mock make it clear in 5 seconds | Keep. Add "papeteries" (most shops are papeteries, doc 01 §1.1) |
| **Proof** | 1 | « Déjà en service dans des librairies en Tunisie » with three coloured dots that look like placeholder avatars. No name, photo, number or video. | Named client + photo + 30 s video (with permission). Real numbers ("740 articles chargés", SAAS.md). Replace the dots with the client's photo. |
| **Objections handled** | 1.5 | Offline is handled with a claim (« 100 % utilisable hors ligne »), not proof. Price is visible. Hardware, data, "who are you", "what if you close", "is it legal", "my PC is old" are not handled. | Add blocks: matériel, données, FAQ (10 questions), équipe (§1.4–1.6) |
| **CTA** | 3 | Strong orange WhatsApp CTA above the fold, repeated 5 times, floating button. But « Essayer — 1er mois offert » promises a self-serve trial that does not exist. Phone-first owners get no call link, and people who avoid WhatsApp get no form. | Primary: « Demander une démo gratuite » (WhatsApp). Secondary: `tel:` and a 4-field call-back form. Sticky bottom bar on mobile. |
| **Trust**: identity, legal, local | 1 | No company name, city, team face, mentions légales, CGV or privacy page | Footer legal pages (doc 02 §6). "Qui sommes-nous" strip with the 2 founders' photo and city. |
| **Pricing clarity** | 2 | Prices are visible (good, and rare in this market). But: HT/TTC unstated; « + 500 DT de mise en service » does not say it **includes the scanner and printer**; when the 500 DT is paid vs the free month is unclear; the annual plan costs more than monthly in year 1 (doc 01 §2.3); « Accès à vie » is undefined (doc 02 §4.7); no payment methods; no "I already have hardware" option | §1.6 pricing block with placeholders, once the pricing workstream fixes the plans |
| **Offline proof** | 1.5 | Claimed 3 times; nothing shows it | 20 s "on débranche le routeur" video, honest footnote (first login needs internet), and [!] gate on field test |
| **Data safety** | 0 | Not mentioned | 4-bullet block (§1.6). Every claim is checked against the code. |
| **Visuals** | 4.5 | CSS-drawn product mock, bento visuals, polished | Add 2–3 real photos: counter, ticket, phone dashboard. Real photos read as proof; CSS mocks read as design. |
| **Arabic** | 3.5 | Good derja (« تصرّف بلا كرّاس », « كي يقصّ الإنترنت »). RTL works. | Own URL, own meta tags, and ads in Arabic pointing to it |
| **Speed** | 2 | ~416 KB JS, Firebase and the service worker for a visitor | Static prerender (§2.3) |

### 1.3 Objections a libraire will raise: where the page answers them

Doc 01 §3.5 gives the answers. This table shows where each should appear on the page.

| Objection (his words) | On the page today? | Where to answer |
| --- | --- | --- |
| « Ghali, w kol chhar » (expensive, and every month) | Price only | Pricing: "moins de 3 DT par jour" anchor (83 ÷ 30 = 2.767 DT), pay-once option, what the setup includes |
| « Kif yoqass el internet ? » (and when the internet cuts?) | Claim only | Offline block + video + FAQ 1 |
| « Ma 3andich wa9t nda55el 3000 article » (no time to enter 3,000 items) | « On charge votre stock » (3 words) | Steps block + FAQ 4 + "740 articles chargés" proof |
| « Ana ma na3rafch el ordinateur » (I don't know computers) | No | "Formation sur place, support WhatsApp", FAQ 5, show the big buttons in the video |
| « 3andi douchette / imprimante » (I already have a scanner / printer) | No | Hardware block + FAQ 2 |
| « W ken tsakrou ? » (and if you close down?) | No | Data block: export at any time; FAQ 8 |
| « Chkoun entouma ? » (who are you?) | No | Team strip + client name + legal pages |
| « El fisc / caisse homologuée ? » (tax office / certified till?) | No | FAQ 10. The wording is in §1.6, **to be validated by the accountant** (doc 02 §0). Do not mirror ASM-POS's `#nacef #homologé`. |
| « Mouch wa9tou » (not now, it's the rentrée) | « Prêt pour la rentrée ? » | Rentrée block: "installations d'octobre à juin" |

### 1.4 Line-by-line notes on the current copy

| Current (FR) | Problem | New |
| --- | --- | --- |
| Kicker « La caisse des librairies tunisiennes » | Good positioning | Keep; AR keep « الكاسة متاع المكتبات التونسية » |
| « Essayer — 1er mois offert » | Implies a self-serve trial; setup is paid and needs a visit | « Demander une démo gratuite » + badge « 1er mois offert » |
| « Un seul écran, même quand internet coupe. » | Fine, once field-tested (doc 01 §5.3) | Keep after the test; until then use « pensé pour les coupures » (see [!]) |
| Facts: « 100 % utilisable hors ligne » | Absolute claim not yet field-tested (doc 01 §2.4) | Remove from the strip; give offline its own block with a footnote |
| Facts: « 0,001 DT : au millime près » | A feature, not a benefit, for a prospect | Replace with « Matériel inclus » |
| « Tout ce que fait la librairie. Rien de plus. » | "Rien de plus" can read as "limited" | « Tout ce que fait une librairie, dans une seule caisse. » |
| Comparison column « Caisse classique » | Fine. Never name a competitor on the page. | Keep |
| Steps « On installe chez vous / On charge votre stock / Vous vendez » | Good, too thin | Add one line each (§1.6) |
| « + 500 DT de mise en service » | Does not say what you get | « Mise en service 500 DT : douchette + imprimante ticket + installation + chargement du stock » |
| « Le plus rentable » on lifetime | True only after ~36 months (doc 01 §2.3); legally undefined (doc 02 §4.7) | « Payez une seule fois », with a link to the terms |
| Footer « © 2026 Mektebti.tn · Fait en Tunisie » | No legal links | Add Mentions légales · CGV · Confidentialité · Cookies |

### 1.5 New page structure (short and visual)

The order is the main change. Each block is one screen on a phone at most.

1. **Nav**: logo · Fonctions · Tarifs · Questions · عربي · Se connecter
2. **Hero**: kicker, H1 (keep), new sub-line, CTA « Demander une démo gratuite » (WhatsApp) + « Voir les tarifs », micro-line (reply time, 1st month free), the client trust line, the CSS product mock (keep)
3. **Proof strip**: 4 short facts (Matériel inclus · Installé chez vous · FR + عربي · 1 mois offert)
4. **Video**: 30 s "a sale at Librairie {X}" (poster image + play; `preload="none"`)
5. **Features**: bento (keep), with updated lines
6. **Rentrée & packs**: one visual + 2 lines
7. **Internet coupe ?**: offline block + 20 s video [!]
8. **Matériel inclus**: photo of the scanner + 80 mm printer + "déjà équipé ?"
9. **Pourquoi Mektebti ?**: comparison table (keep)
10. **Ils l'utilisent**: 1 named testimonial (hidden until real)
11. **Comment ça marche**: 3 steps
12. **Tarifs**: plans + payment methods + "moins de 3 DT/jour"
13. **Vos données restent à vous**: 4 bullets
14. **Questions fréquentes**: 10 `<details>` items (works without JavaScript)
15. **Final CTA + qui sommes-nous**: founders' photo, city, WhatsApp, call, call-back form
16. **Footer**: legal links, Gérer mes cookies
17. **Mobile sticky bar**: [WhatsApp] [Appeler]. It replaces the floating bubble, so nothing covers the content in RTL.

### 1.6 Copy deck: French and Tunisian Arabic

**Rules for this copy:**

- `{…}` is a placeholder the founder must fill. **Never publish a placeholder.**
- [!] marks a claim that may only go live after the offline field test (doc 01 §2.4).
- Keys follow `src/features/landing/copy.ts`. New keys are marked *new*.
- The Arabic is Tunisian derja in Arabic script, the way owners write on Facebook, with standard words where derja has none.

#### Meta (per page, in `<head>`; see §2.4)

| Key | FR (`/decouvrir`) | AR (`/ar/decouvrir`) |
| --- | --- | --- |
| `seo.title` (≤ 60 chars) | Logiciel de caisse pour librairie en Tunisie \| Mektebti.tn *(58)* | كاسة وبرنامج تصرّف للمكتبات في تونس \| مكتبتي Mektebti.tn *(56)* |
| `seo.description` (≤ 155) | Caisse au scanner, stock, packs scolaires et carnet de crédit pour librairies-papeteries en Tunisie. Installé chez vous, en français et en arabe. *(145)* | كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الكريدي للمكتبات في تونس. نركّبوها عندك، بالعربي والفرنسي، وتكمّل تخدم كي يقصّ الإنترنت. *(130)* [!] (last clause) |
| `seo.ogTitle` | Mektebti.tn, la caisse des librairies tunisiennes | مكتبتي، الكاسة متاع المكتبات التونسية |
| `seo.ogDescription` | Packs scolaires en un scan, carnet de crédit, stock et marges au millime. On installe, on charge votre stock, vous vendez. | باكات مدرسية في سكان واحد، كرّاس الكريدي، والمخزون والربح بالمليم. نركّبو، نحطّو السلعة، وانت تبيع. |

#### Nav and hero

| Key | FR | AR |
| --- | --- | --- |
| `nav` | Fonctions · Tarifs · Questions · عربي · Se connecter | الخدمات · الأسعار · أسئلة · FR · تسجيل الدخول |
| `hero.kicker` | La caisse des librairies et papeteries tunisiennes | الكاسة متاع المكتبات التونسية |
| `hero.title1` / `title2` | Vendez plus vite. / Gérez sans cahier. *(keep)* | بيع أسرع. / تصرّف بلا كرّاس. *(keep)* |
| `hero.sub` | Caisse au scanner, packs scolaires, stock et carnet de crédit, en français et en arabe. On installe chez vous et on charge votre stock. | كاسة بالسكانر، باكات مدرسية، مخزون وكرّاس الكريدي، بالعربي والفرنسي. نركّبولك في المكتبة ونحطّولك السلعة. |
| `hero.cta` | Demander une démo gratuite | اطلب ديمو بلاش |
| `hero.cta2` | Voir les tarifs | شوف الأسعار |
| `hero.micro` *new* | Réponse sur WhatsApp {en moins d'une heure, 8 h–20 h} · 1er mois offert | نجاوبوك على الواتساب {في أقل من ساعة، من 8 للـ 20} · الشهر الأول بلاش |
| `trust` | Déjà en service chez {Librairie Sofiene, Ville} | يخدم توّا عند {مكتبة سفيان، المدينة} |

#### Proof strip (`facts`)

| FR (big / small) | AR (big / small) |
| --- | --- |
| Matériel inclus / douchette + imprimante ticket | المعدّات مشمولة / سكانر + طابعة تيكيات |
| Installé chez vous / stock chargé par nous | نركّبو عندك / ونحطّو السلعة |
| FR · عربي / deux langues, un seul écran | عربي · FR / لغتين، شاشة وحدة |
| 1 mois offert / pour commencer | شهر بلاش / باش تبدا |

#### Features (`features`)

| Key | FR title / line | AR title / line |
| --- | --- | --- |
| title | Tout ce que fait une librairie, dans une seule caisse. | كل ما تعملو المكتبة، في كاسة وحدة. |
| scan | Caisse au scanner / Bip, c'est vendu. Ticket 80 mm ou facture A4. | كاسة بالسكانر / بيب، تباعت. تيكيت 80 مم ولا فاتورة A4. |
| pack | Packs scolaires / Toute la liste d'une classe en un scan. | باكات مدرسية / قائمة قسم كاملة في سكان واحد. |
| carnet | Carnet de crédit / Qui doit quoi, depuis quand. Carnet imprimable. | كرّاس الكريدي / شكون يتسال، قدّاش، ومن وقتاش. وتنجم تطبعو. |
| stock | Stock vivant / Alerte avant la rupture. | مخزون حي / تنبيه قبل ما تفرغ السلعة. |
| supplier | Achats & fournisseurs / Factures, dettes, historique. | الشراءات والمزوّدين / فواتير، ديون، وتاريخ كامل. |
| profit | Rentabilité / La marge de chaque article, aussi sur votre téléphone. | الربح / ربح كل سلعة، حتى على تليفونك. |

The "invoice" wording must follow doc 02 gap G1: no word « FACTURE » on a ticket until the invoice gaps are fixed.

#### New blocks

**Rentrée** (`rentree`, *new*)

- FR. Titre : **La rentrée, sans la cohue.** Texte : Préparez vos packs par classe avant juillet. Le jour J : un scan, une liste complète, ticket imprimé.
- AR. العنوان: **العودة المدرسية بلا زحمة.** النص: حضّر الباكات لكل قسم قبل جويلية. ونهار العودة: سكان واحد، قائمة كاملة، والتيكيت يطبع.

**Offline** (`offline`, *new*) [!]

- FR. Titre : **Internet coupe ? Vous continuez de vendre.** Texte : Chaque poste garde une copie de votre caisse. Les ventes s'enregistrent sur place et se synchronisent dès que la ligne revient. Note : *L'installation et la première connexion demandent internet.*
- AR. العنوان: **يقصّ الإنترنت؟ تكمّل تبيع.** النص: كل حاسوب عندو نسخة من الكاسة. البيع يتسجّل في بلاصتو ويتزامن أوّل ما ترجع الكونكسيون. ملاحظة: *التركيب وأوّل دخول يلزمهم إنترنت.*
- **Before the field test passes**, use instead: FR « Pensé pour les coupures : vos ventes ne sont pas perdues quand la ligne tombe. » / AR « مخدومة للكونكسيون اللي تقصّ: البيع ما يضيعش. »

**Hardware** (`hardware`, *new*)

- FR. Titre : **Le matériel est inclus.** Texte : Douchette code-barres {modèle} et imprimante ticket 80 mm {modèle}, installées et testées dans votre librairie. Garantie {durée}. Déjà équipé ? On branche votre matériel {s'il est compatible}.
- AR. العنوان: **المعدّات مشمولة.** النص: سكانر {الموديل} وطابعة تيكيات 80 مم {الموديل}، نركّبوهم ونجرّبوهم في مكتبتك. ضمان {المدّة}. عندك معدّاتك؟ نخدمو بيها {كان متوافقة}.

**Testimonial** (`testimonial`, *new*; render only when `quote` is non-empty)

- FR : « {Citation réelle, 1–2 phrases, mots du client} » — {Prénom}, {Librairie}, {Ville}
- AR : « {كلام الحريف كيما قالو} » — {الاسم}، {المكتبة}، {المدينة}
- To get a usable quote, ask: *Qu'est-ce qui a changé depuis Mektebti ? / Combien de temps pour vendre un pack maintenant ? / Qu'est-ce que vous diriez à un confrère ?* Get written permission (doc 01 §7).

**Steps** (`steps`)

| # | FR title / line | AR title / line |
| --- | --- | --- |
| 1 | Démo dans votre librairie / On vient avec la douchette et l'imprimante. 20 minutes. | ديمو في مكتبتك / نجيوك بالسكانر والطابعة. 20 دقيقة. |
| 2 | On installe et on charge votre stock / Vos articles, vos prix, vos packs : on les saisit pour vous. | نركّبو ونحطّو السلعة / السلع والأسوام والباكات متاعك: احنا نكتبوهم. |
| 3 | Vous vendez / Et on reste joignables sur WhatsApp. | تبدا تبيع / واحنا معاك على الواتساب. |

**Pricing** (`pricing`). Replace the numbers with the final plans from the pricing workstream; current values shown.

| Key | FR | AR |
| --- | --- | --- |
| title | Des prix clairs, en dinars {TTC} | أسعار واضحة بالدينار {TTC} |
| month.note | Mise en service 500 DT : douchette + imprimante ticket + installation + chargement du stock. 1er mois offert, {sans engagement}. | التركيب 500 د: سكانر + طابعة تيكيات + تركيب + نحطّو السلعة. الشهر الأول بلاش، {بلا التزام}. |
| month.anchor *new* | Moins de 3 DT par jour | أقل من 3 د في النهار |
| life.badge | Payez une seule fois *(replaces « Le plus rentable »)* | تخلّص مرّة وحدة |
| payment *new* | Paiement : {espèces, chèque, virement}. Facture fournie. | الخلاص: {كاش، شيك، فيرمو}. نعطيوك فاتورة. |
| byoh *new* | Vous avez déjà le matériel ? Mise en service à {X} DT. | عندك المعدّات؟ التركيب بـ {X} د. |
| terms *new* | Voir les conditions de chaque formule → `/cgv` | شوف شروط كل عرض ← `/cgv` |

**Data** (`data`, *new*). Every line is true in this repo: export in `backupService.ts`; Firestore europe-west9 Paris (SAAS.md); per-shop isolation by the `shopId` claim; local cache in `firebase.ts`.

- FR. Titre : **Vos données restent à vous.**
  - Export complet à tout moment (Excel/CSV + sauvegarde).
  - Hébergées sur Google Cloud à Paris (UE), connexion chiffrée.
  - Chaque librairie a son propre espace, séparé des autres.
  - Chaque poste de caisse garde une copie locale.
- AR. العنوان: **معطياتك ملكك.**
  - تنجم تصدّر كل شي وقت ما تحب (Excel/CSV ونسخة احتياطية).
  - مخزّنة على Google Cloud في باريس، والاتصال مشفّر.
  - كل مكتبة عندها فضاءها، مفصول على الآخرين.
  - كل حاسوب كاسة عندو نسخة محلية.

**FAQ** (`faq`, *new*; `<details><summary>` markup, mirrored in FAQPage JSON-LD)

| # | FR question / answer | AR question / answer |
| --- | --- | --- |
| 1 | **Faut-il internet ?** Pour l'installation et la première connexion, oui. Ensuite la caisse continue de vendre quand la ligne coupe, et tout se synchronise au retour. [!] | **يلزم إنترنت؟** للتركيب وأوّل دخول، إيه. من بعد الكاسة تكمّل تبيع كي تقصّ الكونكسيون، وكل شي يتزامن كي ترجع. [!] |
| 2 | **J'ai déjà une douchette et une imprimante.** On les teste ; si elles sont compatibles, la mise en service coûte {X} DT. | **عندي سكانر وطابعة.** نجرّبوهم؛ كان متوافقين، التركيب بـ {X} د. |
| 3 | **Combien de temps pour démarrer ?** {N} jours après la démo, selon la taille de votre stock. | **قدّاش يلزم باش نبدا؟** {N} أيّام بعد الديمو، حسب قدّاش عندك سلعة. |
| 4 | **Qui saisit mes articles ?** Nous. Envoyez votre fichier Excel ou des photos de factures fournisseurs ; les manuels scolaires CNP sont déjà dans le catalogue, au prix officiel. | **شكون يكتب السلع؟** احنا. ابعثلنا ملف Excel ولا تصاور فواتير المزوّدين؛ الكتب المدرسية متاع CNP موجودة بالسوم الرسمي. |
| 5 | **Il faut quel ordinateur ?** Un PC Windows avec Chrome ou Edge suffit pour la caisse ; le téléphone sert à consulter vos chiffres. Formation sur place incluse. | **شنوّة الحاسوب اللي يلزم؟** PC Windows بـ Chrome ولا Edge يكفي للكاسة؛ والتليفون باش تشوف أرقامك. التكوين في المحل مشمول. |
| 6 | **Plusieurs caisses ?** Oui, chaque poste voit les mêmes chiffres en direct. | **أكثر من كاسة؟** إيه، كل حاسوب يشوف نفس الأرقام مباشرة. |
| 7 | **Mes données sont-elles en sécurité ?** Elles sont hébergées à Paris (UE), séparées des autres librairies, et exportables à tout moment. Nous ne les vendons pas et ne les utilisons pas pour de la publicité. | **معطياتي في أمان؟** مخزّنة في باريس، مفصولة على المكتبات الأخرى، وتنجم تصدّرها وقت ما تحب. ما نبيعوهاش وما نستعملوهاش للإشهار. |
| 8 | **Et si j'arrête ?** Vous exportez tout (sauvegarde + Excel). Vos données vous appartiennent. | **وكان نحبس؟** تصدّر كل شي (نسخة + Excel). المعطيات متاعك. |
| 9 | **Comment je paie ?** {Espèces, chèque ou virement}. Facture à votre nom. | **كيفاش نخلّص؟** {كاش، شيك ولا فيرمو}. فاتورة باسمك. |
| 10 | **Est-ce une caisse homologuée ?** Non. La caisse enregistreuse homologuée est obligatoire pour la restauration et les cafés, pas pour les librairies à ce jour. *(Accountant to validate before publishing: doc 02 §3.)* | **هي كاسة مصادق عليها؟** لا. الكاسة المصادق عليها واجبة على المطاعم والقهاوي، موش على المكتبات لتوّا. *(يلزم المحاسب يصادق قبل النشر)* |

**Final CTA and team**

| Key | FR | AR |
| --- | --- | --- |
| `final.title` | Une démo de 20 minutes, dans votre librairie. | ديمو 20 دقيقة، في مكتبتك. |
| `final.cta` | Réserver ma démo sur WhatsApp | احجز الديمو على الواتساب |
| `final.call` *new* | Appeler le +216 98 158 160 | كلّمنا: 98 158 160 216+ |
| `team` *new* | {Prénom} et {Prénom}, fondateurs, {ville}. On installe nous-mêmes chaque librairie. | {الاسم} و{الاسم}، {المدينة}. احنا بيدينا نركّبو كل مكتبة. |
| `footer` | © 2026 Mektebti.tn · Fait en Tunisie · Mentions légales · CGV · Confidentialité · Gérer mes cookies | © 2026 Mektebti.tn · صنع في تونس · البيانات القانونية · الشروط · الخصوصية · الكوكيز |

**Pre-filled WhatsApp messages** (`waText`, `wa.plan`). Asking for the city in the message makes qualification faster.

- FR: « Bonjour Mektebti, je voudrais une démo pour ma librairie. Ville : »
- FR (plan): « Bonjour, la formule {{plan}} m'intéresse. Ville : »
- AR: « السلام، نحب ديمو متاع Mektebti للمكتبة متاعي. المدينة: »
- AR (plan): « السلام، يهمّني العرض {{plan}}. المدينة: »

**Call-back form** (*new*, 4 fields, §4.7)

- FR: Nom · Librairie · Ville · Téléphone · [Être rappelé]
- AR: الاسم · المكتبة · المدينة · التليفون · [كلّموني]
- Below the button: FR « Nous utilisons ce numéro uniquement pour vous rappeler. » / AR « نستعملو النومرو هذا كان باش نكلّموك. »

### 1.7 Visual assets to produce

Phone-filmed is fine. Always get the shop's written permission and do not show customer names.

| Asset | Spec | Used in |
| --- | --- | --- |
| V1 "Bip, c'est vendu": hands scan 3 items, ticket prints | 15 s, 9:16 and 1:1, captions FR + AR burned in | Landing hero video, Meta concept 2, TikTok |
| V2 Pack scolaire in one scan | 15 s | Landing rentrée block, Meta concept 1 |
| V3 Carnet: credit sale, then the carnet page, then print | 20 s | Meta concept 3 |
| V4 Offline: unplug the router, sell 2 items, replug, sync icon | 20 s, one continuous take (no cut, so it reads as true) [!] | Landing offline block, Meta concept 4 |
| V5 Testimonial: owner at the counter, 2–3 sentences in derja | 30–45 s, subtitles FR + AR | Landing, Meta retargeting |
| V6 Founders: "who we are, why bookshops" | 30 s | Social, final CTA strip |
| P1–P6 photos: counter with scanner; ticket coming out; owner with phone dashboard; hardware on white; founders in a shop; packs shelf | JPG ≤ 150 KB each, WebP copies | Landing, GBP, Facebook |
| OG images | 1200 × 630, FR and AR versions, ≤ 300 KB: logo, « La caisse des librairies tunisiennes », product mock, the brand blue #1800AC + amber #FFAD20 | `og:image` |

Facebook recommends at least 1200 × 630 px, about 1.91:1, for link images [F1]. The ≤ 300 KB size is a common practitioner limit for WhatsApp previews, not an official rule [E].

---

## 2. Technical SEO plan (client-rendered Vite SPA on Netlify)

### 2.1 Problems, by impact

| # | Problem [M] | Impact |
| --- | --- | --- |
| T1 | All routes return the SPA shell with no content. Google can render JS, but Facebook, WhatsApp, LinkedIn and Bing previews cannot. | No link previews; slow and uncertain indexing |
| T2 | Arabic has no URL | AR can never rank; AR ads land on French |
| T3 | No canonical, OG or JSON-LD | Duplicates (netlify.app vs a future mektebti.tn); bare previews |
| T4 | `/robots.txt` and `/sitemap.xml` return the HTML shell with status 200 | Crawlers read HTML as robots rules; no sitemap |
| T5 | Every unknown URL returns 200 with the shell (`/*` rewrite + `<Navigate to="/">`) | "Soft 404s" |
| T6 | The landing loads the full app (~416 KB JS), prefetches till chunks, installs the service worker | Slow on 3G; wastes the prospect's data |
| T7 | `/` for a crawler: the shell first, then a client redirect to `/decouvrir` after Firebase Auth resolves | The domain root carries no content |

### 2.2 Domains and URLs

**Decision first (founder):** confirm who owns **mektebti.tn** (doc 01 §7). From this sandbox the egress proxy refused `mektebti.tn` and `www.mektebti.tn` did not resolve, so I could not check it. That is **not** evidence either way.

**Plan:**

| Phase | Marketing URLs (canonical) | App | Notes |
| --- | --- | --- | --- |
| **Now** (domain not ready) | `https://libsystem-tn.netlify.app/decouvrir` (FR), `/ar/decouvrir` (AR) | unchanged | Canonical = this origin. Switch with one env var (`SITE_ORIGIN`) later. |
| **When mektebti.tn is connected** to the same Netlify site | `https://mektebti.tn/decouvrir`, `https://mektebti.tn/ar/decouvrir` | Existing shops **stay on libsystem-tn.netlify.app**. New shops can sign in on mektebti.tn. | Netlify keeps the `netlify.app` URL working after a custom domain is added: "The Netlify subdomain URLs will always work" [N3]. **Never add a site-wide 301 from netlify.app.** It would move every till to a new origin, and unsynced sales live in that origin's IndexedDB. Only 301 the two marketing paths (§2.7). |
| **Later** (optional) | `https://mektebti.tn/` serves the landing to non-shop visitors | `/` stays the app for shop machines | Netlify can rewrite by cookie presence: `Cookie=mk_shop` [N2]. Set the cookie in `markShopMachine()`. Only do this after testing on a real till. |

`hreflang`: `fr-TN` for FR, `ar-TN` for AR, and `x-default` pointing to FR.

### 2.3 Prerendering `/decouvrir`: design

**Goal:** a plain HTML file per language, built at deploy time. It has real text, all head tags, inline CSS, **no React or Firebase at runtime**, and one small inline script (consent, tracking, WhatsApp channel tag). The page is already plain HTML + one stylesheet + inline SVG icons (see the comment at the top of `LandingPage.tsx`), so it renders server-side as is.

**Steps (files in §11):**

1. **Make `LandingPage` pure.**
   - Signature becomes `LandingPage({ lang }: { lang: 'fr' | 'ar' })`. Drop `useTranslation` and `react-router`'s `Link`; use `<a href="/login">`.
   - The language toggle becomes a link: `<a href="/ar/decouvrir" hreflang="ar" lang="ar">عربي</a>`.
   - Add a `LandingRoute` wrapper in `App.tsx` that passes the i18n language, so the SPA route still works (shop machines, client-side links).
2. **SSR entry** `src/features/landing/entry-server.tsx`: `render(lang) => renderToString(<LandingPage lang={lang} />)`.
3. **Head and structured data** in `src/features/landing/seo.ts`: `head(lang, origin)` returns the tags of §2.4 and the JSON-LD of §2.5. All copy comes from `copy.ts`.
4. **Build script** `scripts/prerender-landing.mjs`, run after `vite build`:
   - Call Vite's `build({ configFile: false, plugins: [react()], resolve: { alias: { '@': …/src } }, build: { ssr: 'src/features/landing/entry-server.tsx', outDir: 'dist-ssr' } })`. `configFile: false` keeps the service-worker plugin out of the SSR build.
   - Import `dist-ssr/entry-server.js`. Minify `landing.css` with esbuild (already a Vite dependency): `transform(css, { loader: 'css', minify: true })`.
   - Write `dist/_m/decouvrir-fr.html` and `dist/_m/decouvrir-ar.html`. Each has `<html lang dir>`, the `head()` output, `<style>` with the inlined CSS, `<div id="root">…markup…</div>`, and the inline script.
   - Also write `dist/sitemap.xml` (§2.6) with the right origin.
   - `package.json`: `"build": "tsc -b && vite build && node scripts/prerender-landing.mjs"`. `dist-ssr` is already in `.gitignore`.
5. **Netlify routing** (§2.7): forced 200 rewrites from `/decouvrir` and `/ar/decouvrir` to those files. They must sit **above** the `/*` rule in `public/_redirects`, because `_redirects` is processed before `netlify.toml` [N1]. The files live under `/_m/` so Netlify's Pretty-URL handling of `*.html` never touches the public URLs [N2].
6. **Send root visitors to the static page.** In `RequireAuth`, when `pathname === '/' && !isShopMachine()`, call `window.location.replace('/decouvrir')` instead of `<Navigate>`. The visitor then loads the light static page, not the SPA copy. In `LoginPage.tsx`, the logo `<Link to="/decouvrir">` becomes a plain `<a>`.
7. **Inline script** (≤ 2 KB, in `seo.ts`):
   - Store `lang` in `localStorage`, so `/login` opens in the same language.
   - Tag WhatsApp links with a channel ref from `utm_source` (`G`, `M`, `O`), e.g. « … Ville : (réf. G) ». The founder then knows which channel a chat came from.
   - Push the `dataLayer` events in §4.7.
   - Load the consent banner, then GTM only after consent (doc 02 §5.4).
   - Everything works if JavaScript is off.

**How it meets the brief:**

- Crawlers, WhatsApp and Facebook get the full text, title, OG image and structured data in the first response.
- First load drops from ~44 requests / ~416 KB JS to about 4 requests and under 60 KB before consent [E].
- Prospects no longer receive the shop's service worker or the Firebase SDK, because the static page never loads `main.tsx`.

### 2.4 Head tags per page

The FR page is shown. The AR page swaps the copy, `lang="ar" dir="rtl"`, `og:locale` = `ar_AR`, and the canonical URL.

```html
<title>Logiciel de caisse pour librairie en Tunisie | Mektebti.tn</title>
<meta name="description" content="Caisse au scanner, stock, packs scolaires et carnet de crédit pour librairies-papeteries en Tunisie. Installé chez vous, en français et en arabe.">
<link rel="canonical" href="https://{ORIGIN}/decouvrir">
<link rel="alternate" hreflang="fr-TN" href="https://{ORIGIN}/decouvrir">
<link rel="alternate" hreflang="ar-TN" href="https://{ORIGIN}/ar/decouvrir">
<link rel="alternate" hreflang="x-default" href="https://{ORIGIN}/decouvrir">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mektebti.tn">
<meta property="og:title" content="Mektebti.tn, la caisse des librairies tunisiennes">
<meta property="og:description" content="Packs scolaires en un scan, carnet de crédit, stock et marges au millime. On installe, on charge votre stock, vous vendez.">
<meta property="og:url" content="https://{ORIGIN}/decouvrir">
<meta property="og:image" content="https://{ORIGIN}/og/mektebti-fr-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Mektebti.tn : caisse au scanner pour librairies">
<meta property="og:locale" content="fr_FR">
<meta property="og:locale:alternate" content="ar_AR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1800ac">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/brand/icon-192.png">
<link rel="preload" as="image" href="/brand/logo-on-light.png">
<!-- verification tags (§2.10) -->
<meta name="google-site-verification" content="{TOKEN}">
<meta name="msvalidate.01" content="{TOKEN}">
```

- `og:locale` uses Facebook's locale codes (`fr_FR`, `ar_AR`). `hreflang` uses the ISO language-region codes Google accepts (`fr-TN`).
- **The SPA shell (`index.html`)** gets `<meta name="robots" content="noindex">` once the static pages are live. It is only ever the app (login, till), and that keeps it out of the index. Until then, add at least `<link rel="canonical">` and the OG tags there as a stop-gap, so links shared this week get a preview.

### 2.5 JSON-LD (FR page; AR is the same with `inLanguage: "ar-TN"` and Arabic names)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://{ORIGIN}/#org",
      "name": "Mektebti.tn",
      "alternateName": "مكتبتي",
      "url": "https://{ORIGIN}/decouvrir",
      "logo": "https://{ORIGIN}/brand/icon-512.png",
      "areaServed": { "@type": "Country", "name": "Tunisie" },
      "contactPoint": [{
        "@type": "ContactPoint",
        "telephone": "+216-98-158-160",
        "contactType": "sales",
        "areaServed": "TN",
        "availableLanguage": ["fr", "ar"]
      }],
      "sameAs": ["{facebook URL}", "{instagram URL}", "{tiktok URL}"]
    },
    {
      "@type": "WebSite",
      "@id": "https://{ORIGIN}/#website",
      "url": "https://{ORIGIN}/decouvrir",
      "name": "Mektebti.tn",
      "publisher": { "@id": "https://{ORIGIN}/#org" },
      "inLanguage": ["fr-TN", "ar-TN"]
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://{ORIGIN}/#app",
      "name": "Mektebti",
      "applicationCategory": "BusinessApplication",
      "applicationSubCategory": "Logiciel de caisse et de gestion pour librairies",
      "operatingSystem": "Web (Chrome, Edge), Windows, Android",
      "inLanguage": ["fr", "ar"],
      "publisher": { "@id": "https://{ORIGIN}/#org" },
      "featureList": [
        "Caisse au scanner code-barres",
        "Packs scolaires",
        "Carnet de crédit clients",
        "Stock et alertes de rupture",
        "Achats et dettes fournisseurs",
        "Rentabilité par article",
        "Ticket 80 mm",
        "Plusieurs postes synchronisés",
        "Français et arabe"
      ],
      "offers": [
        {
          "@type": "Offer",
          "name": "Mensuel",
          "price": "83.000",
          "priceCurrency": "TND",
          "priceSpecification": {
            "@type": "UnitPriceSpecification",
            "price": "83.000",
            "priceCurrency": "TND",
            "billingDuration": "P1M",
            "valueAddedTaxIncluded": "{true|false}"
          }
        },
        { "@type": "Offer", "name": "{Annuel}", "price": "{2000.000}", "priceCurrency": "TND" },
        { "@type": "Offer", "name": "{À vie}", "price": "{3400.000}", "priceCurrency": "TND" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Faut-il internet ?",
          "acceptedAnswer": { "@type": "Answer", "text": "{same text as the visible FAQ 1}" }
        }
        /* … one entry per visible question, identical text … */
      ]
    }
  ]
}
</script>
```

**What this will and will not do [F]:**

- **SoftwareApplication** rich results need `name`, `offers.price` and **one rating or review property** [G4]. Mektebti has no reviews. **Do not add `aggregateRating` until there are real reviews.** Without it, the markup still describes the product, but no star snippet will show.
- **FAQPage** rich results have shown only for "well-known, authoritative government and health websites" since August 2023. For other sites the markup "does not cause problems for Search" [G3]. Keep it cheap and identical to the visible FAQ; expect no visual gain.
- Pull prices from `copy.ts`, so the page and the JSON-LD can never disagree.

### 2.6 `robots.txt` and `sitemap.xml`

`public/robots.txt`:

```
User-agent: *
Disallow: /login
Disallow: /caisse
Disallow: /catalog
Disallow: /stock
Disallow: /packs
Disallow: /invoices
Disallow: /suppliers
Disallow: /credit
Disallow: /dashboard
Disallow: /reports
Disallow: /backup
Disallow: /settings
Disallow: /_m/

Sitemap: https://{ORIGIN}/sitemap.xml
```

`/_m/` is disallowed so the raw files are never indexed; the public URLs are the rewrites. `/assets/` is **not** disallowed, because crawlers may need CSS.

`sitemap.xml`, generated by the prerender script with the right origin:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://{ORIGIN}/decouvrir</loc>
    <xhtml:link rel="alternate" hreflang="fr-TN" href="https://{ORIGIN}/decouvrir"/>
    <xhtml:link rel="alternate" hreflang="ar-TN" href="https://{ORIGIN}/ar/decouvrir"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://{ORIGIN}/decouvrir"/>
    <lastmod>{build date}</lastmod>
  </url>
  <url>
    <loc>https://{ORIGIN}/ar/decouvrir</loc>
    <xhtml:link rel="alternate" hreflang="fr-TN" href="https://{ORIGIN}/decouvrir"/>
    <xhtml:link rel="alternate" hreflang="ar-TN" href="https://{ORIGIN}/ar/decouvrir"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://{ORIGIN}/decouvrir"/>
    <lastmod>{build date}</lastmod>
  </url>
  <!-- add /mentions-legales, /cgv, /confidentialite once they exist (doc 02 §6) -->
</urlset>
```

### 2.7 Netlify configuration (exact)

`public/_redirects` (processed **before** `netlify.toml` [N1]):

```
# Marketing pages: static, prerendered by scripts/prerender-landing.mjs.
# Forced (200!) and ABOVE the SPA catch-all, or the catch-all wins.
/decouvrir        /_m/decouvrir-fr.html   200!
/ar/decouvrir     /_m/decouvrir-ar.html   200!

# When mektebti.tn is live, add these two lines at the very top.
# Marketing paths ONLY; never app paths (see §2.2).
# https://libsystem-tn.netlify.app/decouvrir     https://mektebti.tn/decouvrir     301!
# https://libsystem-tn.netlify.app/ar/decouvrir  https://mektebti.tn/ar/decouvrir  301!

/*    /index.html   200
```

`netlify.toml` additions:

```toml
[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Cache-Control = "no-cache"
    Content-Type = "application/manifest+json"

[[headers]]
  for = "/brand/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/og/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"
```

Merge the manifest block with the existing `/manifest.webmanifest` rule rather than duplicating it. Netlify would apply both, and one rule is easier to read.

**Later (T5, soft 404s):** list the app routes explicitly in `_redirects` (`/caisse`, `/credit/*`, …) instead of `/*`, and add `public/404.html`. Then unknown URLs return a real 404. Do this only with a test of every app route, because a missed route breaks a till deep link.

### 2.8 Service-worker interaction (keep the tills safe)

`scripts/pwa.ts` handles every navigation. It accepts a network document only if the body contains this build's entry script (`isOurBuild`). Otherwise it serves the cached shell. For the static pages that means:

- **Prospects:** no impact. The static page never registers the worker.
- **Shop machines** (worker installed) that open `/decouvrir`: they get the cached SPA shell, which renders the SPA landing route. That is fine. But `/ar/decouvrir` has no SPA route, so it would render the `*` redirect to `/`.

**Fix:** in the worker's `fetch` handler, before the `navigate` branch, add:

```js
if (MARKETING.has(url.pathname)) return
```

where `MARKETING = new Set(['/decouvrir', '/ar/decouvrir', '/mentions-legales', '/cgv', '/confidentialite', '/cookies', '/robots.txt', '/sitemap.xml'])`. The browser then fetches normally. Also add a SPA route for `/ar/decouvrir`, as a belt-and-braces fallback.

**Never** let a marketing page include the app entry script. If it did, `networkShell()` would store it as `/index.html`, and the till would boot on a landing page offline.

### 2.9 Performance budget (static landing)

| Metric | Budget | Today [M] |
| --- | --- | --- |
| Requests before consent | ≤ 5 (HTML, 2 logos, OG not loaded, favicon) | 44 |
| JavaScript before consent | ≤ 3 KB inline | ~416 KB |
| HTML + inlined CSS (gzip) | ≤ 40 KB | n/a |
| LCP on "Slow 4G" (Lighthouse mobile) | ≤ 2.5 s [E] | not measured |
| CLS | < 0.1 (logos already have width/height) | |
| Video | `preload="none"` + poster image ≤ 60 KB | |

After consent, GTM + GA4 + Pixel add roughly 100–200 KB [E]. They load after first paint, so they do not affect LCP.

### 2.10 Search Console, Bing, Google Business Profile, social profiles

- **Google Search Console**
  - On mektebti.tn: add a **Domain property** (DNS TXT). Until then: a **URL-prefix property** for `https://libsystem-tn.netlify.app/`, verified with the `google-site-verification` meta tag in the static head.
  - Submit `sitemap.xml`. Inspect both URLs and request indexing.
  - Check "Page indexing" weekly for the shell being indexed by mistake.
- **Bing Webmaster Tools:** import the site from Search Console, or verify with `msvalidate.01`. Submit the sitemap.
- **Google Business Profile**
  - Only businesses that meet customers in person are eligible. A business that serves customers at their location can be a **service-area business** [G5]. Mektebti installs on site, so create it as a service-area business: **hide the home address** and list the governorates you actually serve.
  - Name exactly « Mektebti.tn » (no keywords in the name). Primary category: the closest software category the GBP picker offers (e.g. "Software company"; check in the UI). Phone +216 98 158 160; website = `/decouvrir?utm_source=google&utm_medium=organic&utm_campaign=gbp`.
  - Add the 3 plans as products and photos P1–P6.
  - **Reviews:** ask every installed client for an honest review, by WhatsApp with the direct review link. **Never offer a discount or gift for a review.** Google removes incentivised reviews and forbids selectively asking only happy customers [G7].
- **Social profiles** (reserve the same handle everywhere, e.g. `mektebti.tn`; check availability):
  - **Facebook Page**: category "Software", button "Send WhatsApp message", linked to the WhatsApp Business number (needed for click-to-WhatsApp ads).
  - **Instagram**: professional account, linked to the Page.
  - **TikTok**: business account.
  - Bio FR: « La caisse des librairies tunisiennes : scanner, packs scolaires, carnet de crédit. Démo gratuite ↓ »
  - Bio AR: « الكاسة متاع المكتبات التونسية: سكانر، باكات مدرسية، كرّاس الكريدي. ديمو بلاش ↓ »
  - Link in bio: `/decouvrir?utm_source={instagram|tiktok}&utm_medium=social&utm_campaign=bio`.
- **Meta Business:** verify the domain (simplest once mektebti.tn exists).

### 2.11 Content roadmap (organic search, after launch)

Each item is one static, prerendered page, FR + AR, linked from the landing and the sitemap.

| Priority | Page | Why (evidence) |
| --- | --- | --- |
| P2 | « Caisse enregistreuse obligatoire en 2026 ? Ce que doit savoir un libraire » | Autocomplete shows "caisse enregistreuse tunisie loi / obligation / loi de finance / fiscale" [M]. Competitors use NACEF fear (ASM-POS hashtags). An honest page builds trust. **Accountant must validate** (doc 02 §3). |
| P2 | « Packs scolaires : préparer la rentrée 2027 en librairie » | Core differentiator; the rentrée campaign landing (§8.4) |
| P3 | « Carnet de crédit (kridi) : suivre les dettes clients sans perdre d'argent » | Owner pain; "gestion crédit client" in Autocomplete [M] |
| P3 | « Logiciel de caisse pour librairie : comparatif des options en Tunisie » | Captures comparison intent. Use only public facts (doc 01 §2.2) and **never** denigrate. |
| — | Do **not** target "liste fourniture scolaire" or "prix manuels scolaires" | High volume, but the searchers are **parents**, not shop owners |

### 2.12 Verification after deploy

Run each check against the production URL:

1. `curl -sI https://{ORIGIN}/decouvrir`: expect 200, `content-type: text/html`, no `location:` header.
2. `curl -s https://{ORIGIN}/decouvrir | grep -c "<h1"`: expect 1. Also check that the AR page contains Arabic text.
3. `curl -sI https://{ORIGIN}/robots.txt`: expect `text/plain`. `curl -sI …/sitemap.xml`: expect `xml`. `curl -sI …/manifest.webmanifest`: expect `application/manifest+json`.
4. **Rich Results Test** (search.google.com/test/rich-results) on both URLs: JSON-LD parses, no errors.
5. **Facebook Sharing Debugger** (developers.facebook.com/tools/debug): image, title and description show. Then send the link in a WhatsApp chat and check the preview.
6. **On a shop till** (machine with the worker): open `/`, `/caisse`, then `/decouvrir` and `/ar/decouvrir`. The till still opens offline after a reload with the network cut.
7. **Lighthouse mobile** on `/decouvrir`: SEO 100, Performance ≥ 90 [E target].

---

## 3. Keyword list

**Evidence:** **AC** = the phrase appeared in Google Autocomplete for Tunisia (gl = tn) on 15 Oct 2026 [M]. That is a demand signal, not a volume. **Run Google Keyword Planner** (free in a Google Ads account) for volumes before setting final bids.

**Priority:** **P1** = bid now; **P2** = bid with a lower cap, or SEO; **P3** = later, or SEO/social only; **NEG** = add as a negative.

| # | Keyword | Lang | Intent | Signal | Priority | Use |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | logiciel caisse librairie | FR | Commercial, high | AC | **P1** | Ads C1 exact + phrase; page title |
| 2 | logiciel de caisse librairie | FR | Commercial, high | AC | **P1** | C1 |
| 3 | caisse librairie / caisse enregistreuse librairie | FR | Commercial | AC | **P1** | C1 |
| 4 | logiciel gestion librairie | FR | Commercial | AC | **P1** | C1 (needs negatives: bibliothèque, école, gratuit) |
| 5 | logiciel gestion stock librairie | FR | Commercial | AC | **P1** | C1 |
| 6 | application de gestion de librairie | FR | Commercial | AC | **P1** | C1 |
| 7 | logiciel gestion papeterie / logiciel librairie papeterie | FR | Commercial | AC (first) | **P1** | C1 |
| 8 | logiciel caisse tunisie prix | FR | Transactional | AC | **P1** | C2; ad shows the price |
| 9 | logiciel caisse tunisie / logiciel de caisse tunisie | FR | Commercial, broad (restaurants too) | AC | P2 | C2, ad copy self-qualifies ("pour librairies") |
| 10 | logiciel caisse enregistreuse tunisie | FR | Commercial | AC | P2 | C2 |
| 11 | logiciel point de vente tunisie / logiciel de vente tunisie | FR | Commercial | AC | P2 | C2 |
| 12 | logiciel de vente et gestion de stock tunisie | FR | Commercial | AC | P2 | C2 |
| 13 | logiciel (de) gestion de stock tunisie | FR | Commercial, broad | AC | P2 | C2, low cap |
| 14 | caisse enregistreuse tunisie prix | FR | Transactional (hardware-minded) | AC | P2 | C2. Mektebti includes hardware, so it fits. |
| 15 | caisse tactile tunisie prix / pack caisse tactile tunisie prix | FR | Transactional (bundle) | AC | P2 | C2. ASM-POS and GFM advertise here. |
| 16 | logiciel caisse hors ligne / logiciel de caisse hors ligne | FR | Commercial | AC | P2 [!] | C2 after the field test |
| 17 | logiciel caisse et gestion de stock | FR | Commercial | AC | P2 | C2 |
| 18 | logiciel gestion commerciale tunisie | FR | Commercial, accounting-ish | AC | P3 | Later |
| 19 | douchette code barre tunisie (prix) | FR | Hardware purchase | AC | P3 | Test later with "matériel + logiciel" copy |
| 20 | imprimante ticket tunisie | FR | Hardware purchase | AC | P3 | Same |
| 21 | caisse enregistreuse tunisie loi / obligation / loi de finance / fiscale | FR | Informational (worry) | AC | P2 SEO / **NEG in ads** | §2.11 article |
| 22 | gestion crédit client | FR | Informational | AC | P3 | SEO article |
| 23 | mektebti / mektebti.tn / mektebti caisse | FR (Latin) | Navigational | none (new brand) | **P1** | C3 brand, cheap protection |
| 24 | swiver / gastevo / hesabi / loyverse | FR | Competitor | AC (swiver, loyverse) | P3 | C4 later. Never use their marks in ad text. |
| 25 | برنامج ادارة مكتبة | AR | Commercial | AC | **P1** | C1-AR phrase, with negatives مجاني, تحميل |
| 26 | برنامج ادارة مكتبة ادوات مكتبية | AR | Commercial (stationery shop) | AC | **P1** | C1-AR. It is exactly a papeterie. |
| 27 | برنامج كاسة مكتبة / برنامج كاشير مكتبة | AR | Commercial | none | P2 | C1-AR phrase |
| 28 | برنامج تسيير مكتبة | AR | Mixed (Maghreb wording; also school/public libraries) | AC | P2 | Negatives: مدرسية, عمومية, مسجد |
| 29 | برنامج كاشير | AR | Commercial, pan-Arab | AC | P2 | C2-AR, Tunisia geo only |
| 30 | برنامج نقاط البيع | AR | Commercial | AC | P2 | C2-AR |
| 31 | برنامج إدارة المخزون والمبيعات | AR | Commercial | AC | P3 | C2-AR |
| 32 | برنامج حسابات محل / برنامج تسيير محل تجاري | AR | Mixed, many "free" seekers | AC | P3 | Low cap |
| 33 | كاسة (alone) | AR/derja | Wrong meaning in search: "كاسة حمام", "كاسة فلوس" | AC | **NEG/avoid** | Use the word in ad *copy*, not as a keyword |
| 34 | مكتبتي (alone) | AR | Generic ("my library"); Autocomplete shows « مكتبتي المروج 6 », « مكتبتي اريانة » | AC | **Do not bid** | Brand search in Arabic = "Mektebti" in Latin |
| 35 | logiciel caisse gratuit / logiciel caisse tunisie gratuit | FR | Free seekers | AC | **NEG** | |
| 36 | caisse lel maktba, barnamej caisse, logiciel kridi | Derja (Latin) | Not typed into Google | none | Social only | Hashtags, TikTok captions, comments |

**Arabic search behaviour [H]:**

- In Tunisia, people search for software mostly **in French**. Arabic suggestions under gl = tn are dominated by Gulf and Algerian phrasing (« مجاني لوجه الله », « جزائري »).
- Plan **≈80% FR / 20% AR** of Google spend at first. **Meta is the opposite**: Arabic derja creatives will likely do better with Persona 1 (doc 01 §3.1).

**Brand check (founder):**

- Before spending on brand, look up « مكتبتي » shops in Google Maps and Facebook (El Mourouj 6, Ariana).
- Run an INNORPI trademark search for "Mektebti / مكتبتي". The clash may only confuse search; it may also block a trademark filing.

---

## 4. Google Ads plan

### 4.1 Prerequisites (before the first dinar)

1. **Google Ads account.** The account currency is fixed at creation; check whether TND is offered. GA4 supports TND as a reporting currency [G6]. Turn auto-tagging on.
2. **Payment and tax.** An international card. Google bills from abroad, so set up the reverse-charge VAT and withholding with the accountant (doc 02 §4.5).
3. **Consent, then tags.** Consent banner, GTM, GA4 and the Google Ads tag on the **static landing only**, never in the app (doc 02 §5.4). Use Consent Mode v2 with everything "denied" by default.
4. **Conversion actions** created (§4.7) and tested with Tag Assistant.
5. **Landing pages live:** `/decouvrir` and `/ar/decouvrir`, with the new copy.

### 4.2 Campaigns, ad groups, keywords

Use Search only. **No Performance Max and no Display network** at first: there is too little conversion data for automated campaigns, and Display brings low-quality clicks [E].

| Campaign | Budget/day | Ad group | Keywords (match type) | Landing |
| --- | --- | --- | --- | --- |
| **C1 Librairie – forte intention** | 8 DT | AG1 Caisse librairie | [logiciel caisse librairie], [logiciel de caisse librairie], "caisse librairie", [caisse enregistreuse librairie], "logiciel caisse papeterie" | `/decouvrir` |
| | | AG2 Gestion librairie / papeterie | [logiciel gestion librairie], "gestion librairie papeterie", [logiciel gestion papeterie], "gestion stock librairie", "application gestion librairie", "logiciel librairie papeterie" | `/decouvrir` |
| | | AG3 مكتبة (AR) | "برنامج ادارة مكتبة", "مكتبة ادوات مكتبية", "برنامج كاسة مكتبة", "برنامج كاشير مكتبة", "برنامج تسيير مكتبة" | `/ar/decouvrir` |
| **C2 Caisse Tunisie – générique** | 6 DT | AG4 Logiciel caisse Tunisie | "logiciel caisse tunisie", [logiciel caisse tunisie prix], "logiciel de caisse tunisie", "logiciel point de vente tunisie", "logiciel de vente tunisie", "logiciel caisse et gestion de stock" | `/decouvrir` |
| | | AG5 Caisse enregistreuse / tactile | "caisse enregistreuse tunisie prix", "caisse tactile tunisie prix", "pack caisse tactile tunisie" | `/decouvrir#materiel` |
| | | AG6 Stock Tunisie | "logiciel gestion de stock tunisie", "logiciel de vente et gestion de stock tunisie" | `/decouvrir` |
| | | AG7 كاشير (AR) | "برنامج كاشير", "برنامج نقاط البيع", "برنامج إدارة المخزون والمبيعات" | `/ar/decouvrir` |
| **C3 Marque** | 1 DT | AG8 Brand | [mektebti], [mektebti tn], [mektebti.tn], "mektebti caisse" | `/decouvrir` |
| C4 Concurrents (month 2, optional) | 2 DT | AG9 | [swiver], [gastevo], [hesabi tn], [loyverse], [tassaruf], [sharpos] | `/decouvrir` |

C2's ads must **self-qualify** (« Pour librairies et papeteries ») so that restaurants do not click. The plan is ≈15 DT/day for C1 + C2 + C3. The niche C1 terms may not be able to spend 8 DT/day; let unspent budget sit rather than broaden it in week 1.

### 4.3 Negative keywords (shared list on all campaigns)

**FR:** gratuit, gratuite, free, crack, cracké, télécharger, telecharger, download, apk, pdf, excel, open source, github, mémoire, pfe, projet, uml, java, php, python, cours, formation, tutoriel, emploi, offre d'emploi, stage, recrutement, salaire, restaurant, resto, café, fast food, coiffure, salon, boulangerie, pâtisserie, pharmacie, parapharmacie, vêtement, prêt à porter, supermarché, superette, boucherie, quincaillerie, hôtel, bibliothèque, bibliothèque municipale, bibliothèque scolaire, médiathèque, occasion, tayara, mytek, sharp, casio, loi, obligation, loi de finance, fiscale, homologuée, nacef, maroc, algérie, france, sénégal, cameroun, côte d'ivoire.

**AR:** مجاني, مجانا, لوجه الله, تحميل, اكسل, excel, جزائري, الجزائر, مصر, السعودية, الرياض, الكويت, جرير, نور, الكون, الاسكندرية, مكتبة مدرسية, مكتبة عمومية, مسجد, روايات, كتب pdf, افلام, مطعم, صيدلية, ملابس, حمام.

Review the **search terms report every 2 days** in week 1, then weekly. Add new negatives from it.

### 4.4 Responsive search ads

Google allows up to 15 headlines (≤ 30 characters), up to 4 descriptions (≤ 90) and 2 paths (≤ 15) [G1]. All lengths below were counted with a script, including Arabic diacritics. Use **one FR RSA per FR ad group and one AR RSA per AR ad group**. Pin nothing at first. If C2 traffic is poor, pin H1 or H2 to position 1.

**French headlines** (≤ 30)

| # | Headline | Chars | Note |
| --- | --- | --- | --- |
| 1 | Logiciel caisse librairie | 25 | |
| 2 | La caisse des librairies | 24 | |
| 3 | Mektebti.tn, fait en Tunisie | 28 | |
| 4 | Packs scolaires en un scan | 26 | |
| 5 | Carnet de crédit intégré | 24 | |
| 6 | Scanner + imprimante inclus | 27 | |
| 7 | On installe et charge le stock | 30 | |
| 8 | 1er mois offert | 15 | |
| 9 | Dès 83 DT par mois | 18 | Final price |
| 10 | En français et en arabe | 23 | |
| 11 | Support WhatsApp en Tunisie | 27 | |
| 12 | Stock et marges au millime | 26 | |
| 13 | Démo gratuite en librairie | 26 | |
| 14 | Plusieurs postes synchronisés | 29 | |
| 15 | Gestion librairie papeterie | 27 | |
| alt | Encaisse même sans internet | 27 | [!] swap in after the field test |
| alt | Prêt pour la rentrée 2027 | 25 | Use from Jan 2027 |

**Arabic headlines** (≤ 30)

| # | Headline | Chars |
| --- | --- | --- |
| 1 | كاسة للمكتبات في تونس | 21 |
| 2 | برنامج كاسة للمكتبة | 19 |
| 3 | باكات مدرسية في سكان واحد | 25 |
| 4 | كرّاس الكريدي في الكاسة | 23 |
| 5 | السكانر والطابعة مشمولين | 24 |
| 6 | نركّبولك ونحطّولك السلعة | 24 |
| 7 | الشهر الأول مجاني | 17 |
| 8 | بالعربي والفرنسي | 16 |
| 9 | المخزون والربح بالمليم | 22 |
| 10 | دعم على الواتساب | 16 |
| 11 | ديمو مجاني في مكتبتك | 20 |
| 12 | مصنوع في تونس للمكتبات | 22 |
| 13 | أكثر من كاسة، نفس الأرقام | 25 |
| 14 | من 83 د في الشهر | 16 |
| 15 | ودّع كرّاس الكريدي | 18 |
| alt | تكمّل تبيع بلا إنترنت [!] | 21 |
| alt | حاضر للعودة المدرسية 2027 | 25 |

**Descriptions** (≤ 90)

| # | FR | Chars | AR | Chars |
| --- | --- | --- | --- | --- |
| 1 | Caisse au scanner, stock, packs scolaires et carnet de crédit. En français et en arabe. | 87 | كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الكريدي. بالعربي والفرنسي. | 68 |
| 2 | On installe chez vous et on charge votre stock. Douchette et imprimante ticket incluses. | 88 | نركّبولك في المكتبة ونحطّولك السلعة. السكانر وطابعة التيكيات مشمولين. | 69 |
| 3 | 1er mois offert. Démo gratuite dans votre librairie. Écrivez-nous sur WhatsApp. | 79 | الشهر الأول مجاني. ديمو مجاني في مكتبتك. ابعثلنا على الواتساب. | 62 |
| 4 | Pensé pour la rentrée : packs par classe, ventes rapides, stock exact après la saison. | 86 | مصنوعة للعودة المدرسية: باكات لكل قسم، بيع سريع، ومخزون مضبوط بعد الموسم. | 73 |
| alt [!] | Internet coupe ? La caisse continue d'encaisser et tout se synchronise au retour. | 81 | تقصّ الكونكسيون؟ الكاسة تكمّل تخدم، وكل شي يتزامن كي ترجع. | 58 |

**Display paths:** FR `/librairie` + `/caisse`; AR `/مكتبة` + `/كاسة`.

**Assets:**

- **Sitelinks**, each with a matching section anchor (FR / AR):
  - Tarifs / الأسعار → `#tarifs`
  - Packs scolaires / باكات مدرسية → `#rentree`
  - Carnet de crédit / كرّاس الكريدي → `#fonctions`
  - Questions fréquentes / أسئلة → `#faq`
- **Callouts** (≤ 25):
  - FR: Matériel inclus · Installé chez vous · Français et arabe · Support WhatsApp · 1er mois offert · Fait en Tunisie
  - AR: المعدّات مشمولة · نركّبو عندك · عربي وفرنسي · دعم واتساب · الشهر الأول بلاش
- **Structured snippet** "Types": Caisse, Stock, Packs scolaires, Carnet de crédit, Achats, Rapports.
- **Call asset:** +216 98 158 160, scheduled only during the hours someone answers.
- **Image assets:** P1, P2, logo.
- **Avoid "n°1" or "meilleur" in any ad**: no proof yet (doc 01 §5.3).

### 4.5 Budget, bidding, schedule

| Item | Setting |
| --- | --- |
| Total | **15 DT/day** (≈ 450 DT for 30 days) [E] |
| Bidding, weeks 1–3 | **Maximize clicks** with a max CPC cap of **2.0 DT**. That is inside the 0.4–2.5 TND range one Tunis agency gives for B2B queries in Tunisia [K1]. It is a vendor estimate, not Google data. |
| Bidding, later | Switch to **Maximize conversions** (later tCPA) only after **≈ 30 conversions in 30 days** (practitioner rule of thumb, not a Google requirement). Until then, smart bidding has too little data. |
| Ad schedule | All days, 07:00–23:00 Tunis time. Pause the call asset when nobody can answer. |
| Devices | All. Expect mostly mobile [H]. WhatsApp works best on mobile, so no negative mobile adjustment. |
| Networks | Search only (untick Search partners and Display) |
| Languages | French, Arabic, English (many Tunisian phones run in English or French) |

### 4.6 Location targeting

- **Presence only:** set "People in or regularly in your targeted locations", **not** "interest in". Otherwise the diaspora in France sees the ads and clicks at French prices.
- **Target only where you can install within a week.** A lead you cannot visit is wasted money.

Governorates available as Google Ads targets, from the Google geotarget file of 2026-10-06 [G2]:

| Zone (doc 01 §1.3 priority) | Google target (criterion ID) | Phase |
| --- | --- | --- |
| Grand Tunis | Tunis Governorate (9075946), Ariana Governorate (9075935), Ben Arous Governorate (9075942). **Manouba is not a governorate target**: use a radius of ~15 km around Manouba city, or city "Sidi Amor, Manouba" (9236159) | Day 1 |
| Cap Bon | Nabeul Governorate (9075941) | Day 1 if the team covers it |
| Sahel | Sousse Governorate (9075949), Monastir Governorate (9075943), Mahdia Governorate (9075939) | Day 1 or week 3 |
| Sfax | Sfax Governorate (9075948) | Week 3+ |
| Others with a target | Bizerte (9075945), Kairouan (9075936), Médenine (9075937), Gabès (9075940), Gafsa (9075938), Béja (9075947), Jendouba (9075950), Le Kef (9075944) | When you can install there |
| No governorate target | Manouba, Zaghouan, Siliana, Kasserine, Sidi Bouzid, Tozeur, Tataouine. Kébili exists only as a city (9259706). | Radius targeting |

### 4.7 Conversion actions and tracking specification

**Events pushed by the static landing.** No personal data goes in any event.

| `dataLayer` event | When | Parameters | GA4 | Google Ads | Meta Pixel |
| --- | --- | --- | --- | --- | --- |
| `whatsapp_click` | Any `wa.me` link | `cta_location` (hero, plan_month, plan_year, plan_life, final, sticky, faq), `plan`, `lang` | key event | **Primary** "WhatsApp click", count: one per click | `Contact` |
| `phone_click` | `tel:` link | `cta_location`, `lang` | key event | **Primary** "Call click" | `Contact` |
| `generate_lead` | Call-back form sent | `lang`, `governorate` (from a select field, not free text) | key event | **Primary** "Form lead" | `Lead` |
| `view_pricing` | `#tarifs` 50% visible (IntersectionObserver) | `lang` | event | Secondary (observation only) | `ViewContent` |
| `faq_open` | A `<details>` is opened | `question_id` | event | — | — |
| `lang_switch` | FR/AR link | `to` | event | — | — |

Notes:

- **Calls from ads** (call asset): add the Google Ads "Calls from ads" conversion if your account offers call reporting in Tunisia; it is not checked here.
- **Values [E]:**
  - Assumption: ~1 signed shop per 15 WhatsApp clicks (§4.9), and ~1,000 DT gross margin in year 1 (1,413 DT revenue minus ~300–450 DT of hardware, doc 01 §2.3).
  - That gives a value of about **65 DT per WhatsApp or call click** and **100 DT per form**.
  - Use these values only to compare campaigns, and revise them after month 1.
- **Offline truth:**
  - Keep a lead sheet (§7.8) with the channel ref (« réf. G / M / O ») from the pre-filled WhatsApp text.
  - Once a month, compare it with Ads-reported conversions.
  - Do **not** upload customer phone numbers to Google or Meta without the person's consent (doc 02 §5.3, art. 30).
- **Call-back form backend.** The simplest option with a static page is Netlify Forms (`data-netlify="true"`, hidden fields `utm_source`, `utm_campaign`, `gclid`). Check the current Netlify plan's submission allowance. The privacy notice must mention the processor (doc 02 §6.3).

### 4.8 Landing page and tracking parameters

- Final URL: `https://{ORIGIN}/decouvrir` (FR ad groups) and `https://{ORIGIN}/ar/decouvrir` (AR ad groups).
- Final URL suffix (account level): `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}&utm_term={keyword}`.
- AG5 (caisse enregistreuse) lands on `#materiel`, so the hardware block is the first thing seen.

### 4.9 Funnel targets, kill and scale rules (all [E], to recalibrate after 14 days)

| Step | Assumption | 30 days at 15 DT/day |
| --- | --- | --- |
| Clicks | CPC 0.8–2.0 DT | 225–560 |
| WhatsApp, call or form | 4–8% of clicks | 9–45 |
| Real conversations | ~60% | 5–27 |
| Qualified (librairie-papeterie in your zone, decision maker) | ~40% | 2–11 |
| Demos | ~70% of qualified | 1–8 |
| Signed | 25–40% of demos | **0–3 shops** |

**Targets:**

- Cost per WhatsApp click ≤ 25 DT.
- Cost per qualified lead ≤ 60 DT.
- Cost per signed shop ≤ 400 DT (≈ 40% of year-1 gross margin).

**Rules:**

- **Keyword:** 40 clicks and 0 contact events → pause it, or lower its cap by 30%.
- **Ad group:** CTR < 3% after 300 impressions on C1 → rewrite the headlines [E].
- **Scale:** if C1 cost per qualified lead is ≤ 60 DT for 2 weeks, raise C1 by 30% per week. Volume is the limit, not money.
- **Day 30:** if cost per qualified lead is > 120 DT, stop Google. Keep only C3 brand, and move the budget to field visits and Meta.

### 4.10 Weekly routine (30 minutes, Monday)

1. Search terms: add negatives. Promote converting queries to exact match.
2. Asset report: replace "Low" headlines.
3. Compare Ads conversions with the lead sheet: real conversations, qualified, demos, signed.
4. Check the landing still answers 200 and the tags still fire (Tag Assistant).
5. Write 3 lines in the shared sheet: spend, leads, what changes this week.

---

## 5. Meta ads plan (Facebook + Instagram)

### 5.1 Prerequisites

- **Meta Business portfolio** with the Page, Instagram and ad account. Verify the business when possible.
- **WhatsApp Business** on +216 98 158 160, **connected to the Page**. Click-to-WhatsApp ads need this.
- **Pixel through GTM**, loaded only after consent (doc 02 §5.4). The ads below do not need the Pixel to run, because they send people straight to WhatsApp. The Pixel is for retargeting landing visitors.
- **Payment and tax:** see doc 02 §4.5.
- **Facebook ad reach in Tunisia:** 7.80M; Instagram 4.05M; Messenger 5.85M (DataReportal, late 2025) [D1].

### 5.2 Competitor ads running in Tunisia (Meta Ad Library, 15 Oct 2026) [M]

| Advertiser | Started | Hook (verbatim, shortened) | Offer / CTA | What it means for Mektebti |
| --- | --- | --- | --- | --- |
| **ASM-POS** (ids 1417479003888846, 1853343882323370) | 9 Oct 2026 | « كل كتاب يتحسب... وكل عملية بيع تتسجل. إذا عندك مكتبة، التنظيم ما عادش اختيار » ; « Promo spéciale rentrée scolaire, Pack caisse tactile » ; hashtags `#Librairie #Papeterie #nacef #homologé` | Hardware pack, phone, "depuis 2007", SAV 7/7 | A direct competitor for librairies, in derja, right now. It sells hardware plus a generic POS. Mektebti's answer: built for the bookshop (packs, carnet, CNP catalogue), stock loaded for you. **Do not copy the NACEF/homologation angle.** |
| **Swiver** (1313059460831073, 1642153404187640, 1097603179559226, 1107001445192932) | 7 Oct 2026 | « المال السايب يعلم السرقة » ; « Vos factures et votre stock sont dans un logiciel piraté ? » ; « Combien avez-vous gagné aujourd'hui ? » ; « Qui a payé ? Qui doit encore ? Fini les carnets et les fichiers Excel » | « À partir de 1,6 DT/jour, sans engagement », « +14 000 entrepreneurs », free trial | Owns "fini les carnets" broadly. Mektebti must make it concrete: **the kridi carnet inside the till**, in derja. Use a per-day anchor too: « moins de 3 DT/jour ». |
| **Cyber Gerance** (2417723658751387, 961290740196960) | 29 Jun / 5 May 2026 | « Dites adieu à votre ancienne caisse enregistreuse ! » ; « تعبت من الكارنيات و الأغلاط في الحسابات؟ … نظام حسابات مبني على ODOO » | « À partir de 449 DT/an. Envoyez "INFO" », free delivery, on-site training, 12-month warranty, SAV 7/7 | Same WhatsApp-first funnel and the same on-site training promise. Price-anchored lower. Differentiate on bookshop fit and proof. |
| **TechNova** (1039860462209083) | 11 Sep 2026 | « 5 logiciels. 1 seule offre. 99 DT au lieu de 450 DT ! » | One-off pack | The bottom of the market. Do not fight on price. |
| **Lexxi Digital / Kul Digital** (1382553117078906, 1597176085258678) | Jun–Sep 2026 | « Vous gérez une librairie ou une papeterie, mais avez-vous une vue claire… » ; « PROGICIEL EXCEL TDB LIBRAIRIE / PAPETERIE » | Excel templates | Proof that "librairie-papeterie" is a targetable pain on Facebook. Mektebti is the "real tool" step up from Excel. |
| **OOPOS by Joolan** (978442774617762) | 14 Oct 2026 | « Bien plus qu'un logiciel de caisse ! … désormais proposée aux professionnels en Tunisie » | Multi-store | Newcomer; watch it |

**Prospect list from the Ad Library [H].** Librairies that run their own ads have budget and are growing. Examples: « Librairie Sarra - مكتبة سارة » announced a second branch (ad 1095548372966660); « Librairie Le Bosphore » has La Marsa and Soukra points. Each month, search "مكتبة" and "librairie" in the Ad Library with country = Tunisia, and add the active shops to the field-visit list. Contact the business number they publish, once, politely; no bulk messaging.

### 5.3 Campaigns and audiences

| Campaign | Objective | Audience | Budget |
| --- | --- | --- | --- |
| **M1 Prospecting, click-to-WhatsApp** | Engagement (or Leads) → conversion location **WhatsApp** | Geo: same zones as Google (§4.6), using city + radius (e.g. Tunis +20 km, Sousse +15 km). Check in Ads Manager whether governorates appear as regions. Age 24–60, all genders, no language filter. Two ad sets: **A. Advantage+ / broad**: the creative does the targeting (« Vous avez une librairie ? » in the first line). **B. Interests**: business-owner and stationery signals, e.g. Small business, Entrepreneurship, Retail, Office supplies / Stationery, Books. Names change; pick the closest from the current list. | 14 DT/day (7 + 7) |
| **M2 Retargeting** (from day 8) | Engagement → WhatsApp | Landing visitors 30 days (Pixel, consented only) + video viewers ≥ 50% for 60 days + Page/IG engagers for 90 days. Exclude people who already messaged, if Meta offers that audience. | 6 DT/day |
| **M3 Lookalike** (later) | Same | 1–3% Tunisia lookalike of engagers or consented leads, once the seed has **≥ 100 people**. Practitioners report Meta asks for at least 100 people from one country, and recommends 1,000–5,000 [F2]. With 2 clients, a customer seed is impossible now. | Later |

**Rules:**

- Placements: Advantage+, but **exclude Audience Network** [E: low-quality clicks].
- Frequency cap on retargeting: ≤ 3 per week.
- **Customer lists:** never upload WhatsApp contacts or client phone numbers for targeting without the person's express consent (loi 2004-63 art. 30, doc 02 §5.3).

### 5.4 Six ad concepts

Primary text: keep the first 125 characters strong. Headline ≤ 40. CTA button: **« Envoyer un message WhatsApp »**. Every video has burned-in captions (most people watch muted). Each concept has an FR, an Arabic-script derja and a Latin-script derja version (the last for Instagram/TikTok and younger "Ines" types, doc 01 §3.2).

**Concept 1: « La rentrée, plus jamais comme ça »** (run now: post-rentrée pain). Asset V2 + queue b-roll.

- FR. Primary: « La rentrée vous a épuisé ? Packs scolaires en un scan, ticket imprimé, stock exact après la saison. Démo gratuite dans votre librairie. » Headline: « La caisse des librairies »
- AR. Primary: « العودة المدرسية تعّبتك؟ الباكات في سكان واحد، التيكيت يطبع، والمخزون مضبوط بعد الموسم. ديمو بلاش في مكتبتك. » Headline: « الكاسة متاع المكتبات »
- Derja (Latin): « El rentrée ta3ebtek? Pack kamel fi scan wa7ed, ticket yetba3, stock madhbout. Demo bléch fi maktabtek. »
- Format: Reels/Stories 9:16 15 s (split screen: queue vs one scan), plus Feed 4:5.

**Concept 2: « Bip, c'est vendu »** (product demo). Asset V1.

- FR: « Bip, c'est vendu. Le prix s'affiche, le ticket sort, le stock se met à jour. Conçu pour les librairies tunisiennes. » Headline: « Caisse au scanner, matériel inclus »
- AR: « بيب، تباعت. السوم يطلع، التيكيت يخرج، والمخزون يتبدّل وحدو. مصنوعة للمكتبات التونسية. » Headline: « كاسة بالسكانر، المعدّات مشمولة »
- Derja (Latin): « Bip w tbe3et. Es-soum yetla3, el ticket yokhroj, w el stock yetbaddel wa7dou. »
- Format: 9:16 and 1:1, 10–15 s, the sound of the beep and the printer.

**Concept 3: « Le kridi »** (carnet; October is debt-collection time, doc 01 §1.5). Asset V3.

- FR: « Qui vous doit quoi, depuis quand ? Le carnet de crédit est dans la caisse : chaque vente à crédit s'y inscrit toute seule. » Headline: « Fini le cahier de kridi »
- AR: « شكون يتسالك، قدّاش، ومن وقتاش؟ كرّاس الكريدي داخل الكاسة: كل بيعة بالكريدي تتسجّل وحدها. » Headline: « ودّع كرّاس الكريدي »
- Derja (Latin): « Chkoun yetsalek w 9addech? El kridi yetsajjel wa7dou fil caisse. »
- Format: carousel 1:1 (paper carnet → the app's carnet → printed carnet → CTA), or 4:5 video.

**Concept 4: « Internet coupe ? »** [!] (only after the field test). Asset V4, one continuous take.

- FR: « On a débranché internet. La caisse a continué. Tout s'est synchronisé au retour de la ligne. Regardez. » Headline: « Pensée pour les coupures »
- AR: « قصّينا الإنترنت. الكاسة كمّلت تخدم. وكي رجعت الكونكسيون كل شي تزامن. شوف بعينك. » Headline: « تقصّ الكونكسيون؟ تكمّل تبيع »
- Derja (Latin): « 9assina el internet, el caisse kammlet tekhdem. Chouf b3inek. »
- Format: 9:16, 20 s, timestamp visible on screen.

**Concept 5: « On installe, on charge, vous vendez »** (done-for-you; answers "no time, I don't know computers"). Assets V6 + P5.

- FR: « Pas le temps de saisir 3 000 articles ? On vient, on installe la douchette et l'imprimante, on charge votre stock. Vous vendez. » Headline: « Installé chez vous, stock chargé »
- AR: « ما عندكش وقت تكتب 3000 سلعة؟ نجيوك، نركّبو السكانر والطابعة، ونحطّو السلعة متاعك. وانت تبيع. » Headline: « نركّبولك ونحطّولك السلعة »
- Derja (Latin): « Ma 3andekch wa9t tekteb 3000 article? Njiw, nrakkbou, w n7ottou el stock. Enti tbi3. »
- Format: founder to camera, 9:16, 20–30 s, filmed in a shop.

**Concept 6: « Vos chiffres dans votre poche »** (multi-device; aimed at the next generation and multi-till shops). Asset: screen recording of 2 tills + phone.

- FR: « Deux caisses, un téléphone, les mêmes chiffres en direct. Ventes du jour, marges, articles bientôt en rupture : tout est là, en français ou en arabe. » Headline: « Vos chiffres, en direct »
- AR: « زوز كاسات وتليفون واحد، نفس الأرقام مباشرة. مبيعات النهار، الربح، والسلع اللي قربت توفى. » Headline: « أرقامك، مباشرة على تليفونك »
- Derja (Latin): « Zouz caisset w telifoun wa7ed, nafs el ar9am direct. »
- Format: 4:5 feed video, 15 s.

**Concept 7: testimonial** (replaces the weakest concept as soon as V5 exists). « {Prénom}, {Librairie} à {Ville} : "{citation}" » / « {الاسم}، {المكتبة} في {المدينة}: "{كلامو}" ».

**Pre-filled WhatsApp message in the ad:** FR « Bonjour, je veux une démo pour ma librairie. (réf. M) » / AR « السلام، نحب ديمو للمكتبة متاعي. (réf. M) ».

### 5.5 Formats and sizes

| Placement | Ratio | Pixels | Notes |
| --- | --- | --- | --- |
| Reels / Stories | 9:16 | 1080 × 1920 | Keep text out of the top 14% and bottom 35% [E: common safe-zone guidance] |
| Feed (FB/IG) | 4:5 | 1080 × 1350 | Best default for video and images |
| Carousel | 1:1 | 1080 × 1080 per card | 3–5 cards |
| Link image (organic shares) | 1.91:1 | 1200 × 630 | Same as `og:image` [F1] |

### 5.6 Budget, KPIs, rules (all [E])

- **20 DT/day** (≈ 600 DT for 30 days): M1 14 DT, M2 6 DT from day 8 (all 20 DT go to M1 in week 1).
- **Targets:** cost per WhatsApp conversation ≤ 8 DT; cost per qualified conversation ≤ 25 DT; cost per signed shop ≤ 400 DT. No public Tunisian benchmark was found; these come from the margin math in §4.7.
- **Rules:**
  - After 1,500 impressions, pause any ad with link CTR < 0.8% or cost per conversation > 15 DT.
  - After 7 days, keep the 2 best concepts per language and add 2 new ones. Creative fatigue is the main killer, so refresh every 2–3 weeks.
  - Scale the winning ad set by +20% every 3 days, never +100% at once.
- **Qualify in chat, not in targeting.** Many messages will come from non-bookshops. Use the quick replies (§7.1) to qualify in one exchange.

### 5.7 TikTok

- TikTok ad reach in Tunisia (18+): 6.0M (DataReportal, late 2025) [D1].
- Whether an advertiser registered in Tunisia can buy TikTok ads was **not verified**. TikTok's own help page says the markets available depend on the country an Ads Manager account is registered in [T1].
- **Use TikTok organically** (§6) with the same vertical videos. Re-check paid availability in the Ads Manager sign-up form before budgeting for it.

---

## 6. 30-day social media calendar (Fri 16 Oct – Sat 14 Nov 2026)

**Content pillars:**

| Pillar | Share |
| --- | --- |
| Product demos | 40% |
| Libraire pains and humour | 25% |
| Proof and clients | 15% |
| Team and behind the scenes | 10% |
| Shop tips | 10% |

**Cadence:**

- Facebook: 5 posts a week.
- Instagram: 4 feed posts + Stories daily (repost the FB content, polls).
- TikTok: 4 videos a week.
- Every caption comes in FR + AR (derja) in the same post: AR first on Facebook, FR first on Instagram [H; test both].
- Post at about 12:30 and about 20:30 Tunis time [H; check Insights after 2 weeks].
- Reply to every comment within the day; move interested people to WhatsApp.

**Production:**

- One filming session per week (2–3 hours) makes 4–5 videos.
- Use the demo kit (laptop + scanner + printer + demo shop data), so no client data ever appears on screen.

**Hashtags:**

- FR: #librairie #papeterie #rentreescolaire #tunisie #caisse #gestiondestock
- AR: #مكتبة #العودة_المدرسية #تونس #كرّاس_الكريدي

Keep 3–5 per post.

| Date | Pillar | Facebook | Instagram | TikTok |
| --- | --- | --- | --- | --- |
| Fri 16 Oct | Launch | Carousel 5 slides: « La caisse des librairies tunisiennes »: pain → 3 features → CTA démo | Same carousel + Story « Nouveau » | V1 « Bip, c'est vendu » 12 s |
| Sat 17 Oct | Pain | Question: « Qu'est-ce qui vous a le plus fatigué cette rentrée ? » / « شنوّة اللي تعّبك أكثر في العودة؟ » | Story poll: queue / stock / kridi | « POV : libraire le 15 septembre » (humour, derja) |
| Sun 18 Oct | Team | V6 founders: who we are, why bookshops | Reel V6 | V6 cut to 20 s |
| Mon 19 Oct | Demo | V3 carnet de crédit: « Qui doit quoi, depuis quand » | Reel V3 | — |
| Tue 20 Oct | Tip | Carousel « 5 choses à faire en octobre en librairie »: inventory, supplier returns, kridi follow-ups, best sellers, prepare 2027 | Same | Tip 1: inventory in 3 steps |
| Wed 21 Oct | Demo | V2 pack scolaire in one scan | Reel V2 | V2 |
| Thu 22 Oct | Behind the scenes | Photos: loading a shop's catalogue (no client data shown) | Stories behind the scenes | — |
| Fri 23 Oct | Proof / compare | Carousel « Carnet papier vs Mektebti » | Same | « Le kridi, version 2026 » (derja) |
| Sat 24 Oct | Humour | Meme: the customer who says « na3tik ghodwa » ("I'll pay you tomorrow") for the 10th time | Story | Sketch 15 s, same theme |
| Sun 25 Oct | Live | **FB/IG Live 20 min at 20:30**: live demo + questions (announce Thu and Sat) | Live (simulcast) | — |
| Mon 26 Oct | Demo [!] | V4 offline: « On coupe internet, on continue » (only if the field test passed; otherwise post V1 again with a new hook) | Reel V4 | V4 |
| Tue 27 Oct | Proof | Client spotlight: Librairie {X} (with permission) or « Notre première librairie » (anonymous) | Same | — |
| Wed 28 Oct | Demo | Dashboard on the phone: « Les chiffres du jour depuis votre téléphone » | Reel | Screen recording, 15 s |
| Thu 29 Oct | FAQ | « Faut-il un ordinateur neuf ? » (answer FAQ 5) | Story Q&A sticker | — |
| Fri 30 Oct | Demo / tip | « Combien vous rapporte vraiment un cahier 96 pages ? » (profit per article; use example numbers) | Reel | Same |
| Sat 31 Oct | Fun fact | Story quiz: « Quelle marge sur un manuel CNP ? » → 25% (CNP) | Story quiz | — |
| Sun 1 Nov | Tip | Carousel « 3 signes que votre stock vous fait perdre de l'argent » → low-stock alert | Same | — |
| Mon 2 Nov | Hardware | Unboxing: douchette + imprimante ticket 80 mm (what is included) | Reel | Unboxing 20 s |
| Tue 3 Nov | Demo | Purchases and supplier debts | Reel | — |
| Wed 4 Nov | Team | Founder story: « Pourquoi on a fait Mektebti » (text + photo) | Same | Talking head 30 s |
| Thu 5 Nov | FAQ | « Mes données sont-elles en sécurité ? » (data block bullets) | Story | — |
| Fri 6 Nov | Demo | Two tills, the same numbers live | Reel | Same |
| Sat 7 Nov | Humour | « La liste de la maîtresse » (the class supply list that arrives on the phone at 8 pm) | Story | Sketch |
| Sun 8 Nov | Live | Live #2 or recorded Q&A from DMs | Live | — |
| Mon 9 Nov | Demo (AR-first) | Full 60 s demo in derja | Reel | 60 s demo |
| Tue 10 Nov | Pain / math | Carousel « Combien coûte une erreur de caisse par jour ? » (worked example, labelled as an example) | Same | — |
| Wed 11 Nov | Proof | V5 testimonial (if filmed); otherwise « Une journée avec Mektebti » | Reel | Same |
| Thu 12 Nov | Offer | Referral: « Recommandez un confrère : {1 mois offert chacun} » (if approved) | Same | — |
| Fri 13 Nov | Tip | « Préparez vos packs 2027 dès maintenant » (bridge to §8) | Reel | Same |
| Sat 14 Nov | Recap | Carousel recap: best 4 videos + CTA démo | Same + Story highlight "Démo" | Best performer re-cut |

**Every post's CTA:** « Démo gratuite : écrivez-nous sur WhatsApp » / « ديمو بلاش: ابعثلنا على الواتساب » + the link with UTM `utm_source=facebook|instagram|tiktok&utm_medium=social&utm_campaign=organic_oct26`.

---

## 7. Sales script (WhatsApp and phone) and demo checklist

### 7.1 WhatsApp Business setup

- **Profile:** Mektebti.tn, category Software, description FR + AR (the bio in §2.10), hours, website `/decouvrir`.
- **Greeting message** (sent automatically on the first message):
  - FR: « Bonjour, merci d'avoir contacté Mektebti.tn, la caisse des librairies. Pour préparer votre démo : 1) le nom de la librairie, 2) la ville, 3) combien de caisses à la rentrée ? On vous répond très vite. »
  - AR: « عسلامة، يعطيك الصحّة على تواصلك مع Mektebti.tn، الكاسة متاع المكتبات. باش نحضّرولك ديمو: 1) اسم المكتبة 2) المدينة 3) قدّاش من كاسة في العودة؟ نجاوبوك فيسع. »
- **Away message:**
  - FR: « Merci ! Nous sommes en installation chez une librairie. Réponse avant {heure}. »
  - AR: « يعطيك الصحّة! احنا توّا نركّبو في مكتبة. نرجعولك قبل {الساعة}. »
- **Labels:** Nouveau · Qualifié · Démo planifiée · Devis envoyé · Client · Perdu · Pas une librairie.
- **Quick replies** (type `/` + keyword):

| Shortcut | FR | AR |
| --- | --- | --- |
| /prix | Mensuel 83 DT/mois (moins de 3 DT/jour), 1er mois offert, mise en service 500 DT avec douchette + imprimante + installation + chargement du stock. Autres formules : {annuel}, {à vie}. Prix {TTC}. | الشهري 83 د (أقل من 3 د في النهار)، الشهر الأول بلاش، التركيب 500 د فيه السكانر والطابعة والتركيب ونحطّو السلعة. عروض أخرى: {سنوي}، {مدى الحياة}. |
| /materiel | Douchette {modèle} + imprimante ticket 80 mm {modèle}, installées et testées. Vous avez déjà du matériel ? Envoyez une photo de l'étiquette, on vérifie. | سكانر {الموديل} + طابعة تيكيات 80 مم {الموديل}، نركّبوهم ونجرّبوهم. عندك معدّات؟ ابعثلنا تصويرة الإتيكات ونثبّتو. |
| /internet [!] | La caisse continue de vendre quand internet coupe et synchronise au retour. L'installation et la 1re connexion demandent internet. | الكاسة تكمّل تبيع كي يقصّ الإنترنت وتتزامن كي يرجع. التركيب وأوّل دخول يلزمهم إنترنت. |
| /stock | On saisit vos articles pour vous : envoyez votre Excel ou des photos de factures fournisseurs. Les manuels CNP sont déjà au catalogue au prix officiel. | احنا نكتبو السلع: ابعثلنا Excel ولا تصاور فواتير المزوّدين. كتب CNP موجودة بالسوم الرسمي. |
| /donnees | Hébergées à Paris (UE), séparées des autres librairies, exportables à tout moment (Excel + sauvegarde). | مخزّنة في باريس، مفصولة على المكتبات الأخرى، وتنجم تصدّرها وقت ما تحب. |
| /demo | On vient avec le matériel, 20 minutes dans votre librairie. Je vous propose {jour 1 heure} ou {jour 2 heure}. Envoyez-moi votre localisation. | نجيوك بالمعدّات، 20 دقيقة في مكتبتك. نقترح عليك {نهار 1 الساعة} ولا {نهار 2 الساعة}. ابعثلي اللوكاليزاسيون. |

### 7.2 First reply (by a human, within 1 hour)

- FR: « Bonjour {Si Prénom}, ici {Prénom} de Mektebti. Merci pour votre message. Votre librairie est à {ville}, c'est ça ? Vous travaillez aujourd'hui avec un cahier, Excel ou un autre logiciel ? »
- AR: « عسلامة {سي الاسم}، معاك {الاسم} من Mektebti. يعطيك الصحّة على الميساج. المكتبة متاعك في {المدينة} صحيح؟ توّا تخدم بالكرّاس، Excel ولا برنامج آخر؟ »

Prefer a **voice note** (30 s) for 45+ owners [H]. Many prefer listening to reading.

### 7.3 Qualification (5 questions, in the chat or by phone)

1. Librairie-papeterie or another trade? Since when?
2. About how many articles? How many tills at the rentrée?
3. Today: cahier, Excel or software (which one)? What annoys you most about it?
4. Is there a PC at the counter? Internet (ADSL, fibre, 4G)?
5. Who decides? When do you want to be ready?

**Score:**

- **A** = librairie-papeterie + in your zone + the owner or the child who decides + wants it before the next rentrée. Book the demo now.
- **B** = 2 of those. Nurture: send V1 and V3, call back in 2 weeks.
- **C** = not a librairie, or out of zone. Thank them, refer them on, and label "Pas une librairie".

### 7.4 Phone script (5–7 minutes; French with derja, adapt freely)

1. **Opening (15 s).** « Ahla Si {Nom}, {Prénom} de Mektebti, la caisse des librairies. Vous nous avez écrit sur WhatsApp. Je vous prends trois minutes ? »
2. **Discovery (2 min).** « C'était comment, la rentrée cette année ? » Let him talk. Then: « Et le kridi, vous le suivez comment ? » and « Quand internet coupe, vous faites comment ? »
3. **Mirror (20 s).** « Si je comprends bien : la file à la rentrée, et le carnet qui déborde. C'est ça ? »
4. **Pitch: 3 points tied to what he said (1 min).**
   - "Packs: toute la liste d'une classe en un scan."
   - "Le kridi s'inscrit tout seul quand vous vendez à crédit."
   - "On installe et on charge votre stock, vous n'avez rien à saisir."
5. **Proof (20 s).** « Librairie {X} à {ville} l'utilise depuis {mois}. {Si permission: Vous pouvez l'appeler.} »
6. **Offer (20 s).** « Le mieux, c'est de le voir chez vous : 20 minutes, on vient avec le matériel. »
7. **Close with two options.** « Mardi à 10 h ou jeudi à 15 h ? » Then: « Envoyez-moi la localisation sur WhatsApp. »
8. **If "c'est cher":** « Je comprends. C'est moins de 3 DT par jour, matériel compris, et le premier mois est offert. Une seule erreur de rendu de monnaie ou un kridi oublié, ça coûte combien ? » Then the pay-once option.
9. **If "pas maintenant":** « Pas de souci. Les installations, c'est d'octobre à juin, pour être prêt en juillet. Je vous rappelle le {date} ? »

For the full objection answers, see doc 01 §3.5. **Never say:** « homologué », « conforme NACEF », « le fisc ne verra rien », « la seule », « la meilleure », or « 100 % hors ligne » before the field test.

### 7.5 Follow-up cadence

| Day | Channel | Message |
| --- | --- | --- |
| D0 | WhatsApp | Recap + demo slot (or V1 if no slot) |
| D+2 | WhatsApp | Video V3 (carnet) or V2 (packs), whichever matches his pain |
| D+7 | Call | « Vous avez pu y réfléchir ? » + new slot |
| D+14 | WhatsApp | Testimonial (V5) or client photo |
| D+30 | WhatsApp | Seasonal hook (inventory in Nov, rentrée prep from Feb) |

After D+30, move the lead to the "B nurture" list and contact it monthly. Stop if he asks.

### 7.6 Demo checklist

**Before (D-1):**

- [ ] Confirm day, time and the WhatsApp location pin. Ask who will be present: the decider **and** the daily user.
- [ ] Ask for: a photo of 1 supplier invoice, 10 best-selling barcodes (or photos), and one class supply list from his school.
- [ ] Demo shop account (a dedicated demo tenant created by the founder through the admin CLI, **never a real client's account**), loaded with a bookshop catalogue + his 10 items + 1 pack built from his list.
- [ ] Laptop charged, charger; scanner + 80 mm printer + **paper roll**; USB hub; 4G hotspot.
- [ ] Offline scenario rehearsed on the same laptop the same morning [!].
- [ ] Phone logged into the same demo shop (live sync moment).
- [ ] Printed: A5 flyer with QR to `/decouvrir?utm_source=flyer`, price sheet {TTC}, CGV summary (doc 02 §6.2).
- [ ] UI language set to his (Arabic for most owners over 45 [H]).

**During (20 minutes; let him scan himself as early as possible):**

1. [ ] He scans 3 of his own items → ticket prints. (The "wow" moment; stop and let it land.)
2. [ ] Sell the pack from his school list in one scan.
3. [ ] Credit sale to a named customer → open the carnet → print it.
4. [ ] [!] Unplug the router or turn off the hotspot → sell 2 items → plug back → show sync.
5. [ ] On the phone: today's sales appear live.
6. [ ] Switch FR ⇄ عربي.
7. [ ] Profit per article / low-stock alert.
8. [ ] Export / backup: « vos données sont à vous ».
9. [ ] Price, plan choice, **install date proposal** (two dates), what you need from him (Excel or invoices).

**After (same day):**

- [ ] WhatsApp recap (FR/AR) with the plan, price, the install date options and the list of what to send.
- [ ] Update the lead sheet. Follow up D+2 and D+7.
- [ ] If no: ask « Qu'est-ce qui vous a manqué ? » and « Vous connaissez un confrère que ça intéresserait ? »

### 7.7 Lead sheet (Google Sheet) columns

Date · Source (G / M / O / field / referral) · Ref code · Name · Librairie · City / governorate · Phone · Score A/B/C · Current tool · Tills · Status (label) · Demo date · Plan · Signed date · Install date · Lost reason · Next action + date.

**Access:** founders only. This is personal data, so declare it (doc 02 §5.3).

---

## 8. Rentrée-scolaire campaign

Install window: October to June; no installs from about 1 August to about 10 October (doc 01 §1.5). The campaign works backwards from that.

### 8.1 Wave 0, now: « Après la rentrée » (16 Oct – 20 Dec 2026)

- **Message:** « La rentrée, plus jamais comme ça » + « le kridi qui déborde ».
- **Channels:** field visits in clusters (doc 01 §4), Meta concepts 1, 3, 5, Google C1 + C2.
- **Offer:** standard plan + **« Installé avant Noël »**: book a demo in October or November, installation in November or December.
- **KPI:** demos booked, installs done before 20 Dec.

### 8.2 Main campaign: « Rentrée 2027 : prêts avant juillet » / « العودة المدرسية 2027: حاضرين قبل جويلية »

**Promise:** your packs, your stock and your till are ready before the July rush, installed by us.

The scarcity is real: two people can only install a limited number of shops a week. Say so: « {N} installations par semaine » / « {N} تركيبات في الجمعة ».

| Phase | Dates | Goal | Offer (founder to decide) | Channels and creative | Budget/day [E] |
| --- | --- | --- | --- | --- | --- |
| **A. Early bird** | 11 Jan – 28 Feb 2027 | Fill February–April install slots | « Signez avant le 28 février : {2e mois offert} » + free pre-built packs for primary classes 1–6 from the Ministry's official supply list | Meta concepts 1, 2, 5; Google C1 + C2 with the "Prêt pour la rentrée 2027" headline; chambers and wholesalers (doc 01 §4); `/rentree-2027` page live | Meta 15 + Google 10 |
| **B. Main push** | 1 Mar – 15 May 2027 | Peak closing season (doc 01 §4.2) | Standard + « Pack Rentrée » service: we build your packs from your schools' lists | All 6 concepts + testimonial; retargeting; FB/IG Lives « Préparer sa rentrée » every 2 weeks; Google full | Meta 30 + Google 20 |
| **C. Last call** | 16 May – 30 Jun 2027 | Last installs | « Dernières installations avant juillet : {N} places » | Retargeting only + WhatsApp broadcast to **opted-in** leads only (doc 02 art. 30) + field follow-ups | Meta 15 retargeting + Google 15 |
| **D. Freeze** | 1 Jul – 10 Oct 2027 | Support clients; collect leads for October | « Réservez votre installation d'octobre » | Organic: client rentrée videos (the best proof of the year); flyers outside CNP agencies in early July (no implied CNP endorsement, doc 01 §4.1); Back to School salon if present | Meta 5 (lead capture) |

### 8.3 Creative and copy for the campaign

**Hero line:**

- FR: « Rentrée 2027 : vos packs prêts avant juillet. »
- AR: « العودة 2027: الباكات متاعك حاضرة قبل جويلية. »

**Sub-line:**

- FR: « On installe la caisse, on charge votre stock et on prépare les packs de vos écoles. Le jour J, un scan par élève. »
- AR: « نركّبو الكاسة، نحطّو السلعة، ونحضّرو باكات مدارسك. ونهار العودة، سكان واحد لكل تلميذ. »

**Proof to collect in September 2027:** rentrée-day numbers from client shops (tickets per hour, packs sold), with permission. This becomes the 2028 campaign.

**Formats:**

- A countdown Story every Monday (« J-{n} avant juillet »).
- A carousel « Votre planning rentrée » (Feb: demo → Mar: install → Apr: packs → May: training of seasonal staff → July: ready).

### 8.4 Rentrée landing variant

- `/rentree-2027` (FR) and `/ar/rentree-2027` (AR), prerendered like §2.3, in the sitemap with hreflang.
- Same copy deck, with the rentrée block moved to the top, a planning timeline, the {N}-slots line, and a FAQ on preparing packs.
- Google ads for "Prêt pour la rentrée 2027" headlines and all phase A–C Meta ads point here.

### 8.5 Existing clients: the rentrée programme (retention + proof)

- **May:** a review call. Update the packs for the new lists, train the seasonal staff (30 minutes), check the hardware and paper rolls.
- **Rentrée week:** priority WhatsApp line ({hours}; founder decision).
- **October:** ask for the testimonial and the Google review, with no incentive [G7]. Ask for 2 referrals.

---

## 9. Measurement: one weekly table

| Week | Spend Google | Spend Meta | WA clicks (Ads) | Real conversations | Qualified (A) | Demos | Signed | Cost per A | Cost per signed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | | | | |

Fill it from Google Ads, Meta Ads Manager and the lead sheet (§7.7).

**Review rule:** a channel that has spent > 400 DT with **0 qualified leads** is paused and rethought, not tweaked.

---

## 10. Decisions only the founder can make

They are listed in the structured summary; details here.

1. **Domain:** is mektebti.tn owned and connectable to Netlify now? That sets `{ORIGIN}`.
2. **The numbers on the page:**
   - final plans (fix the annual anomaly), TTC or HT;
   - when the 500 DT is paid vs the free month;
   - "sans engagement" yes or no;
   - the price for "I already have hardware";
   - hardware models and warranty;
   - payment methods;
   - what "à vie" means (doc 02 §4.7).
3. **Proof:** written permission to name, photograph and film Librairie Sofiene (and the second client) for the page, the ads and a Google review.
4. **Claims sign-off:**
   - the offline claims [!] only after the field test;
   - FAQ 10 (homologation) wording validated by the accountant;
   - stated service promises: reply time, support hours, install lead time, "démo gratuite chez vous", the zones served.
5. **Budget:**
   - ≈ 1,050 DT for the first 30 days (Google 15 DT/day + Meta 20 DT/day);
   - the card to use;
   - the reverse-charge VAT set-up with the accountant (doc 02 §4.5).
6. **Offers:**
   - referral reward (e.g. 1 month each);
   - "Installé avant Noël";
   - rentrée early bird (before 28 Feb);
   - the "Pack Rentrée" service;
   - weekly install capacity {N}.
7. **Tracking:** consent banner + GA4 + Ads + Meta Pixel (doc 02 §8, item 9), or launch without the Pixel.
8. **Brand:** accept that « مكتبتي » is generic (bid only on the Latin "Mektebti"); check the same-name shops; run an INNORPI search.
9. **People and time:**
   - who answers WhatsApp, and in what hours;
   - who films and posts (~5 h/week);
   - whether the founders appear on camera.
10. **Lead form:** Netlify Forms (data processed abroad, so mention it in the privacy policy) or WhatsApp and phone only.
11. **Demo tenant:** create a dedicated demo shop account through the admin CLI for field demos and filming.

---

## 11. Implementation tasks (repo)

The same list is in the structured output, with priorities. Details:

| # | Priority | Files | Change |
| --- | --- | --- | --- |
| 1 | now | `public/robots.txt` (new) | Content of §2.6 |
| 2 | now | `public/sitemap.xml` (new; later generated) | Content of §2.6 with the current origin |
| 3 | now | `netlify.toml` | Manifest `Content-Type: application/manifest+json`; `/brand/*` and `/og/*` cache 7 days (§2.7) |
| 4 | now | `index.html` | Stop-gap until the prerender ships: canonical, OG/Twitter tags, `og:image`, JSON-LD Organization + SoftwareApplication (FR). Then, once static pages exist: `<meta name="robots" content="noindex">` on the shell |
| 5 | now | `public/og/mektebti-fr-1200x630.png`, `public/og/mektebti-ar-1200x630.png` (new) | OG images (§1.7) |
| 6 | now | `src/features/landing/copy.ts` | New copy deck FR + AR (§1.6): `seo`, `hero.micro`, `facts`, `rentree`, `offline` ([!] variant), `hardware`, `testimonial`, `steps` lines, `pricing` notes, `data`, `faq`, `team`, `final.call`, `footer` links, `waText` with city. Delete or render `hero.chips`. |
| 7 | now | `src/features/landing/LandingPage.tsx` | Pure `lang` prop; `<a href="/login">`; language link to `/ar/decouvrir` / `/decouvrir`. New sections in the §1.5 order: FAQ with `<details>`, data, hardware, offline, testimonial (hidden when empty), team. `tel:` link; `data-cta` attributes on every CTA; section ids `#materiel`, `#rentree`, `#faq`; mobile sticky bar; footer legal links (doc 02 G11) |
| 8 | now | `src/features/landing/landing.css` | Styles for the new blocks, `details/summary`, sticky bar (with bottom padding so nothing is covered), RTL check of the sticky bar |
| 9 | now | `src/features/landing/seo.ts`, `src/features/landing/entry-server.tsx`, `scripts/prerender-landing.mjs` (new); `package.json` build script | Static prerender per §2.3: writes `dist/_m/decouvrir-{fr,ar}.html` and `dist/sitemap.xml`; inline minified CSS; head tags §2.4; JSON-LD §2.5; inline script (consent, events, WA channel ref, `localStorage.lang`); `SITE_ORIGIN` env var |
| 10 | now | `public/_redirects` | Forced rewrites for `/decouvrir` and `/ar/decouvrir` above `/*` (§2.7) |
| 11 | now | `src/App.tsx`, `src/auth/RequireAuth.tsx`, `src/features/auth/LoginPage.tsx` | `LandingRoute` wrapper + `/ar/decouvrir` SPA route; root visitors → `window.location.replace('/decouvrir')`; the login logo becomes a plain `<a>` |
| 12 | now | `scripts/pwa.ts` | Navigation bypass for marketing paths (§2.8). Make sure no marketing HTML contains the app entry script. |
| 13 | now | (with the consent work of doc 02) static landing only | Consent banner FR/AR, Consent Mode v2 default denied, GTM after consent, `dataLayer` events §4.7; nothing in app routes |
| 14 | soon | Static landing + Netlify | Call-back form (Netlify Forms, hidden `utm_*` and `gclid`) + privacy line |
| 15 | soon | `seo.ts` | `google-site-verification` and `msvalidate.01` tokens |
| 16 | soon | `/rentree-2027` + `/ar/rentree-2027` (prerender script) | Rentrée landing variant (§8.4), live by 11 Jan 2027 |
| 17 | soon | `public/_redirects` | When mektebti.tn is live: 301 the **two marketing paths only** from netlify.app to mektebti.tn; switch `SITE_ORIGIN` |
| 18 | later | `public/_redirects`, `public/404.html` | Replace the `/*` catch-all with explicit app routes + a real 404 (T5), tested on every route |
| 19 | later | Prerender script | SEO articles (§2.11): caisse enregistreuse/loi (accountant-validated), packs, kridi |
| 20 | later | `shopMachine.ts` + `_redirects` | Optional: landing at `/` for non-shop visitors via the `mk_shop` cookie condition, only after a test on real tills |

---

## 12. Sources and methods

All accessed **15 October 2026**.

### Measured by me [M]

| Method | What | How |
| --- | --- | --- |
| **M1** | Live page `https://libsystem-tn.netlify.app/decouvrir` | Playwright 1.56 + Chromium 1194, viewports 1366 × 800 and 390 × 844 (isMobile), FR and AR via `localStorage.lang`; counted words, H1/H2, requests and encoded body sizes, service-worker registration, horizontal overflow at 360/390 px |
| **M2** | HTTP headers | `curl -D -` on `/`, `/decouvrir`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/brand/logo-on-light.png` |
| **M3** | Google Autocomplete | `https://suggestqueries.google.com/complete/search?client=firefox&gl=tn&hl={fr|ar}&q=…` for about 60 seed phrases. It shows that queries exist, not how many. |
| **M4** | Meta Ad Library | `https://www.facebook.com/ads/library/?country=TN&ad_type=all&active_status=all&q=…` for: logiciel caisse, logiciel de gestion stock, caisse enregistreuse, librairie logiciel, librairie papeterie, pack scolaire, Swiver, Hesabi, Cyber Gerance, Kul Digital, ASM-POS, Lexxi Digital. Any ad: `https://www.facebook.com/ads/library/?id={ID}` with the IDs in §5.2. "Gastevo" returned no ads. |

### Published sources

| # | Source |
| --- | --- |
| G1 | Google Ads Help, *About responsive search ads* (15 headlines ≤ 30, 4 descriptions ≤ 90, paths ≤ 15): https://support.google.com/google-ads/answer/7684791 |
| G2 | Google Ads API geotargets, file `geotargets-2026-10-06.csv` (16 Tunisian governorates as "Governorate" targets; Manouba absent): https://developers.google.com/google-ads/api/data/geotargets |
| G3 | Google Search Central blog, 8 Aug 2023, *Changes to HowTo and FAQ rich results*: https://developers.google.com/search/blog/2023/08/howto-faq-changes |
| G4 | Google Search Central, *Software app (SoftwareApplication) structured data*: https://developers.google.com/search/docs/appearance/structured-data/software-app |
| G5 | Google Business Profile Help, *Guidelines / eligibility (in-person contact, service-area businesses)*: https://support.google.com/business/answer/7039811 |
| G6 | Google Analytics Help, *Currency reference* (lists Tunisian Dinar, TND): https://support.google.com/analytics/answer/9796179 |
| G7 | Google Maps user-contributed content policy, *Prohibited and restricted content* (incentivised reviews, selective solicitation): https://support.google.com/contributionpolicy/answer/7400114 |
| F1 | Meta for Developers, *Images in link shares* (≥ 1200 × 630, ~1.91:1, min 200 × 200): https://developers.facebook.com/docs/sharing/webmasters/images |
| F2 | Jon Loomer (practitioner, quoting Meta docs), *Meta Ads Lookalike Audiences* (≥ 100 people from one country; 1,000–5,000 recommended): https://www.jonloomer.com/meta-ads-lookalike-audiences/ |
| N1 | Netlify Docs, *Redirects overview, rule processing order* ("Rules in the _redirects file are always processed first"): https://docs.netlify.com/manage/routing/redirects/overview/ |
| N2 | Netlify Docs, *Redirect options* (forced `200!`, cookie-presence conditions, Pretty URLs): https://docs.netlify.com/manage/routing/redirects/redirect-options/ |
| N3 | Netlify Docs, *Understand domains* ("The Netlify subdomain URLs will always work even if you set up a custom domain"): https://docs.netlify.com/manage/domains/domains-fundamentals/understand-domains/ |
| K1 | Kolonell (Tunis agency, vendor content), 11 Oct 2026, *Choisir une agence Google Ads à Tunis* (B2B CPC in Tunisia "0,4 à 2,5 TND", orders of magnitude): https://kolonell.com/fr/blog/choisir-agence-google-ads-tunis-2026 |
| D1 | DataReportal, *Digital 2026: Tunisia* (ad reach: Facebook 7.80M, Instagram 4.05M, TikTok 18+ 6.00M, YouTube 7.83M, Messenger 5.85M; late 2025): https://datareportal.com/reports/digital-2026-tunisia |
| T1 | TikTok Ads Help, *Available location targeting options by market*: https://ads.tiktok.com/help/article/placements-available-locations |
| Doc 01 | `docs/launch/01-market-research.md` (personas §3, objections §3.5, competitors §2, claims to avoid §5.3, seasonality §1.5, channels §4) |
| Doc 02 | `docs/launch/02-legal-fiscal-compliance.md` (consent §5.4, legal pages §6, gaps G1 and G11, payments to foreign ad platforms §4.5) |

### Searched for but not found

- Google Keyword Planner volumes (needs an Ads account).
- A public cost-per-message or CPM benchmark for Meta in Tunisia.
- Official confirmation that Google Ads bills in TND.
- Whether TikTok Ads Manager accepts advertisers registered in Tunisia.
- Whether mektebti.tn is registered: unreachable from this sandbox.
- Who is behind the « مكتبتي المروج 6 » and « مكتبتي اريانة » Autocomplete entries.
