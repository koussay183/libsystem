# 01 — Market research: Mektebti.tn for Tunisian librairies-papeteries

| | |
| --- | --- |
| Date | 15 October 2026 (one month after the 2026-2027 rentrée) |
| Scope | Market size, competitors, buyer personas, channels, positioning |
| Method | Desk research (official sites, Tunisian press, vendor pricing pages, INS RNE 2025 PDF) + reading this repo to check which product claims are true |
| Status | Desk research only. **Nothing here has been checked with shop owners yet.** Section 3.6 has the interview plan to fix that. |

**How to read the labels**

- **[F]** Fact, with a source in brackets, e.g. [S1]. All sources are listed in section 8.
- **[E]** My estimate. The assumptions are given and it can be wrong.
- **[H]** A hypothesis to check in the field.

Money is in Tunisian dinars (DT / TND). Tunisian sources write 9,600 DT to mean 9 dinars 600 millimes. In this document I write **9.600 DT** for that, so it is not confused with thousands.

---

## 0. Executive summary

1. **The market is about 6,500 shops, not 50.** In Tunisia a "librairie" is mostly a stationery shop that also sells the state textbooks. The Centre National Pédagogique (CNP) says its distribution network has "pas moins de 6500 libraires" [F, S1]. The president of the Chambre nationale des libraires repeated "près de 6 500 librairies" in September 2026 [F, S2]. The count was ~4,500 in 2018 [F, S3]. Shops that mainly sell books are only 20–100 [F, S4, S5], so they are a niche.
2. **Who to sell to:** the permanent, year-round librairie-papeterie with real stock depth. I estimate **1,600–2,600 shops** [E] (section 1.2). Small seasonal sellers that open only for the rentrée are not a target at 83 DT/month.
3. **Where they are:** about 60% sit in four zones: Grand Tunis, the Sahel (Sousse/Monastir/Mahdia), Sfax and Nabeul [E]. This uses INS RNE 2024 retail counts per governorate as a proxy [F, S6].
4. **The year is shaped by the rentrée.** Shops buy CNP textbooks from July [F, S1, S13], textbooks are on shelves by mid-August, and classes start mid-September (15 Sept 2026) [F, S7]. Shops cannot change their till in August or September. **The selling window is October to June. Installations must be finished by early July.** The window open right now (mid-October to December) is the post-rentrée inventory and credit-collection period.
5. **Money flows** [F]: about 2.34M pupils [S7]; about 15–16M textbooks a year [S8, S12], priced around 2.400–5.200 DT each, with a fixed 25% margin for the libraire [S1]; subsidised notebooks at 0.430–1.400 DT [S9, S10]. The CNP margin pool alone comes to roughly 2,000+ DT per shop per year on average [E].
6. **There are many competitors, but none is built for bookshops.** Tunisian cloud tools cost about 365–790 DT/year (Caissa, Hesabi, Swiver) or 20–49 DT/month (Gastevo, Finco). Desktop licences cost 499–3,900 DT one-off (Megasoft, SharPOS, Expert Gestion, Tassaruf). Loyverse is free. No Tunisian vendor I reviewed lists librairies as a target or has school packs [F, S23–S35]. The two cloud POS tools whose pages are explicit **need internet** (Gastevo, Hesabi) [F, S23, S26].
7. **Mektebti is at the top of the price range.** Year one on the monthly plan costs 1,413 DT including hardware. That price only works if Mektebti is sold as a **done-for-you service for bookshops** (hardware, installation, catalogue loaded, training, WhatsApp support), not as "another caisse app".
8. **Legal context** [F, S42, S43]. The NACEF fiscal cash-register rules cover on-site food and drink (cafés, restaurants), not retail. TEIF e-invoicing under LF 2026 art. 53 covers *services*, and its application was postponed in April 2026. Neither is a reason to buy *today* for a bookshop. Neither is a feature Mektebti should claim. An accountant should confirm this before any FAQ goes public.
9. **Channels:** door-to-door in clusters, then the bookseller chambers (national + regional), stationery wholesalers, WhatsApp referrals from existing clients, then geo-targeted Meta ads (Facebook ad reach 7.8M [F, S20]). Card terminals are rare (43,116 in the whole country in 2025 [F, S22]), so these are cash-and-credit shops.
10. **Positioning:** *"La caisse des librairies tunisiennes"*: packs scolaires in one scan, the carnet de crédit, millime-exact stock, Arabic + French, keeps selling without internet, installed and loaded for you. All five differentiators in section 5 are backed by code in this repo.

---

## 1. Target market size

### 1.1 How many "librairies" are there? The sources disagree because they count different things

| Count | What is counted | Source | Date |
| --- | --- | --- | --- |
| **"pas moins de 6500 libraires"** | Private sellers in the CNP textbook distribution network. Each must buy from its governorate's CNP agency and gets a 25% margin. | CNP, *Vente aux libraires* [S1] | page undated; checked 15 Oct 2026 |
| **"près de 6 500 librairies … ouvertes"** | Shops open across the country at the 2026 rentrée | Jamel Eddine Dardour, president of the *Chambre nationale des libraires*, in La Presse [S2] | 9 Sept 2026 |
| "près de 4500 librairies" | Shops whose demand the CNP prints for | Belgacem Lassoued, then CNP director general, in Webdo [S3] | 8 Aug 2018 |
| 80–100 | Shops that **mainly sell books**, mostly in Grand Tunis. Same interview: *"la librairie en Tunisie … c'est de la papeterie"* | Habib Zoghbi, Syndicat des libraires et distributeurs du livre tunisien, in Livres Hebdo [S4] | 2022 |
| 20 / 50 | "Physical bookshops" in the UNESCO book-industry survey (other sources say 20, the national authority says 50) | Kapitalis, UNESCO data [S5] | 2023 data, published June 2025 |
| 245,409 | **All** private retail enterprises (NAT 47, excluding vehicles). The INS publication does not split out books/stationery. | INS, *Statistiques issues du RNE* 2025, data RNE 2024 [S6] | 2025 |

**Reading [E]:** the number that matters for Mektebti is the **~6,500 shops selling school books and stationery**. The 20–100 "pure" bookshops are a separate niche (chains such as Al Kitab or Culturel). They are worth having as references, but the volume is not there. The jump from ~4,500 (2018) to ~6,500 (2026) may reflect growth, or a looser definition in an oral statement. Neither source gives a method.

**Data gap:** INS does not publish 4-digit activity codes such as "commerce de détail de livres / de papeterie". To get a real list by governorate, ask the CNP for its list of client libraires (it publishes a "Trouvez un livre" locator by governorate and délégation [S13]), or buy an extract by activity from the Registre National des Entreprises.

### 1.2 Segmenting the ~6,500 shops [E]

| Tier | Description | Estimated count | Fit for Mektebti |
| --- | --- | --- | --- |
| **A. Year-round librairie-papeterie** | Open 12 months. Typically 1,000–5,000 SKUs (notebooks, pens, school and office supplies, CNP + parascolaire books, gifts/toys, photocopy and printing). 1–3 people, extra hands at the rentrée. Has regular customers on credit. | **1,600–2,600** (25–40% of 6,500) | **Core target.** The 740-product catalogue Librairie Sofiene imported at cut-over (SAAS.md) fits this profile. |
| **B. Small / mixed / seasonal** | Kiosk, taxiphone or bazaar with a stationery corner, or a "librairie d'occasion" that opens only for the season and buys second-hand textbooks and notebooks [F, S10] | 3,500–4,800 | Poor fit at current prices. Later candidate for a cheaper "saison" plan [H]. |
| **C. Pure bookshops and chains** | 20–100 shops [S4, S5], often in Grand Tunis, some multi-store, some already on Librisoft/Odoo/Sage | 20–100 | Good for references and PR. Harder sale (incumbent software, multi-store needs). |

The 25–40% Tier A share is an assumption. A 2010 Le Temps article, indexed by search engines but unreachable on 15 Oct 2026, reportedly split the network into roughly 1,000 permanent and 3,500 seasonal libraires. I could not verify it. **Validate the share cheaply:** walk two délégations (one urban, one inland) and count open / seasonal / Tier A shops. Do it again in February, when seasonal shops are closed.

### 1.3 By governorate (proxy) [E]

No published count of librairies by governorate exists. The table spreads the 6,500 (and a 2,000 Tier A midpoint) in proportion to each governorate's share of retail enterprises in the INS RNE 2024 [F, S6]. CNP quotas follow pupil numbers per region [S1], which roughly track population. **Use this to plan field routes, not as a census.**

| Governorate | Retail enterprises (RNE 2024) [S6] | Share | ~Librairies (of 6,500) | ~Tier A (of 2,000) |
| --- | ---: | ---: | ---: | ---: |
| Tunis | 31,764 | 12.9% | ~840 | ~260 |
| Sfax | 21,471 | 8.7% | ~570 | ~170 |
| Nabeul | 20,620 | 8.4% | ~550 | ~170 |
| Sousse | 19,283 | 7.9% | ~510 | ~160 |
| Ben Arous | 15,549 | 6.3% | ~410 | ~130 |
| Ariana | 13,952 | 5.7% | ~370 | ~110 |
| Bizerte | 12,841 | 5.2% | ~340 | ~100 |
| Monastir | 12,036 | 4.9% | ~320 | ~100 |
| Médenine | 10,508 | 4.3% | ~280 | ~90 |
| Manouba | 9,529 | 3.9% | ~250 | ~80 |
| Mahdia | 9,526 | 3.9% | ~250 | ~80 |
| Kairouan | 9,510 | 3.9% | ~250 | ~80 |
| Gabès | 7,106 | 2.9% | ~190 | ~60 |
| Jendouba | 7,035 | 2.9% | ~190 | ~60 |
| Béja | 6,789 | 2.8% | ~180 | ~60 |
| Sidi Bouzid | 6,491 | 2.6% | ~170 | ~50 |
| Kasserine | 6,361 | 2.6% | ~170 | ~50 |
| Gafsa | 5,510 | 2.2% | ~150 | ~40 |
| Le Kef | 4,120 | 1.7% | ~110 | ~30 |
| Zaghouan | 3,948 | 1.6% | ~100 | ~30 |
| Siliana | 3,776 | 1.5% | ~100 | ~30 |
| Kébili | 3,142 | 1.3% | ~80 | ~30 |
| Tataouine | 2,570 | 1.0% | ~70 | ~20 |
| Tozeur | 1,972 | 0.8% | ~50 | ~20 |
| **Total** | **245,409** | 100% | **6,500** | **2,000** |

**Clusters for field sales [E]:**

- **Grand Tunis** (Tunis + Ariana + Ben Arous + Manouba): ~29%, ~1,870 shops, ~580 Tier A
- **Sahel** (Sousse + Monastir + Mahdia): ~17%, ~1,080 shops
- **Sfax**: ~9%, ~570 shops
- **Nabeul / Cap Bon**: ~8%, ~550 shops
- **Together: ~62% of the market** within about 2.5 hours' drive of Tunis.

### 1.4 TAM / SAM / SOM [E]

Assumes the current list price of 83 DT/month (996 DT/year), ignoring setup fees and VAT.

| | Shops | Annual recurring revenue at 996 DT | Notes |
| --- | ---: | ---: | --- |
| TAM: the whole CNP network | ~6,500 | ~6.5M DT | Theoretical; includes seasonal shops |
| **SAM: Tier A** | **1,600–2,600** | **1.6–2.6M DT** | The realistic addressable base |
| SOM: 12 months, 2 people | 40–80 shops | 40–80k DT ARR, plus 500 DT setup each | Capacity-bound (see below) |

The SOM is limited by onboarding capacity, not demand. Each install needs a visit, hardware, catalogue loading and training. Two people working October–June (about 30 selling weeks, excluding August and September) might close 1.5–3 shops/week if roughly 10% of field visits convert [H]. Treat **30 paying shops by 30 June 2027** as a stretch-but-possible target, not a forecast.

### 1.5 Seasonality: the rentrée economy

**Calendar** [F unless marked]:

| When | What happens in the shop | Source |
| --- | --- | --- |
| Early July | Libraires start buying CNP textbooks from their governorate agency or the CNP site (2023: from 3 July; 2026: "since July" per Dardour) | [S1]; Webdo 2023: https://www.webdo.tn/fr/actualite/national/les-manuels-scolaires-disponibles-a-partir-du-3-juillet/206949/ ; Tunisie Numérique (Dardour, undated): https://www.tunisienumerique.com/?p=867490 |
| July–August | Pre-orders and lists. The owner buys stock from wholesalers on payment terms; subsidised notebooks must be **paid cash** | [S11] |
| 15 Aug (target) | Textbooks expected on shelves (Education minister's 2026 target, per Arabic press) | Radio Express FM / Tunisie Numérique AR (see S13) |
| Late Aug – Sept | Subsidised-notebook distribution (Grand Tunis first, inland a week later), queues, quotas, price controls | [S2], [S10], [S17] |
| **15 Sept 2026** | Classes start: 2.341M pupils (1.195M primary, 1.146M collège/lycée), 6,178 schools | [S7] |
| Mid-Sept – Oct | Tail of the rentrée; returns and exchanges; settling with suppliers | [H] |
| Oct – Dec | Inventory of what is left, unpaid credit (carnet) to collect, year-end accounts | [H] |
| Jan – June | Regular trade: office supplies, gifts, exam season (parascolaire), new-term needs | [H] |

**Numbers that size the rentrée [F]:**

- **Textbooks.** The CNP edits 314 titles, about 16M copies; 206 titles and about 15–15.9M copies are for pupils [S8, S12]. In 2026-2027, a full set costs **9.600 DT** for 1st-year primary, **35.500 DT** for 6th-year primary and **50.900 DT** for 1st-year secondary. Single books cost **2.400–5.200 DT** in upper secondary [S8, S9]. The libraire buys at a 25% discount [S1]. This repo's own data confirms it: costPrice is exactly 75% of salePrice across 52 CNP books (comment in `cli/lib.mjs`, `catalog:official`).
- **Subsidised notebooks.** Official prices: n°12 0.230 DT, n°24 0.430 DT, n°48 0.950 DT, n°72 1.400 DT [S9, S10]. A non-subsidised notebook costs about 3.400 DT (2024) [S46]; a mid-range 72-page one 3.800 DT and a premium one about 5 DT [S11]. Libraires report getting about 3% of their stock as subsidised notebooks against a 20% entitlement, paid cash, with forced bundling upstream [S11]. About 16M subsidised notebooks reached the market in 2025 [S12].
- **Family spending per pupil.** INC basket (2023, Tunis prices): 121 DT (1st year), 188 DT (7th), 226 DT (bac sciences). ODC (Sept 2026): at least 300 DT for primary, ~500 DT for lycée, everything included [S9].
- **Card acceptance is rare.** 43,116 card terminals (TPE) in the whole country in 2025 [S22], against 245,409 retail enterprises [S6]. Bookshops are cash plus informal credit [E].

**Derived estimates [E]:**

- **CNP textbook value at retail:** ~15.5M copies × 3.5–4 DT ≈ **55–60M DT**. At a 25% margin, that is a **~14–15M DT** gross margin pool, about **2,100–2,300 DT per shop per year** on average across 6,500 shops. Real shares are concentrated in the bigger shops. Some copies may also be sold outside libraires.
- **The whole school basket:** low case 1.195M primary × 121 DT + 1.146M secondary × 188 DT ≈ 0.36B DT; high case 1.195M × 300 DT + 1.146M × 500 DT ≈ 0.93B DT. So roughly **0.36–0.93 billion DT per rentrée**. Librairies, supermarkets (e.g. Géant's "librairie" aisle [S48]) and informal sellers share it in unknown proportions.

**What this means for selling:**

1. **Do not install between about 1 August and about 10 October.** Owners will not risk a new till in the rush, and a failure would be fatal to word of mouth. Visiting in September to *observe* the queues is fine, and so is collecting leads.
2. **Best months to close:** mid-October to December (post-rentrée pain, inventory, credit to collect) and February to June (prepare *this* rentrée). **Hard deadline for installs: early July 2027.**
3. **Pitch the rentrée.** The pain is queues, class lists, quotas and cash-only subsidised items. Packs scolaires, fast scanning and multi-poste sync answer it directly.

### 1.6 Regulatory context (what is *not* a buying trigger, today)

- **NACEF fiscal cash registers** (LF 2016 art. 48, decree 2019-1126, arrêté of 14 Oct 2025) apply to **on-site food and drink**. The phases: 1 Nov 2025 for classified tourist restaurants, tea rooms and 2nd/3rd-category cafés; 1 July 2026 for other legal entities in on-site consumption; 1 July 2027 and 1 July 2028 for individuals. Equipment must come from DGI-approved suppliers listed on Jibaya.tn [F, S42]. A vendor article says retail shops are **not** covered [S24]. *Not a trigger for bookshops. Do not claim NACEF compliance.*
- **TEIF electronic invoicing** (El Fatoora / TTN). LF 2026 (loi n° 17 du 12 décembre 2025) art. 53 extends it to **services** [F, S43, KPMG]. On 2 April 2026 the ARP finance committee postponed its application to a date to be set by a later law [F, S43, La Presse 6 Apr 2026]. Vendors say retail sales of goods are not covered and the till ticket stays the sales document [S24]. *Watch item.* Photocopy and printing are services, and some shops invoice schools and companies. An accountant must confirm whether that ever brings a bookshop into scope.
- **Economic controls at the rentrée** check purchase invoices, price display, labelling and subsidised-notebook speculation [F, S50, S11]. Recording purchases with supplier invoices (a Mektebti feature) helps owners hold their paperwork. This is a supporting argument, not a legal claim.

---

## 2. Competitive landscape

### 2.1 What a Tunisian bookshop can "buy" instead

1. **Do nothing:** cahier (paper notebook) + calculator + memory, sometimes Excel. This is the real #1 competitor. It is free and familiar, but gives no stock, no margins and no history [H].
2. **Standalone cash register:** 400–900 DT [F, S24]. Prints a ticket; no stock or customers.
3. **Tunisian desktop licences:** Expert Gestion, Megasoft, SharPOS, Tassaruf, TN-POS packs. One-off payment, data on the shop PC, local support.
4. **Tunisian cloud SaaS:** Gastevo, Hesabi, Swiver, Finco, eFactureTN, Caissa. Cheap subscription, self-service, usually invoicing-first.
5. **International apps:** Loyverse (free, Arabic/French), Square/Shopify/Lightspeed (not practical in Tunisia [S25]).
6. **ERP through integrators:** Odoo (partners such as Shazler IT), Sage 100, EBP. Project-priced and oversized for a 1–3 person shop.
7. **Foreign bookshop software:** Librisoft (France), which says Tunisia is among its countries [S36]. Quote-only, Windows.

### 2.2 Competitor table

Prices are as published on the vendor's own page on 15 Oct 2026. Vendor pages are marketing: "not stated" means the page does not say it, not that the feature is missing.

| Product | Model | Published price | Offline | Languages | Bookshop-specific? | Support | Weaknesses for a librairie | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Gastevo** (Testour) | Cloud SaaS, browser | 20 TND/month for 1 module; **35 TND HT/month** for sales + stock + purchases, per point of sale; 1 month free | **No**: "runs online", suggests a 4G backup | Support FR/AR; UI language not stated | No (targets pharmacies, restaurants, clothing, perfumeries…) | Phone/email | Stops selling when the line drops; no packs or credit notebook advertised; generic | [S23], [S24] |
| **Hesabi** (Tunis) | Cloud, "100% web" | Starter **390 TND HT/yr**; Pro 790 HT/yr (TEIF); Cabinet 2,490/yr; 14-day trial | **No**: needs internet | FR site, AR tagline; RTL not stated | No (boutiques, restaurants, pharmacies…) | Self-serve | Needs internet; invoicing-first; DIY onboarding | [S26] |
| **Swiver** | Cloud SaaS + mobile | Economic **450 DT HT/yr** (1 user, 50 documents/month), Premium 600 HT/yr (3 users), VIP **7,000 DT lifetime**; 14-day free tier | Not stated | FR / AR site | No (TPE/PME, accountants) | "Support Premium" | Invoicing tool with POS added; document caps; claims "+14,000" users (unverified) | [S27] |
| **Finco** | Cloud | Free (20 invoices/month), Pro **49 DT TTC/month** | Not stated (cloud) | Invoices FR/EN/AR | No; POS not mentioned | Premium support on Pro | Not a till | [S28] |
| **eFactureTN** | Cloud | 12 DT/month (Tanit), 25 DT/month (Elissa) | Not stated | — | No (e-invoicing) | — | E-invoicing tool, not a till | [S29] |
| **Caissa.tn** (Monastir) | Probably web (SSO login) | "From 0.5 DT/day", ~365 DT/yr (page inconsistent); 15-day trial | Not stated | AR slogan, FR page | "All shops" | Says 24/7 / 7j/7 | Generic; pricing unclear; claims "500+ clients" (unverified) | [S30] |
| **SharPOS** (EITECH) | Windows desktop, lifetime licence | **600 TND TTC** lifetime; +300 each for multi-terminal (max 5), tables, loyalty; 40-day trial | **Yes** | Support AR/FR | No (restaurants, cafés, bakeries, convenience stores…) | Phone + remote | No cloud/remote view; restaurant DNA | [S31] |
| **Megasoft ERP** | Licence or annual cloud | Lite **499 DT** (1 user), Starter 1,049 DT; others on quote | Local daily backup; cloud optional | Not stated | No (supermarkets, restaurants, clothing…) | 12 months free; phone/WhatsApp | Generic; support after year 1 unclear | [S32] |
| **Tassaruf Tijari v5** (FMSoft, Ariana) | Desktop licence, "no subscription" | Basic **900 DT** (max **500 products**), Lite 1,900 DT (max 1,000), Premium 3,900 DT | **Yes** | Support FR/AR | No | Local, install included | 500–1,000 product caps are too low for a papeterie; invoicing-centric; actively campaigns against subscriptions | [S33] |
| **Expert Gestion** (caisses.tn) | Licence | Logiciel de vente **820 TND** (promo, list 1,000); Pro 1,500; All-in-one 2,200 | Not stated | Not stated | No (restaurants/shops), but has "gestion des crédits" | Local | Restaurant-oriented (kitchen screen, tables) | [S34] |
| **TN-POS "Pack Librairie"** (Tunis / Sidi Bouzid) | Hardware + POS software pack | Not published | Not stated | Not stated | **Named for librairies**, but no bookshop functions listed | Install + training, 1-year warranty | The only "librairie" offer found, but it is a hardware bundle; to watch | [S35] |
| **Poslik** | Subscription incl. hardware | On quote | — | — | No (restaurants, hotels) | — | Hospitality focus | [S41] |
| **Operacium** (Datacium) | SaaS | From €10–60/month | Not stated | Not stated | Generic retail | — | Priced in euros | [S40] |
| **Loyverse** | Free mobile/tablet POS | Free; Advanced Inventory **$25/month**, Employees $25/month | **Yes**, with limits: no stock levels shown offline, no refunds or new customers offline | Arabic + French available | No | Chat only with a paid add-on | No local support or onboarding; currency/VAT setup DIY; no packs; US company | [S37], [S25] |
| **Odoo** (+ Tunisian partners) | Cloud/on-prem ERP | Standard US$31.10–38.90/user/month; Custom $61–76.20; integration extra | POS has an offline mode (not checked here) | Many | No | Partner-dependent | Project cost and complexity far above a 1–3 person shop | [S38] |
| **Sage 100 / EBP** | Licence via integrators | No public Tunisian price found | Desktop | FR | No | Integrators | Accounting-first, expensive to deploy | [S39] |
| **Librisoft** (2DCOM, France) | Windows desktop | On quote | Standalone laptop mode | FR | **Yes**, true bookshop software (ISBN, orders) | French vendor; no Tunisian partner named | Built for French bookshops (NF525 etc.); no CNP, packs or carnet; no local support evident | [S36] |
| **Cahier / Excel** | — | ~0 DT | Yes | Any | — | — | No stock, margins, history or tickets; errors; depends on one person | — |

### 2.3 What year one costs a one-till shop [E]

Assumes the shop already has a PC. Hardware at market price: entry scanner 59–99 DT, mid-range Honeywell 239–269 DT; 80 mm thermal printers 214–329 DT, Honeywell 699 DT [F, S44]. VAT: Tunisian software prices are shown HT or TTC inconsistently, so the figures below are as published.

| Option | Software, year 1 | + mid-range hardware (~450–550 DT) | Year 2 onwards |
| --- | ---: | ---: | ---: |
| Cahier / Excel | 0 | 0 | 0 |
| Loyverse (free) / + Advanced Inventory | 0 / ~$300 | ~500 | 0 / ~$300 |
| Gastevo, 3 modules (1 month free) | 385 HT | ~835–935 | 420 HT |
| Hesabi Starter | 390 HT | ~840–940 | 390 HT |
| Swiver Premium | 600 HT | ~1,050–1,150 | 600 HT |
| SharPOS lifetime | 600 TTC | ~1,050–1,150 | 0 (support terms not stated) |
| Expert Gestion | 820 | ~1,270–1,370 | ? |
| Tassaruf Lite | 1,900 | ~2,350–2,450 | 0 |
| **Mektebti monthly** | 500 setup (incl. scanner + printer) + 11 × 83 = **1,413** | included | **996** |
| **Mektebti annual** | **2,000** (hardware + setup included) | included | 2,000 (if renewed at the same price) |
| **Mektebti lifetime** | **3,400** (hardware + setup included) | included | 0 |

**Takeaways [E]:**

- **Mektebti costs about 1.5× a generic Tunisian cloud POS in year one, hardware included (1,413 vs ~835–940 DT), and about 1.7–2.6× from year two (996 DT vs 390–600 DT).** Generic tools cannot win the shop on bookshop fit, offline selling or done-for-you setup. Mektebti can, and its price must be *defended* with exactly those three points.
- **One-off licences are a familiar idea in Tunisia,** and at least one vendor (Tassaruf) markets openly against subscriptions [S33]. The lifetime plan answers the objection "je ne veux pas payer chaque mois". It needs clear terms (support, hardware warranty, fair use) to stay sustainable on a cloud cost base.
- **The plans have a pricing anomaly.** The annual plan (2,000 DT) costs more than the monthly plan in year one (1,413 DT) and twice as much from year two (996 DT/yr). The lifetime plan (3,400 DT) breaks even against monthly at about month 36. The pricing workstream should fix this before launch.
- **Shops can check hardware prices online.** A scanner at 59–99 DT and a printer at 214–329 DT on Tunisianet/Spacenet make "250 + 250 DT" look marked up unless the models are named (e.g. Honeywell scanner, branded 80 mm printer) and installation and warranty are spelled out.

### 2.4 Where Mektebti wins and loses

**Wins (true today, per this repo):**

- Bookshop workflow: packs scolaires, a shared catalogue with **CNP textbooks at the state price and the 25% libraire cost**, services sold by QR label (photocopie…), margins per category.
- Offline-first selling **and** multi-device live sync in one product. Gastevo and Hesabi need internet [S23, S26]. SharPOS and Tassaruf are offline but desktop-bound [S31, S33].
- Tunisian Arabic + French with RTL; millime-exact money; 80 mm ticket + A4 invoice; carnet de crédit printable per customer.
- Done-for-you onboarding with hardware, plus a real reference shop (Librairie Sofiene, 740 products migrated, SAAS.md).

**Loses or gaps (be honest in sales and in the roadmap):**

- Price, against generic cloud tools (section 2.3).
- **No TEIF e-invoicing, no NACEF, no card-terminal integration, no accounting or payroll.** Gastevo, Hesabi and Finco market TEIF [S23, S26, S28]. Not needed for retail goods today (section 1.6), but competitors will use it to scare owners.
- Young company with 2 clients, against vendors claiming 500 to 14,000 users (unverified).
- A first sign-in and first sync need internet. The "100% utilisable hors ligne" claim on the landing page should be field-tested, including a page reload during an outage on the shop PC, before it is advertised loudly.
- Multi-store chains (Tier C): not checked whether one account can cover several shops.

---

## 3. Buyer personas, triggers, objections

These are **hypotheses** [H]. They are built from the press sources (quotes from libraires in [S11], [S2], [S10], [S17]), the product context and how the market works. Validate them with the interviews in 3.6 before spending on ads.

### 3.1 Persona 1: "Si Slah", owner-operator of a neighbourhood librairie-papeterie (primary buyer)

- **Profile:** 45–65, has owned the shop 10–30 years, often a family business. One or two helpers, plus 1–3 seasonal hands at the rentrée. Lives on notebooks, school supplies, CNP textbooks, parascolaire, office supplies for local businesses, photocopies and printing, small gifts. Tier A, 1,000–5,000 SKUs.
- **Language:** Tunisian Arabic every day. Product names and supplier invoices are in French.
- **Tech:** smartphone (WhatsApp, Facebook). Maybe an old PC used for printing and photocopy jobs. Not comfortable typing.
- **Money habits:** cash. A notebook of regular customers who pay later (kridi). Pays wholesalers on terms, but pays subsidised notebooks cash [F, S11]. Rations subsidised notebooks by hand ("sur une vingtaine de cahiers achetés, cinq seront subventionnés" [F, S11]).
- **Jobs to be done:**
  1. Serve the rentrée queue fast and without mistakes.
  2. Know what is left after the rentrée and what to reorder.
  3. Know who owes him what.
  4. Stop small leaks: wrong prices, change errors, staff mistakes.
  5. Know if he actually makes money on each line.
- **Decision:** decides alone, often after asking a son or daughter (Persona 2) or a neighbouring libraire. Wants to *see it working in a shop like his*.

### 3.2 Persona 2: "Ines", the next generation, often the champion

- **Profile:** 22–35, son or daughter, nephew or niece, or a salaried manager. Studied, digital-native. Is pushing to "moderniser la librairie" and will be the daily user.
- **Wants:** a dashboard on the phone; several devices showing the same numbers; to stop being the family's "human Excel".
- **Role:** finds Mektebti on Facebook or Google, sends the WhatsApp message, convinces the parent. **Most digital marketing should be written for her. The field visit is for him.**

### 3.3 Persona 3: "Karim", a busy multi-till librairie in a big city (secondary)

- **Profile:** Tunis, Sfax or Sousse centre. 2–4 tills at the rentrée, 5,000+ SKUs. B2B sales to schools and companies, with A4 invoices showing the matricule fiscal.
- **Situation:** may already have desktop software (Expert Gestion, Megasoft, Odoo…) that he finds rigid.
- **Wants:** multi-poste live sync, supplier debts, profit per article, exports for the accountant.
- **Objection:** "Migrating 5,000 articles will kill me." Answer: Mektebti loads the catalogue (done for Librairie Sofiene) and has CSV export.

### 3.4 Not a target now: "the pop-up rentrée seller"

Opens 6–8 weeks a year and buys second-hand books and notebooks [F, S10]. Will not pay 83 DT/month. If ever, a seasonal pass later [H].

### 3.5 Buying triggers and objections

**Triggers** (most to least important [H]):

1. **The rentrée just hurt.** Queues, lost sales, stock-outs, nobody knows what is left. **Now (October–November)** is the moment to ask: "C'était comment, la rentrée ?"
2. **Preparing the next rentrée** (March–June): wants packs and fast scanning ready before July.
3. **Credit got out of hand:** unpaid carnets after the rentrée and at year-end.
4. **A new pair of hands:** seasonal staff or a family member joins, so cash control matters.
5. **The old system died:** PC crash, data loss, vendor unreachable, licence locked to one PC.
6. **Peer proof:** a neighbouring libraire, the supplier's rep or the regional chamber says "il marche bien chez X".
7. **Opening, renovating or expanding:** a second till.
8. **The accountant asks for figures,** or the tax regime changes (régime réel), or a school or company asks for proper A4 invoices.

**Objections and true answers:**

| Objection (in his words) | True answer from Mektebti |
| --- | --- |
| « Ghali / c'est cher, et chaque mois » | Show the cost of one rentrée error or one forgotten credit. Offer the lifetime plan ("payez une fois"). First month free. Hardware included. |
| « Kif yoqass el internet ? » (and when the internet cuts?) | The till keeps selling offline and syncs when the line comes back. Show it in the demo by unplugging the router. (Field-test first, see 2.4.) |
| « Ma 3andich wa9t nda55el 3000 article » (no time to enter 3,000 items) | We load your stock. CNP textbooks are already in the shared catalogue at the official price. Scanning a known barcode fills in the name. |
| « Ana ma na3rafch el ordinateur » (I don't know computers) | Big buttons, Arabic or French, scanner "bip c'est vendu", training on site, WhatsApp support. |
| « W ken tsakrou ? » (and if you close down?) | Your data can be exported any time (full backup + CSV per collection). It is your data. |
| « El fisc… » (the tax office…) | Mektebti does not connect to the tax administration. The data is private to the shop account. **Do not promise any tax outcome.** |
| « Mouch wa9tou » (not now, it's the rentrée) | Agree. Book the installation for a quiet week and come back. That is why the window is October–June. |
| « 3andi logiciel deja » (I already have software) | Ask what it cannot do: packs, carnet, offline + phone view, Arabic. Offer to migrate the catalogue. |
| « TEIF / facture électronique ? » | Retail sales of goods are not concerned today (LF 2026 art. 53 targets services, and its application is postponed). **Get the founder's accountant to confirm this wording before using it.** |

### 3.6 Validation plan (do in the next 2–3 weeks)

- **10 interviews** (6 Tier A, 2 Tier C, 2 non-users), in Grand Tunis and one inland town. 30 minutes, in the shop, on a quiet morning.
- **Questions:**
  1. How did this rentrée go? What went wrong?
  2. How do you track stock, credit and supplier debts today?
  3. What did you pay for your current tool or till? Who installed it?
  4. Has the internet cut out during a busy day? What happened?
  5. Would you pay monthly or once? How much feels "normal"?
  6. Who would decide? Who would use it?
  7. Where do you hear about new products for the shop: supplier rep, chamber, Facebook, neighbour?
- **Output:** confirm or kill the personas, the Tier A share, price acceptance, and the channel ranking below.

---

## 4. Channels

### 4.1 Channel table

| # | Channel | How | Evidence it reaches owners | Cost | Timing | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Field visits in clusters** | Walk a délégation, 10–15 shops a day. 2-minute demo on a phone or tablet, then book a full demo. Start where Librairie Sofiene is (reference visit). | Owners are in the shop all day; trust is face to face [H] | Time + fuel | Oct–Dec, Feb–June | **P1** |
| 2 | **Client referrals + WhatsApp** | Ask Librairie Sofiene for 3 intros; referral reward (e.g. one month free each). WhatsApp Business with a short derja demo video and the landing link. | WhatsApp is already the CTA on the landing (+216 98 158 160) | Low | Always | **P1** |
| 3 | **Chambre nationale des libraires** + regional chambers | Meet the president (Jamel Eddine Dardour [S2]). Propose a member offer and a demo at a meeting. Regional chambers are active (Kébili: Salah Hamza [S17]; Kasserine negotiated discounts [S18]). UTICA affiliation not verified. | The chamber speaks for the ~6,500 shops in the press [S2] | Low | Nov–Jan (before the season) | **P1** |
| 4 | **Stationery wholesalers and notebook makers** | Partner with the reps who visit libraires weekly (commission or co-marketing). Bodies: Chambre nationale des grossistes de fournitures scolaires et de bureau (Fayçal Abassi [S19]); Chambre professionnelle des fabricants de cahiers scolaires [S10]. | Wholesalers supply every libraire; about 95% of notebooks are Tunisian-made [F, AllAfrica Aug 2025: https://fr.allafrica.com/stories/202508200572.html] | Commission | Feb–June | **P2** |
| 5 | **CNP regional agencies (24)** | Libraires come to their agency to order and collect textbooks [S1, S8]. Flyers and conversations *outside*, or ask the CNP for a partnership. Do not imply CNP endorsement. | Every libraire in a governorate passes there in July | Low | Early July (leads for Oct) | P2 |
| 6 | **Meta ads (Facebook / Instagram)** | Geo-target the clusters, Arabic + French creatives aimed at Persona 2, lead form to WhatsApp, retarget landing visitors. Expect weak job-title targeting for small shop owners [H]. | Facebook ad reach 7.80M (63% of population), Instagram 4.05M [F, S20]; NapoleonCat: 9.2M Facebook users (July 2026) [F, S21] | Test 15–30 DT/day | Oct–Dec, Mar–June | P2 |
| 7 | **Google Search ads + SEO** | Category terms (logiciel caisse librairie, gestion librairie papeterie, برنامج مكتبة…). Search volume not measured; run Keyword Planner first. "مكتبتي" is a generic word ("my library"), so Arabic brand search will be noisy. | Unknown volume [H] | Test 10–20 DT/day | Always | P3 (measure first) |
| 8 | **Facebook groups of libraires / papetiers** | Join and help; no spam. No group could be found by web search; search inside Facebook for « libraires Tunisie », « مكتبات تونس », « grossiste fournitures scolaires ». | Not verified | Time | Always | P3 |
| 9 | **Salons** | *Back to School* salon at UTICA (1st edition 2–5 Sept 2026, meant to be annual) for brand. *Foire internationale du livre de Tunis* at Le Kram (2026: 23 Apr–3 May; EventsEye lists 22 Apr 2027, unconfirmed) for Tier C and publishers, at the start of the pre-season. | [S14], [S15], [S16] | Booth cost | Apr 2027, Sept 2027 | P3 |
| 10 | **Accountants, hardware shops, copier technicians** | Referral fee. Accountants see the books; copier technicians service every papeterie's photocopier [H]. | [H] | Commission | Always | P3 |

### 4.2 12-month go-to-market calendar (from today)

| Period | Focus |
| --- | --- |
| **16 Oct – 20 Dec 2026** | Interviews (3.6). Field sales in Grand Tunis + 1 Sahel city. Sofiene referrals. Chamber meeting. Pitch: "la rentrée, plus jamais comme ça" + carnet collection. |
| Jan 2027 | Fix pricing and plans. Case study / video at Librairie Sofiene. Wholesaler partnerships. |
| Feb – Apr 2027 | Main closing season. Meta + Google tests. Sfax and Nabeul. Book fair (Tier C). |
| May – June 2027 | Last installs. Load packs for the 2027-2028 lists. Train seasonal staff. |
| **1 Jul – 10 Oct 2027** | **No new installs** (except by explicit demand). Support existing shops through the rentrée. Collect leads at CNP agencies and at Back to School. |

---

## 5. Positioning

### 5.1 Positioning statement

**English:**
For the owners of Tunisia's librairies-papeteries, who live on the rentrée and on their regular customers' trust, **Mektebti is the till and shop-management app built for the bookshop trade**. Packs scolaires go through in one scan. The carnet de crédit is built in. Stock and margins are exact to the millime, in Arabic and French. It keeps selling when the internet drops, and it is installed and loaded for you. Generic cloud POS apps are built for cafés, pharmacies or invoicing and stop when the line stops. Desktop licences stay on one PC. **Mektebti is designed around how a Tunisian bookshop actually sells.**

**French (landing / sales):**
*Mektebti, la caisse des librairies tunisiennes : packs scolaires en un scan, carnet de crédit, stock et marges au millime. En arabe et en français, même quand internet coupe. On installe, on charge votre stock, vous vendez.*

**Tunisian Arabic:**
*مكتبتي، الكاسة متاع المكتبات التونسية: باكات العودة المدرسية في سكان واحد، كرّاس الكريدي، والمخزون والربح بالمليم. بالعربي والفرنسي، تخدم حتى كي يقصّ الإنترنت. نركّبوها، نحطّو السلعة متاعك، وانت تبيع.*

### 5.2 Five differentiators

Each one is true in this repo, and each is contrasted with what competitors publish.

1. **Made for librairies-papeteries, not adapted from restaurants.**
   - *Proof in product:* packs scolaires (`src/features/packs/`). A shared catalogue that includes **CNP manuels at the state price with the 25% libraire cost** and community-confirmed barcode names (`cli/lib.mjs` `catalog:official` / `catalog:harvest`, `src/features/catalog/`). Services sold by scanning a QR label, e.g. "Photocopie" (`QuickService`, `src/features/settings/ServicesTab.tsx`). Default margin per category, since paper goods carry less (`ShopSettings.categoryMargins`). Product variants.
   - *Market contrast:* Gastevo, Hesabi, SharPOS and Megasoft list their target sectors and none lists librairies [S23, S26, S31, S32]. TN-POS's "Pack Librairie" lists no bookshop functions [S35]. Librisoft is French and has no CNP, packs or carnet [S36].
2. **Keeps selling without internet, and every device shows the same numbers.**
   - *Proof:* Firestore `persistentLocalCache` with `persistentMultipleTabManager` (`src/lib/firebase.ts`), live collections (`src/lib/liveCollection.ts`), a sync-status indicator (`src/components/SyncStatus.tsx`), PWA service worker (`scripts/pwa.ts`).
   - *Contrast:* Gastevo says it runs online and suggests a 4G backup [S23]. Hesabi is "100% web" [S26]. Offline desktop tools (SharPOS, Tassaruf) are tied to the shop PC or a LAN [S31, S33]. Loyverse hides stock levels offline [S37].
   - *Caveat:* field-test before saying "100%".
3. **Speaks the shop's language and its money.**
   - *Proof:* Tunisian Arabic (RTL) + French UI (`src/i18n/ar.ts`, `fr.ts`). Money stored as integer millimes (`src/lib/money.ts`), shown in "dinar" or "millime" mode. 80 mm ticket + A4 invoice with the shop's matricule fiscal (`ShopSettings.taxId`, `src/features/sales/SalesTab.tsx`). HT → TVA → TTC → margin pricing helper (`src/features/stock/pricing.ts`).
   - *Contrast:* most local tools publish no interface-language details. International apps price in USD and leave VAT and currency to DIY setup [S25].
4. **The carnet de crédit (kridi) is part of the till.**
   - *Proof:* a sale on credit lands in the customer's carnet. Balances, history and a printable carnet per customer (`src/features/credit/`, `CarnetPrint.tsx`). Supplier debts and settlements on the purchase side (`src/features/purchases/SettlePurchase.tsx`).
   - *Contrast:* customer-credit tracking exists in some tools (Expert Gestion "gestion des crédits", Tassaruf customer accounts [S34, S33]). The difference is that it is built around the neighbourhood-shop carnet and in derja. **Do not claim "the only one".**
5. **Done for you, by a Tunisian team, with a live reference shop.**
   - *Proof:* the offer includes scanner + thermal printer, installation, catalogue loading (Librairie Sofiene: 740 products, 30 packs, 14 categories imported and verified; SAAS.md), training, and WhatsApp support from the founders. Profit per article and a dashboard follow automatically (`src/features/reports/`, `src/features/dashboard/`). Full backup and CSV export (`src/features/backup/backupService.ts`), so the shop owns its data.
   - *Contrast:* Hesabi, Swiver, Finco and Caissa are self-serve trials [S26–S30]. Desktop vendors install but leave catalogue entry to the shop, and Tassaruf caps products at 500/1,000 on its lower tiers [S33].

### 5.3 Claims to avoid (they are false, unproven or risky)

- "La seule / la meilleure solution" until there is proof (number of shops, testimonials).
- "Conforme TEIF / NACEF / homologué" (it is not, and is not required for retail today).
- "100% hors ligne" until the outage-plus-reload scenario passes a field test on a shop PC.
- "Utilisé par des dizaines de librairies" (2 clients today). "Déjà en service dans des librairies" is fine.
- Any tax promise ("le fisc ne verra rien").
- CNP or Ministry endorsement (Mektebti only uses public CNP prices).

---

## 6. Implications for the offer (input for the pricing and marketing workstreams)

1. **Sell a service, not software.** Lead with "on installe, on charge votre stock, vous vendez". Generic tools cannot match that, and it justifies the price gap in section 2.3.
2. **Fix the annual-plan anomaly** (section 2.3) and decide HT vs TTC display.
3. **Name the hardware models** (or offer "I already have a scanner/printer" at a lower setup fee). Owners can see 59–329 DT prices online [S44].
4. **Keep a pay-once option.** The market is used to it [S31, S33], but define support and warranty terms.
5. **Timing is part of the offer.** "Installé avant juillet, prêt pour la rentrée" is the main campaign for Feb–June 2027.
6. **Turn the rentrée into a product moment.** Pre-built pack templates per class level, based on the Ministry's official supply list (the Ministry introduced a single notebook list in 2025 and publishes the supplies per class [S49], [S10]).

---

## 7. Open questions and decisions for the founder

These are listed in the structured summary. Details:

- VAT status and HT/TTC display of the 83 / 2,000 / 3,400 DT prices.
- Fix the annual plan, and define lifetime terms.
- Exact hardware models, warranty, and a "bring your own hardware" price.
- Permission to name Librairie Sofiene (and its city) as a reference and to film a testimonial.
- Approach to the Chambre nationale des libraires, and whether to offer a member discount.
- Install freeze dates (proposed: 1 Aug – 10 Oct).
- First 90-day geography (where the team can drive daily).
- Accountant sign-off on any public wording about TEIF / NACEF.
- Ownership of the **mektebti.tn** domain (the app still lives on libsystem-tn.netlify.app). No conflicting "Mektebti" brand was found by web search on 15 Oct 2026, but "مكتبتي" is a generic Arabic word.
- Whether to plan TEIF (B2B invoices to schools and companies) if art. 53 is reactivated.

---

## 8. Sources

All accessed 15 October 2026. Publication dates are given where the page shows one.

| # | Source |
| --- | --- |
| S1 | CNP: *Vente aux libraires* (6,500 libraires; 25% margin; quotas by agency): http://cnp.com.tn/french/services-vente/vlibraires.htm |
| S2 | La Presse, 9 Sept 2026, *Rentrée scolaire 2026 : 97% des manuels disponibles* (J. E. Dardour, president of the Chambre nationale des libraires; ~6,500 librairies): https://www.lapresse.tn/?p=4358202 |
| S3 | Webdo, 8 Aug 2018 (CNP DG: "près de 4500 librairies"): https://www.webdo.tn/fr/actualite/national/tunisie-pas-daugmentation-des-prix-des-manuels-scolaires/153965/ |
| S4 | Livres Hebdo, 2022, interview of Habib Zoghbi (80–100 bookshops; "c'est de la papeterie"): https://www.livreshebdo.fr/article/habib-zoghbi-il-faut-savoir-faire-venir-les-jeunes-en-librairie |
| S5 | Kapitalis, 23 June 2025, *Données statistiques sur le livre en Tunisie* (UNESCO; 20/50 bookshops; 5 distributors): https://kapitalis.com/tunisie/2025/06/23/donnees-statistiques-sur-le-livre-en-tunisie/ |
| S6 | INS: *Statistiques issues du Répertoire National des Entreprises*, 2025 edition (RNE 2024 tables 3.1.3 by governorate): https://www.ins.tn/sites/default/files-ftp3/files/publication/pdf/RNE%202025.pdf |
| S7 | Tunisie Numérique, 14 Sept 2026, *Les chiffres clés de la rentrée scolaire 2026-2027* (2.341M pupils; 6,178 schools; 15 Sept): https://www.tunisienumerique.com/tunisie-les-chiffres-cles-de-la-rentree-scolaire-2026-2027/ |
| S8 | La Presse via AllAfrica, 1 July 2026, *Rentrée scolaire 2026-2027 — Voici combien vont nous coûter les manuels*: https://fr.allafrica.com/stories/202607020253.html |
| S9 | Tunisie Numérique, 12 Sept 2026, *Rentrée scolaire 2026 : combien coûte vraiment un élève en Tunisie* (ODC, OTOC, INC; subsidised notebook prices): https://www.tunisienumerique.com/rentree-scolaire-2026-combien-coute-vraiment-un-eleve-en-tunisie/ |
| S10 | La Presse, 19 Aug 2026, *Cela sent déjà la rentrée : pour éviter la chasse aux cahiers subventionnés*: https://www.lapresse.tn/2026/08/19/cela-sent-deja-la-rentree-pour-eviter-la-chasse-aux-cahiers-subventionnes |
| S11 | La Presse, 23 Aug 2025, *Fournitures scolaires : la chasse au cahier subventionné !* (libraire quotes: quotas, cash payment, rationing): https://lapresse.tn/2025/08/23/fournitures-scolaires-la-chasse-au-cahier-subventionne/ |
| S12 | La Presse, 3 Aug 2025, *Manuels scolaires : édition de 314 titres en 16 millions d'exemplaires*: https://lapresse.tn/2025/08/03/rentree-scolaire-2025-2026-manuels-scolaires-edition-de-314-titres-en-16-millions-dexemplaires/ |
| S13 | La Presse, 31 Aug 2026, Ministry launches the "Trouvez un livre" app: https://lapresse.tn/2026/08/31/rentree-2026-2027-le-ministere-de-leducation-lance-une-application-pour-trouver-les-manuels-scolaires-en-librairie/ ; Arabic coverage of the 15 Aug target: https://radioexpressfm.com/ar/العودة-المدرسية-2026/الكتب-المدرسية-في-تونس-2026-2027/ |
| S14 | La Presse, 24 Aug 2026, *Back to School : un nouveau salon dédié à la rentrée scolaire du 2 au 5 septembre* (UTICA HQ): https://www.lapresse.tn/2026/08/24/back-to-school-un-nouveau-salon-dedie-a-la-rentree-scolaire-du-2-au-5-septembre/ |
| S15 | La Presse, 2 Sept 2026, *Salon de la rentrée scolaire à Tunis : une première édition qui fait le plein*: https://www.lapresse.tn/2026/09/02/salon-de-la-rentree-scolaire-a-tunis-une-premiere-edition-qui-fait-le-plein/ |
| S16 | EventsEye, book fairs in Tunisia (FILT 2027 listing, unconfirmed): https://www.eventseye.com/fairs/cst0_salons_tunisie_livres.html ; 2026 edition: https://fr.allafrica.com/stories/202604250010.html |
| S17 | La Presse, 1 Sept 2026, *Kébili : pénurie de plusieurs manuels scolaires et de cahiers subventionnés* (regional chamber): https://www.lapresse.tn/2026/09/01/kebili-penurie-de-plusieurs-manuels-scolaires-et-de-cahiers-subventionnes |
| S18 | Tunisie Numérique, *Kasserine : des remises importantes sur les fournitures scolaires*: https://www.tunisienumerique.com/kasserine-des-remises-importantes-sur-les-fournitures-scolaires/ |
| S19 | Webdo, Chambre nationale des grossistes (F. Abassi): https://www.webdo.tn/fr/actualite/national/hausse-attendue-des-prix-des-manuels-scolaires/207556/ |
| S20 | DataReportal, *Digital 2026: Tunisia*: https://datareportal.com/reports/digital-2026-tunisia |
| S21 | NapoleonCat, Facebook users in Tunisia (July 2026): https://stats.napoleoncat.com/facebook-users-in-tunisia/ |
| S22 | Tuniscope, 16 July 2026, BCT annual report (43,116 TPE in 2025): https://www.tuniscope.com/article/436288/actu-arabe/arabe/paiement-104710 |
| S23 | Gastevo homepage (pricing, no offline): https://gastevo.com/ |
| S24 | Gastevo, *Caisse enregistreuse en Tunisie : prix, types et fiscalité* (1 June 2026, updated 8 Oct 2026): https://gastevo.com/blog/caisse-enregistreuse-tunisie-prix-comparatif-2026 |
| S25 | Gastevo, *Square, Shopify, Loyverse : quelle caisse en Tunisie ?* (vendor-written): https://gastevo.com/blog/logiciels-caisse-internationaux-tunisie-comparatif |
| S26 | Hesabi POS page: https://hesabi.tn/logiciel-caisse-pos-tunisie ; pricing: https://hesabi.tn/pricing |
| S27 | Swiver: https://swiver.io/ ; pricing: https://swiver.io/tarifs |
| S28 | Finco: https://finco.tn/en/ |
| S29 | eFactureTN, 7 Mar 2026: https://efacturetn.com/fr/blog/e-facture-tpe-tunisie |
| S30 | Caissa.tn: https://caissa.tn/ |
| S31 | SharPOS: https://www.sharpos.tn/fr/ ; pricing: https://www.sharpos.tn/fr/pricing |
| S32 | Megasoft ERP, logiciel caisse: https://www.megasofterp.com/logiciel-caisse-enregistreuse-tunisie-megasoft-erp/ |
| S33 | Tassaruf Tijari (FMSoft): https://www.tassaruf.com/logiciel-gestion-commerciale-tunisie.html |
| S34 | Expert Gestion, caisses.tn: https://caisses.tn/produit/logiciel-de-caisse-expert-gestion/ ; its (biased) comparison: https://caisses.tn/comparatif-logiciel-caisse-tunisie/ |
| S35 | TN-POS, Pack Librairie: https://www.tn-pos.com/produit/pack-librairie/ |
| S36 | 2DCOM, Librisoft: https://2dcom.fr/produits/librisoft/ |
| S37 | Loyverse pricing: https://loyverse.com/pricing ; offline help: https://help.loyverse.com/help/offline-work-of-pos |
| S38 | Odoo pricing: https://www.odoo.com/pricing ; Tunisian partner example (Shazler IT): https://www.erpresearch.com/odoo-partners/shazler-it |
| S39 | Sage in Tunisia (indirect distribution): https://www.webmanagercenter.com/2011/03/16/103323/sage-fete-ses-4-000-licences-installees-en-tunisie/ ; integrator: https://erpresearch.com/sage-partners/athena-conseil |
| S40 | Operacium (fr-tn): https://operacium.com/fr-tn/activites/cafes/ |
| S41 | WMC, 21 June 2025, Poslik interview: https://www.webmanagercenter.com/2025/06/21/547466/la-tunisie-qui-gagne-poslik-apres-notre-implantation-en-tunisie-nous-visons-linternational-assure-ahmed-taktak/ |
| S42 | NACEF calendar: La Presse, 15 Oct 2025: https://www.lapresse.tn/2025/10/15/restauration-cafes-salons-de-the-les-caisses-enregistreuses-deviennent-obligatoires-en-tunisie/ ; Business News, 29 June 2026: https://businessnews.com.tn/2026/06/29/caisses-enregistreuses-fiscales-ce-qui-change-des-le-1er-juillet-pour-les-entreprises-de-consommation-sur-place/1408162/ ; Idaraty procedure: https://idaraty.tn/fr/procedures/systeme-enregistrement-operations-vente-caisse-enregistreuse-certifiee |
| S43 | E-invoicing art. 53 LF 2026: KPMG Tunisie fiscal circular, Feb 2026: https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf ; postponement: La Presse, 6 Apr 2026: https://www.lapresse.tn/?p=4325803 ; Tunisie Numérique: https://www.tunisienumerique.com/facturation-electronique-la-commission-des-finances-refuse-lannulation-de-larticle/ |
| S44 | Hardware prices: Tunisianet scanners: https://www.tunisianet.com.tn/344-douchettes ; Spacenet Honeywell 1400G: https://spacenet.tn/douchette/99816-douchette-code-a-barres-honeywell-voyager-1400g-noir.html ; Spacenet ZKTeco ZKP8016: https://spacenet.tn/imprimante-thermique/103869-imprimante-thermique-de-tickets-zkteco-zkp8016-noir.html ; Tunisianet SPRT SP-POS8811A: https://www.tunisianet.com.tn/imprimante-professionnelle/97857-imprimante-de-ticket-sprt-sp-pos8811a.html ; Primini SP-POS894: https://primini.tn/prix/170885/imprimante-de-ticket-sprt-sp-pos894-noir-sp-pos894ued |
| S45 | La Presse, 7 Jan 2025, digital transformation of Tunisian firms (ITCEQ: 73% of 2,734 firms use management tools; not specific to small shops): https://www.lapresse.tn/2025/01/07/transformation-digitale-ou-en-sont-les-entreprises-tunisiennes/ |
| S46 | Radio Tunisienne, 29 Aug 2024 (Chambre des libraires: subsidised 950 millimes vs non-subsidised 3,400 millimes): http://www.radiotunisienne.tn/2024/08/29/غرفة-الكتبيين-90-من-الكتب-متوفرة-وطلب-كب/ |
| S47 | Wamda, 2017, Ultimium (older Tunisian POS pricing benchmark): https://www.wamda.com/2017/09/comment-cette-startup-tunisienne-reinvente-la-caisse-enregistreuse |
| S48 | Géant Drive "Librairie" aisle (supermarkets sell school supplies): https://www.geantdrive.tn/tunis-city/907-librairie |
| S49 | Tunisie Numérique, 20 Aug 2025, *liste unique de cahiers* (OTOC: ~30% savings estimate): https://www.tunisienumerique.com/rentree-2025-vers-une-reduction-de-30-des-depenses-grace-a-la-liste-unique-de-cahiers-declaration/ |
| S50 | Webdo, 22 Aug 2025, Ministry of Commerce controls (purchase invoices, labelling): https://www.webdo.tn/fr/?p=381878 ; Tunisie Numérique, 22,392 notebooks seized (Sept 2025): https://www.tunisienumerique.com/rentree-scolaire-plus-de-22-000-cahiers-saisis-lors-dune-operation-de-controle/ |

**Searched for but not found:** an official count of librairies by governorate; any Facebook group of Tunisian libraires; public Tunisian prices for Sage, EBP and Odoo projects; Swiver's monthly price; Facture Tunisie's page (HTTP 503 on 15 Oct 2026; a search snippet said 50 TND HT/month, unverified, so it is not used above); search volumes for category keywords (needs Google Keyword Planner).
