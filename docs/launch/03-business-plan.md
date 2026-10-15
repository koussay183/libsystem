# 03 — Business plan, pricing and getting paid: Mektebti.tn

| | |
| --- | --- |
| Date | 15 October 2026 |
| Scope | Price review, unit costs, a new plan grid, a 12-month projection, how to invoice and collect in Tunisia |
| Method | Retailer and vendor price pages (fetched 15 Oct 2026), Google/Firebase/Netlify price pages, PwC tax summaries, Tunisian press, this repo (`cli/lib.mjs`, `firestore.rules`, `src/`), a projection model (assumptions in section 4.1) |
| Status | **Draft for the founder.** Every price below is a proposal until the founder signs off on the decisions in section 6. Tax points must be checked by a Tunisian accountant (expert-comptable) before an invoice goes out. |
| Builds on | `docs/launch/01-market-research.md` (market size, competitors, seasonality) |

**Labels**

- **[F]** Fact, with a source in brackets, e.g. [B6]. Sources are in section 8.
- **[E]** Estimate. The assumption is stated next to it. It can be wrong.
- **[H]** Hypothesis to test in the field.
- **[D]** A decision only the founder can make (all of them are listed in section 6).

**Money format.** Same convention as doc 01: a comma separates thousands and a point separates millimes. So **1,413 DT** is one thousand four hundred and thirteen dinars, and **69.748 DT** is 69 dinars 748 millimes. **TTC** includes 19% VAT; **HT** excludes it. Exchange rate used: **1 USD = 3.0071 TND**, BCT interbank average of 13 Oct 2026 [F, B18].

---

## 0. Executive summary

1. **The annual plan is broken.** At 2,000 DT a year it costs more than the monthly plan in every year: 2,000 vs 1,413 DT in year 1, and 2,000 vs 996 DT a year after that. Over five years that is 10,000 vs 5,397 DT. No informed customer picks it, and one who did would feel cheated when he did the sum. Fix it before any ad money is spent.
2. **The lifetime plan (3,400 DT) equals 36 months of the monthly plan.** It can stay as a cash generator, but only with a cap on the number sold and a time limit on included support. Without those it becomes an open-ended support liability.
3. **The real hardware costs 350–470 DT TTC at retail** [F, B1–B10] for a named kit: a wireless 2D scanner plus an 80 mm thermal printer. Present the 500 DT as "kit + installation + catalogue loading". Do not present it as "scanner 250 + printer 250": owners can check those prices on Tunisianet in one minute.
4. **Cloud costs are tiny. People's time is the real cost.** Firestore in europe-west9 costs about **0.4–3.8 DT per shop per month** [E, priced from B13], 1–5% of the price. Netlify and the domain are a few dinars. The real costs are **about 12 hours to onboard a shop and about 1 hour a month to support it** [E]. Installation capacity, not servers, caps growth.
5. **The biggest technical-financial risk is quota, not cost.** On the free Spark plan, the 50,000 reads/day quota is shared by the *whole project*. Two busy shops can use it up, and then every shop on the platform stops at the same moment until about 08:00–09:00 Tunis time (`src/lib/liveCollection.ts` already describes this failure). **Confirm the project is on Blaze, with budget alerts, before onboarding shop #3.**
6. **Proposed grid, in TTC (the price the shop pays):**
   - **Mensuel** 83 DT/month, unchanged.
   - **Annuel** 830 DT/year, i.e. 2 months free. This replaces 2,000.
   - **À vie "Fondateurs"** 3,400 DT once, with the kit included. Capped at 20 licences, with 24 months of support included, then optional maintenance at 290 DT/year.
   - **Mise en service:** 500 DT with a named kit, 250 DT without.
   - **Extra till:** 20 DT/month.
   - **Referral:** 1 free month for the referrer, 100 DT off the setup for the new shop.
   - **Rentrée offer:** sign before 30 June and get the "Service Rentrée" free.
7. **Unit economics** (HT, VAT-registered):
   - A recurring shop brings about **59 DT/month of contribution** after cloud and payment fees, before founder time.
   - The 500 DT setup pays for the kit and travel but not the labour.
   - Blended acquisition cash in the base case is **about 510 DT per new shop** [E].
8. **Break-even (steady state):**
   - Covering cash costs, including 750 DT/month of ads, takes **about 27 shops**.
   - Also paying two founders 1,500 DT/month each takes **about 78 shops**. It is about 65 if Mektebti is VAT-exempt or the price moves to 99 DT TTC.
9. **12-month projection** (Nov 2026 – Oct 2027):

   | Scenario | New shops | MRR at month 12 (HT) | ARR (HT) | Operating cash, no founder pay |
   | --- | ---: | ---: | ---: | --- |
   | Conservative | 14 | 855 DT | 10.3k DT | Never positive |
   | Base | 27 | 1,547 DT | 18.6k DT | Positive from Feb 2027; +4.3k over the year |
   | Optimistic | 47 | 2,533 DT | 30.4k DT | Positive from Dec 2026; +21k over the year |

   With 3,000 DT/month of founder pay, no scenario breaks even within 12 months. The base case reaches about 78 shops around **March 2029**; the optimistic case around **April 2028** (section 4.6).
10. **Choose the legal and tax status this week** [D]. It decides whether 83 DT is the net price (VAT-exempt auto-entrepreneur, ≤75,000 DT turnover [B28]) or 69.748 DT HT (VAT-registered, régime réel or SUARL, with IS at 20% and a minimum tax [B24, B25]). Base-case year-1 turnover (~37k DT TTC) fits under the auto-entrepreneur ceiling. The optimistic case (~69k) is at the limit.
11. **Getting paid:**
    - Push annual prepayment, by bank transfer or a Konnect/Flouci payment link (1.3% fee [B19, B20]).
    - Monthly payers use a bank standing order, a link, D17/e-Dinar or cash against a numbered receipt.
    - When paid, record it with `plan:extend`. If a shop pays late but is still inside the 14-day grace window, use `plan:set --until` instead: `plan:extend` restarts from today and would hand out free days.
    - After 14 days the app turns read-only by itself. **Never use `--revoke` for an unpaid invoice.**
12. **Keep a cash buffer of about 5,000–6,000 DT before scaling ads** [E]. It covers 5 kits in stock, 3 months of fixed costs, and the Jul–Sep dip, when no installs happen and few setups come in.

---

## 1. Review of the current pricing

### 1.1 What the landing page sells today

From `src/features/landing/copy.ts` (FR and AR, identical numbers):

| Plan (id) | Price shown | Includes (as written) | Note shown |
| --- | --- | --- | --- |
| Mensuel (`month`) | **83 DT / mois** | All features, updates | "+ 500 DT de mise en service"; badge "1er mois offert" |
| Annuel (`year`) | **2 000 DT / an** | All features, updates, mise en service included | none |
| À vie (`life`) | **3 400 DT, une seule fois** | All features, updates, mise en service included, lifetime access | badge "Le plus rentable" |

From the founder's plan, the 500 DT setup is "hand scanner 250 + thermal printer 250". The annual and lifetime plans include the hardware. **None of the prices says HT or TTC**, and no hardware model is named.

### 1.2 What a customer pays over time (current grid, prices as displayed)

Assumptions: the monthly customer pays the 500 DT setup and gets the first month free. The annual plan renews at 2,000 DT, because that is what the page says. The lifetime plan is paid once.

| Horizon | Mensuel | Annuel | À vie | Cheapest |
| --- | ---: | ---: | ---: | --- |
| 1 year | **1,413** (500 + 11 × 83) | 2,000 | 3,400 | Mensuel |
| 2 years | **2,409** | 4,000 | 3,400 | Mensuel |
| 3 years | 3,405 | 6,000 | **3,400** | À vie (by 5 DT) |
| 5 years | 5,397 | 10,000 | **3,400** | À vie |

- Lifetime and monthly cost the same in **month 36**: 500 + 35 × 83 = 3,405.
- Even if annual renewals dropped the hardware (say 1,500 DT/year from year 2), the annual plan would still cost 50% more than monthly from year 2 (1,500 vs 996).
- **VAT changes everything [D].** If the displayed prices are TTC and Mektebti charges VAT, it keeps **69.748 DT HT** a month, 1,680.672 HT a year and 2,857.143 HT for lifetime. If they are HT, the shop pays **98.770 DT TTC** a month, 2,380 a year and 4,046 for lifetime. That is a 19% gap either way, and the page does not say which.

### 1.3 Anomalies and risks

1. **The annual plan is dominated** (1.2). It is the plan SaaS businesses want customers on, because it brings cash up front, lower churn and one collection a year instead of twelve. Today it is the worst deal on the page.
2. **The lifetime plan has no limits.** No cap on the number sold, no definition of "à vie", no support term, no rule for multiple tills, no transfer rule if the shop is sold. Each lifetime shop costs about 15–20 DT/month in support time forever [E, 2.4], and its cash is gone after the first year (3.7).
3. **The hardware price can be checked online.** A 99–139 DT scanner and a 214–229 DT printer [F, B1, B2, B6] make "250 + 250" look like a 40–100% markup. As "installation, configuration, catalogue loading and training, with a named kit and a 1-year warranty", the same 500 DT is fair.
4. **The "Le plus rentable" badge on lifetime** is true only for a shop that stays 3+ years. That is fine, but it pushes the plan that is worst for Mektebti's long-term revenue. Put the badge on Annuel.
5. **HT/TTC is not stated** (1.2). The price is not even defined until this is fixed.
6. **No price for a shop that already owns a scanner or printer**, and no price for a second till. Those are two common objections in the field (doc 01, 2.3 and persona Karim).
7. **Monthly cash collection from cash-based shops is costly.** Twelve reminders, receipts and `plan:extend` runs per shop per year, plus a 1 DT stamp duty per invoice [F, B24]. That is another reason to make the annual plan attractive.

---

## 2. Unit costs

### 2.1 Hardware: real Tunisian retail prices (TTC, checked 15 Oct 2026)

**Barcode hand scanners (douchettes)**

| Model | Type | Price TTC | Retailer | Stock | Source |
| --- | --- | ---: | --- | --- | --- |
| "A9" 1D/2D/QR (QR-A9) | Wired USB | 99 | Tunisianet | In stock | [F, B1] |
| Noname CY8220 1D/2D | Wireless 2.4 GHz | 109 (best offer; 109–179 over recent months) | Primini comparator | — | [F, B5] |
| YHD-1100LW | Wired + wireless | 119 | Spacenet | Arriving (search snippet) | [F, B4] |
| **"A8" 1D/2D/QR (QR-A8)** | **Wireless, 2000 mAh, 1-yr warranty** | **139** | Tunisianet | In stock | [F, B2] |
| Honeywell Voyager 1400g | Wired USB, 1D/2D | 219 | Spacenet | Online / Mourouj | [F, B3] |
| Honeywell 1602g (1D, Bluetooth) | Wireless | 499–549 | Primini (Carthago, Best Buy, Oxtek) | — | [F, B5] |
| Honeywell 1960 Xenon Ultra | USB/RS-232 | 599 (was 669) | Tunisianet | In stock | [F, B1] |

**80 mm thermal ticket printers**

| Model | Interfaces | Auto-cutter | Price TTC | Retailer | Source |
| --- | --- | --- | ---: | --- | --- |
| RP79 (noname) | USB | Not stated | 214 (QSNET) / **229 (Mytek, Tunisianet)** | via Primini, updated 13–14 Oct 2026 | [F, B6] |
| Xprinter T80A | USB, Ethernet, RJ11 | Not stated | 225 (was 299) | Spacenet, in stock | [F, B8] |
| ZKTeco ZKP8016 | USB, serial, Ethernet | **Yes** | 225 | Spacenet, "en arrivage" | [F, B7] |
| **SPRT SP-POS8811A** | **USB + Ethernet** | **Yes (1.5M cuts)** | **329** | Tunisianet, in stock, 1-yr warranty | [F, B9] |
| Epson TM-T20X (Ethernet) | Ethernet, RS-232 | — | 359 | Tunisianet | [F, B10] |
| Honeywell IHR810X | Wired | — | 699 | Spacenet | [F, B12] |

**Consumables:** an 80 × 70 mm thermal roll costs 3.450–3.700 DT TTC [F, B11]. The shop buys these, not Mektebti.

Mytek blocks automated access (HTTP 403), so its prices above come from Primini [B6]. No scanner or printer listing could be found on Wiki.tn or SBS (sbsinformatique.com) by search on 15 Oct 2026.

**Proposed named kits [E, D]:**

| Kit | Contents | Retail TTC | Planning cost to Mektebti |
| --- | --- | ---: | --- |
| **Standard** (in the 500 DT setup) | A8 wireless 2D scanner + 80 mm printer **with auto-cutter** (ZKP8016 when in stock, else SP-POS8811A) | 364–468 | **360 DT TTC (302.52 HT)** [E]. Assumes about 10–15% off retail when buying 5+ units from a distributor with an invoice [H]. VAT is recoverable only if Mektebti is VAT-registered. |
| **Pro** (+250 DT option) | Honeywell Voyager 1400g + Epson TM-T20X or SP-POS8811A | 548–578 | ~520 DT TTC [E] |

Why the auto-cutter: tearing tickets by hand at the rentrée queue is slow. The RP79 and T80A pages do not mention a cutter.

**Hardware VAT rate:** 19% is assumed (the standard rate [B24]). Confirm with the accountant that no reduced rate applies to IT equipment.

### 2.2 Firestore (europe-west9, Paris), per shop per month

**Price list for Standard edition, Paris (europe-west9), USD** [F, B13]:

| Item | Free quota | Price beyond |
| --- | --- | --- |
| Document reads | 50,000 / day | **$0.036 per 100,000** |
| Document writes | 20,000 / day | **$0.107 per 100,000** |
| Document deletes | 20,000 / day | $0.012 per 100,000 |
| Stored data | 1 GiB | $0.179 per GiB-month |
| Internet egress (Europe) | 10 GiB / month | $0.12 per GiB (10 GiB – 1 TiB) |

- The free quota is for **one database per project, per day**, reset around midnight Pacific time [F, B13]. "No-cost usage quotas apply at the project-level" [F, B15], so the quota is shared by every shop.
- A listener is billed one read for every document added or updated in its result set. If it is disconnected for more than 30 minutes, it is billed "as if you had issued a brand-new query" [F, B14]. For a shop with a bad line, that is the main cost driver: each reconnect after 30 minutes re-reads the whole products collection.

**How the app reads and writes (from the code):**

- **Each sale writes** 1 sale document, 1 update per product line, and for a credit sale 1 credit entry plus 1 customer update (`src/features/sales/useSales.ts`, `writeBatch`).
- **Products** are one shared live listener over the whole collection (`src/features/stock/useProducts.ts`). Customers, categories, packs and suppliers use the same pattern (`createLiveCollection`).
- **Each opening of the dashboard** reads:
  - sales for the selected period, capped at 500, 1,500 or 4,000 depending on the period (`src/features/dashboard/periods.ts`);
  - **all purchases, unbounded** (`usePurchases`);
  - up to 3,000 credit entries (`useAllCreditEntries`);
  - customers and products.

**Usage profiles [E]:**

| | S, quiet shop | M, typical Tier A | L, busy / rentrée peak |
| --- | ---: | ---: | ---: |
| Sales per day | 50 | 150 | 300 |
| Lines per sale (avg) | 2 | 2.5 | 2.5 |
| Products | 1,000 | 2,500 | 5,000 |
| Devices | 1 till + owner phone | 1 till + phone | 2 tills + phone |
| Writes per day | ~200 | ~600 | ~1,200 |
| Reads per day | **~7,000** | **~30,000** | **~80,000** |
| …catalogue cold loads (morning, phone opens, reconnects after 30 min) | 3,000 | 10,000 | 30,000 |
| …dashboard / report opens | 3,000 | 15,000 | 40,000 |
| …live updates, other collections, history | 1,000 | 5,000 | 10,000 |
| Storage after 1 year (docs + indexes) | ~0.05 GiB | ~0.17 GiB | ~0.35 GiB |
| **Cost per month, before free quota** | **~$0.12 ≈ 0.4 DT** | **~$0.47 ≈ 1.4 DT** | **~$1.27 ≈ 3.8 DT** |
| Stress case: reads ×5 (reload loops, dashboard left open) | — | — | ~$6 ≈ 18 DT |

Egress is included, at ~1 KB per document read [E]. The free quota is worth about $1.7/month for the whole project: roughly 1.5M reads and 10 GiB of egress.

**What this means:**

- **The cost is negligible.** About 2% of the monthly price for a typical shop. Even 100 shops cost less than about 150 DT/month in Firestore [E].
- **The free quota covers only 1–2 typical shops.** On the free **Spark** plan, exceeding it does not send a bill. It stops the service: `resource-exhausted` for every shop at once until the reset, which `src/lib/liveCollection.ts` calls "every shop on the platform is frozen at the same time". **Check in the Firebase console which plan `libsystem-tn` is on [D].** Move to **Blaze** and set budget alerts at $10, $25 and $50/month. Budgets alert; they do not cap. Paying Google requires an international card (2.6).
- **Read costs grow with history.** The unbounded `usePurchases()` and the 3,000-entry credit listener on the dashboard read more every year. That is cheap now, but bound them by period later (section 7).
- **Firebase Authentication** (email/password): "No-cost up to 50K MAUs" [F, B15]. Cost 0.

### 2.3 Hosting, domain, small tools

| Item | Price | Planning cost |
| --- | --- | --- |
| **Netlify** | Free: 300 credits/month, a **hard limit**. Personal $9/month, 1,000 credits. Pro $20/month, 3,000 credits. A production deploy costs **15 credits**; bandwidth 20 credits/GB; 2 credits per 10,000 requests [F, B16]. | **Move to Personal (~27 DT/month) before ads start.** At 20 deploys a month (every push to `main` deploys), Free is used up by deploys alone (20 × 15 = 300). The ~2.1 MB app bundle (`dist/assets`) plus landing traffic from ads adds bandwidth. Netlify's docs list a "Resume paused projects" page, so assume a site over its Free limit is **paused** [E]. |
| **mektebti.tn domain** | OVHcloud TN: **8.190 DT HT (9.746 TTC) first year**, then **12 DT HT (14.280 TTC) per year** [F, B17]. Eligibility: a Tunisian legal entity, an adult Tunisian or official resident, or the holder of a trademark registered in Tunisia [F, B17]. | ~1.2 DT/month |
| Professional email, WhatsApp Business, Google Sheets register | WhatsApp Business is free; email price depends on the provider (not checked) | ~40 DT/month budget [E] |
| Card/FX fees on USD services (Google, Meta, Netlify) | Depends on the bank | +3% budget [E] |

### 2.4 Time: onboarding and support (the real cost)

| Task | Hours per shop [E] | Note |
| --- | ---: | --- |
| Demo at the shop (incl. travel) | 2–3 | Per demo, not per sale |
| Install: hardware, PC browser, PWA, printer settings | 2–3 | |
| Catalogue loading (1,000–3,000 SKUs) | 4–8 | Shorter for barcodes already in the shared catalogue and CNP books (prefilled at state price, `catalog:official`) |
| Training owner + staff | 1–2 | |
| First-month follow-up | 2 | |
| **Total onboarding** | **~12** (range 10–15) | **The capacity bottleneck:** 2 people can install ~8–10 shops/month at most while still selling [E] |
| Ongoing support | 1 h/month in year 1, 0.75 h/month after | WhatsApp + remote |
| Rentrée peak (Aug–Sep) | +3 h per shop per season | Included in the averages above |
| Collecting one payment | ~15 min | Monthly: 3 h/shop/year. Annual: 15 min |

For unit economics, founder time is valued at **20 DT/hour** [E]. That is a planning shadow price, not a salary benchmark.

**Staffing trigger [E]:** at about 60–80 live shops, support plus rentrée load needs one support/onboarding hire. Budget it from ~1,200–1,500 DT/month [E].

### 2.5 Payment collection costs

| Method | Fee to Mektebti | Recurring capability | Source / note |
| --- | --- | --- | --- |
| **Konnect** (payment link, card, e-Dinar, transfer) | **1.3%** Tunisian cards and e-Dinar; 2.9% foreign cards; **2 DT per bank transfer** received through Konnect. **No subscription, no setup fee, unlimited payment links.** | Payment links (resend each period); recurring billing not listed | [F, B19] |
| **Flouci** (wallet, cards, links) | **1.3% HT** Tunisian cards and wallets; 3% HT foreign cards; no setup fee. The page also shows a "Plus" plan at 19.99 TND/month, so it is inconsistent on monthly fees. | Scheduled transfers exist for users; no merchant recurring billing listed | [F, B20] |
| **ClicToPay** (bank gateway) | 1.5–2.5%, plus integration work (indicative, agency article) | — | [F, B21]. Not worth it at this volume. |
| **D17 / e-Dinar** (La Poste) | No merchant fee schedule published. e-Dinar cards can pay through Konnect at 1.3%. | — | [B22] |
| **Bank transfer to Mektebti's RIB** | Usually 0 for the receiver; the sender pays his bank's fee | **Standing order** (ordre de virement permanent) set up by the shop at its bank | [E]. Check your bank's tariff. |
| **Cash** | 0% | — | Cost = visit time + risk. Always give a numbered receipt and invoice. |
| **Cheque / lettre de change (traite)** | 0% | Several dated instruments for instalments | Law 2024-41 in force since 2 Feb 2025: the **TuniChèque** platform lets the payee verify and reserve the funds. Cheques without funds up to 5,000 DT are no longer a criminal offence [F, B23]. **Verify every cheque on TuniChèque.** |

At 1.3%, the fee on 83 DT is 1.08 DT, on 830 DT it is 10.79 DT, and on 3,400 DT it is 44.20 DT. The model assumes about 30% of receipts go through a 1.3% channel, i.e. **0.4% of revenue** [E].

### 2.6 Taxes and legal status

Have an expert-comptable confirm every line before the first invoice.

| Topic | What applies | Impact on Mektebti |
| --- | --- | --- |
| **VAT** | Standard rate **19%**; reduced rates 13% and 7% for designated items [F, B24] | Subscriptions and setup at 19% if VAT-registered. Decide whether to display TTC or HT [D]. |
| **Stamp duty (droit de timbre)** | **1 DT per invoice** since 1 Jan 2023 [F, B24] | 12 DT/year per monthly shop vs 1 DT per annual shop. Add it to the invoice total or absorb it [D]. |
| **Corporate tax (IS)** if a company (SUARL/SARL) | General rate **20%**, up from 15%, on profits from 1 Jan 2024 (LF 2025) [F, B25]. **Minimum tax 0.2% of turnover, minimum 500 DT**, when there is a loss or the IS is lower [F, B25]. | Year 1 will likely be a loss, so budget ~500 DT of minimum tax [E]. PwC's page is internally inconsistent (it also mentions 15%), so the accountant must confirm. |
| **Income tax (IRPP)** if an individual on régime réel | 0% to 5,000; 15% to 10,000; 25% to 20,000; 30% to 30,000; 33% to 40,000; 36% to 50,000; 38% to 70,000; 40% above. Plus social solidarity contribution 0.5% (2026), 1% from 2027 [F, B26]. | Profit taxed at the founder's marginal rate. Add CNSS for the self-employed (not computed here). |
| **Auto-entrepreneur** (décret-loi 2020-33) | Turnover **≤ 75,000 DT/year**. **No VAT charged** (numbered invoices showing the status). Social contribution ~20 DT/month (7.5% of two-thirds of the SMIG). Individuals only, Tunisian, no existing patente. Registration online (autoentrepreneur.tn, Mobile ID). The income-tax part is **contested between sources**: 0.5% of turnover vs a flat 200 DT (communal zone) / 100 DT per year, first year exempt [F, B28]. | **Strong year-1 option:** 83 DT stays 83 DT net, and the price is 19% cheaper for shops on the forfait regime, which cannot recover VAT. **To check:** that "IT services / software subscription" and hardware resale are on the official activity list; that a two-person team fits (the colleague as his own auto-entrepreneur, or paid commission); and the exit path once turnover nears 75k (optimistic case, section 4). |
| **Withholding on purchases ≥ 1,000 DT TTC** | The **paying entity withholds 1.5%** on goods/services payments of 1,000 DT or more, VAT included. Reduced rates of 1% and 0.5% depend on the payee's IS rate [F, B27]. | An annual + setup invoice (1,330 DT) or a lifetime one (3,400 DT) paid by a company shop will arrive 1.5% short, with a certificate that is a tax credit for Mektebti. Most small shops are on forfait and will not withhold [H]. |
| **Startup Act label** | Label for innovative companies under 8 years old. Fiscal exemptions (reported as up to 8 years), a special foreign-currency account, founder "bourse" [F, B29] | **Medium term (Q1 2027):** needs a company (SUARL/SARL). The foreign-currency account solves paying Google, Meta and Netlify. Check current terms on startup.gov.tn. |
| **E-invoicing (TEIF / El Fatoora)** | LF 2026 art. 53 extends it to *services*; application postponed in April 2026 (doc 01, S43) | Mektebti sells a *service*, so if this is reactivated, **Mektebti's own invoices** may need TEIF. Watch item. |
| **Paying foreign services** | Google Cloud (Firebase), Netlify, Google Ads and Meta Ads bill in USD by international card | The international "carte technologique" ceiling could not be confirmed from an official source [B29 mentions an old 10k→100k DT figure for labelled startups]. **Ask the bank for the current limit before planning ad budgets** [D]. |

### 2.7 Cost summary per shop

| | Per new shop (one-off) | Per shop per month (running) |
| --- | ---: | ---: |
| Standard kit | 302.52 DT HT (360 TTC) [E] | — |
| Onboarding time, 12 h × 20 DT | 240 [E] | — |
| Travel | 60 [E] | — |
| Support time | — | 20 (year 1) / 15 (after) [E] |
| Firestore + other cloud | — | ~1.5 [E] |
| Payment fees | — | ~0.3 [E] |
| Collection time, monthly payers | — | ~5 [E] |
| **Total** | **~600 DT** (~300 without kit) | **~22–27 DT** incl. time; **~2 DT** cash only |

---

## 3. Proposed plan grid

### 3.1 Principles

1. **Keep the numbers people have already seen.** The two clients and the landing know 83 and 500. Change only what is broken: the annual plan, the lifetime terms and the HT/TTC confusion.
2. **Show TTC prices.** Most target shops are on the forfait regime and cannot recover VAT [H], so the price they pay is the price that matters. Show HT in small print for companies. If Mektebti is a VAT-exempt auto-entrepreneur, write "TVA non applicable" [D].
3. **The annual plan must be the obvious best deal for a shop that intends to stay**, so recurring cash comes in up front and only one collection a year is needed.
4. **Hardware is an option, named and sold at about cost.** Mektebti's margin is the service, not the scanner.
5. **Lifetime is a capped, time-limited launch offer.** It funds year 1 without becoming a permanent liability.
6. **Never discount the monthly price.** Promotions act on setup, extra months or services.

### 3.2 The grid

All prices are TTC [D]. HT is computed at 19% VAT.

| | **Mensuel** | **Annuel** (badge: "Recommandé — 2 mois offerts") | **À vie — Offre Fondateurs** |
| --- | --- | --- | --- |
| Price | **83 DT / month** (69.748 HT), about 2.8 DT/day | **830 DT / year** (697.479 HT), about 2.3 DT/day | **3,400 DT once** (2,857.143 HT) |
| 1st month | Free | Free (first payment covers months 2–13) | — |
| Commitment | None; 30 days' notice; paid in advance | 12 months, prepaid | — |
| Mise en service | **500 DT with the standard kit** / **250 DT without** | Same (launch offer in 3.4) | **Included, with the standard kit** |
| Includes | All features, updates, 1 till + unlimited phone/tablet viewing for the owner, WhatsApp + remote support | Same + priority support in Aug–Sep | Same, **support included for 24 months**. After that, optional **Maintenance 290 DT/year**; without it the software keeps working and support is billed per call [D] |
| Cap | — | — | **20 numbered licences**, until 30 June 2027 or sold out [D] |

**Options and add-ons [D]:**

| Option | Price TTC | Rationale |
| --- | --- | --- |
| **Extra till (poste)** | **+20 DT/month**, or +200 DT/year on annual, or +600 DT once on lifetime | Busy shops (persona Karim) get real value from a second till. Phones/tablets for viewing stay free. Not enforced in the app today: contract only (section 7). |
| Extra standard kit (for the 2nd till) | 390 DT | Cost ~360 + configuration |
| Pro kit upgrade | +250 DT | Honeywell scanner + Epson/SPRT printer (2.1) |
| **Service Rentrée** | **190 DT** per season [E] | Load this year's class supply lists as packs + one on-site check in late August. Sells in Jun–Jul, when no new installs happen, so it fills the summer cash dip. |
| Chains (3+ shops) | Quote; −15% from the 3rd shop [E] | Tier C, rare; each shop is its own account today |

### 3.3 What changes for the customer (new grid, with kit)

| Horizon | Mensuel | Annuel | À vie (no maintenance) | À vie + maintenance from year 3 |
| --- | ---: | ---: | ---: | ---: |
| 1 year | 1,413 | **1,330** | 3,400 | 3,400 |
| 2 years | 2,409 | **2,160** | 3,400 | 3,400 |
| 3 years | 3,405 | **2,990** | 3,400 | 3,690 |
| 5 years | 5,397 | 4,650 | **3,400** | 4,270 |

Without the kit (shop owns hardware, 250 DT setup): Mensuel costs 1,163 / 2,159 / 3,155 / 5,147. Annuel costs 1,080 / 1,910 / 2,740 / 4,400.

- **Annual now beats monthly at every horizon:** it saves 83 DT in year 1, 249 by year 2, 415 by year 3 and 747 by year 5.
- **Lifetime beats annual from year 4** without maintenance (3,400 vs 3,820), and **from year 5** with maintenance (4,270 vs 4,650). That is a fair deal for a shop that will stay long, and it is not a giveaway.
- **Against the market** (doc 01, 2.3): annual at 697 DT HT is 1.2–1.8× a generic cloud POS (Gastevo ~420 HT/year, Hesabi 390 HT, Swiver 600 HT). The current grid was 2.8–4.3×. The gap is now defensible by done-for-you setup, offline selling and bookshop fit.

### 3.4 Promotions (simple enough to say in one sentence)

| Offer | When | Mechanics | Cost to Mektebti [E] |
| --- | --- | --- | --- |
| **"Payez l'année, l'installation à moitié prix"** (launch, post-rentrée) | 16 Oct – 20 Dec 2026 | Annual plan: mise en service with kit **250 DT instead of 500** | 210 DT HT per shop, in exchange for 830 DT of cash up front |
| **"Prêt pour la rentrée 2027"** | 1 Feb – 15 Jun 2027 | Installed before 30 June → **Service Rentrée 2027 included** (worth 190 DT) | ~3 h of time per shop |
| **Parrainage (referral)** | Always | The referrer gets **1 month free** per referred shop that pays, 2 months if it takes annual or lifetime, capped at 6 per year. The referred shop gets **100 DT off** the setup. Apply the free month with `plan:extend --days 30`. | ~183 DT per acquired shop. That is half the ad CAC (4.2). |
| **Chamber member price** | If a partnership is signed with the Chambre nationale des libraires | **−10% on the annual plan** (747 DT) | 83 DT/year per shop |
| Not proposed | — | Discounting the 83 DT, or "2 months free" on monthly | It erodes the anchor price |

### 3.5 Lifetime terms (put these in the contract)

1. "À vie" means **for as long as Mektebti operates the service**. It covers one shop: one legal entity at one address. It is transferable **once** if the business is sold (fee 200 DT [D]).
2. It includes all updates, 1 till and the standard kit with the retailer's 1-year warranty passed through. An extra till costs 600 DT once.
3. Support is included for **24 months**. After that, Maintenance costs 290 DT/year, or support is billed per call: e.g. 50 DT remote, 100 DT on site [E, D].
4. If Mektebti ever stops the service: **6 months' notice** and a full export. The app already has backup and CSV export (`src/features/backup/backupService.ts`).
5. **Cap: 20 licences**, numbered on the invoice. After the cap, raise the price (e.g. 4,400 DT) or close the offer [D].
6. Payment in one go, or **3 instalments over 3 months** by lettres de change or cheques checked on TuniChèque. Until the last instalment clears, set `paidUntil` month by month (5.4).

### 3.6 Unit economics per plan

Per shop, HT, Mektebti VAT-registered. Kit at 302.52 HT. Founder time at 20 DT/h. Before acquisition cost. Each "year 2+" or 5-year figure assumes the shop stays.

| | Mensuel | Annuel | À vie |
| --- | ---: | ---: | ---: |
| Year-1 revenue | 1,187.40 (setup 420.17 + 11 × 69.748) | 1,117.65 (420.17 + 697.48) | 2,857.14 |
| Year-1 direct costs (kit, 12 h onboarding, travel, 12 h support, cloud, fees) | 866.17 | 865.84 | 874.12 |
| **Year-1 contribution** | **321 (27%)** | **252 (23%)** | **1,983 (69%)** |
| Year-2+ revenue | 836.98 | 697.48 | 0, then 243.70 maintenance from year 3 |
| Year-2+ costs (9 h support, cloud, fees) | 202 | 201 | 198 |
| **Year-2+ contribution** | **635/yr (76%)** | **496/yr (71%)** | −198 (year 2), ~+45/yr with maintenance |
| **5-year cumulative** | 2,861 | 2,236 | 1,920 with maintenance / **1,191 without** |

**Reading:**

- **Setup is not a profit centre.** 500 DT TTC (420 HT) minus the 302.52 kit leaves ~118 HT. That covers travel but not the ~12 h of onboarding. The recurring price pays for onboarding within about 4–6 months. **Do not cut the setup below 500 with kit except as a prepaid-annual promotion.**
- **Annual earns less per month than monthly** (−17%). It wins on lower churn, cash up front and 11 fewer collections (~55 DT/year of time saved [E]).
- **Lifetime is excellent in year 1 and poor after year 4 unless maintenance is sold.** Hence the cap and the 24-month support term.

**Lifetime value vs acquisition [E]:**

| Metric | Value |
| --- | --- |
| Recurring contribution | ~59 DT/month per shop before founder time; ~40 after support time |
| Average life at 2% monthly churn | ~50 months |
| Lifetime value | ~2,000–2,900 DT HT |
| Blended acquisition cost (base, 4.2) | ~510 DT |
| **Lifetime value / acquisition cost** | **~4–6** |
| Payback of acquisition cost | ~9–13 months |

### 3.7 Break-even: how many shops pay the bills (steady state)

Assumptions:

- **Recurring contribution per shop** at a 60% monthly / 30% annual / 10% lifetime mix (lifetime brings no recurring money in its first 2 years). It is net of cloud (1.5 DT) and payment fees. Extra tills (10% of shops) are included.
- **Fixed costs** of 820 DT/month for running the company: accountant 200, telecom 120, fixed travel 250, cloud base 70, marketing material 100, miscellaneous 80. **Plus ads at 750 DT/month** [E].

| Monthly fixed cash costs | 83 / 830 TTC, VAT-registered (58.9 DT/shop) | 83 / 830, VAT-exempt (70.5 DT/shop) | 99 / 990 TTC, VAT-registered (70.3 DT/shop) |
| --- | ---: | ---: | ---: |
| 1,570 DT: running costs + ads, **no founder pay** | **27 shops** | 22 | 22 |
| 4,570 DT: + 2 founders at 1,500 DT | **78 shops** | 65 | 65 |
| 5,570 DT: + 2 founders at 2,000 DT | **95 shops** | 79 | 79 |

**Implication [E]:** at today's price, Mektebti pays its cash costs at ~30 shops but pays two people only at ~80 shops. Three levers move that number:

1. A VAT-exempt status in year 1.
2. Revenue per shop: annual, extra tills, Service Rentrée, a later 99 DT price.
3. Lifetime cash used to fund growth. All 20 licences = ~57k DT HT, but it costs ~1,000 DT/year of recurring revenue per licence after year 2.

---

## 4. 12-month projection (Nov 2026 – Oct 2027)

### 4.1 Assumptions [E unless marked]

| Assumption | Conservative | Base | Optimistic |
| --- | --- | --- | --- |
| New shops (Nov→Oct) | 1, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 1 = **14** | 2, 3, 2, 3, 4, 4, 4, 2, 1, 0, 0, 2 = **27** | 3, 5, 4, 6, 7, 7, 7, 4, 1, 0, 0, 3 = **47** |
| Plan mix: monthly / annual / lifetime | 70 / 25 / 5% | 60 / 30 / 10% | 50 / 35 / 15% |
| Monthly churn (monthly plan) | 3% | 2% | 1.5% |
| Ads (Google + Meta), DT/month | 450; 300 in Jul; 150 in Aug–Sep | 750; 300; 150 | 1,200; 400; 150 |
| Share of new shops coming from ads | 40% | 50% | 60% |

Common to all three scenarios:

- **Seasonality** follows doc 01, 1.5: installs freeze from 1 Aug to ~10 Oct, and the best closing months are Oct–Dec and Feb–Jun.
- **Prices** are the new grid (3.2), all revenue HT (VAT-registered). Under VAT-exempt auto-entrepreneur, multiply revenue by 1.19.
- **Customer extras:** 80% of non-lifetime shops buy the kit; 10% add a second till.
- **Existing clients:** Librairie Sofiene is prepaid to 17 Aug 2027 (SAAS.md) and renews on annual. The second client is assumed monthly. **Founder to correct both.**
- **Costs:** fixed 820 DT/month, a one-off 600 DT in Nov (demo video, roll-up banner, flyers), 60 DT travel per install, 1.5 DT cloud per shop, 0.4% payment fees, kit at 302.52 HT.
- **Founder pay:** shown separately at 3,000 DT/month (2 × 1,500).
- **Not modelled:** VAT timing, minimum tax (~500 DT due in 2028 for 2027 if a company), and the 1.5% withholding.
- Fractional shops are expected values. For example, "10% lifetime" on 2 installs counts as 0.2 of a licence.

### 4.2 Acquisition targets, funnel and CAC

| 12 months | Conservative | Base | Optimistic |
| --- | ---: | ---: | ---: |
| Ads spend | 4,650 DT | 7,350 DT | 11,500 DT |
| New shops | 14 | 27 | 47 |
| **CAC, ads only** (ads ÷ ad-sourced shops) | **830 DT** | **544 DT** | **408 DT** |
| Blended acquisition cash per new shop (ads + materials + sales travel) | 735 DT | 510 DT | 407 DT |

**No Tunisian benchmark for Meta or Google ad costs could be found.** Published averages are global or US-heavy, e.g. a WordStream 2025 lead-ad average of $27.66 per lead [F, B30], which says nothing about Tunisia. So treat the base CAC as a **budget guardrail, not a forecast**, and measure it.

**Funnel targets for the base budget** (750 DT/month, about 60% Meta and 40% Google Search) [E/H]:

1. Cost per WhatsApp lead **≤ 15 DT** → ~50 leads/month.
2. **≥ 40%** are real librairie decision-makers → ~20.
3. **≥ 50%** book a demo → ~10 demos.
4. **≥ 20%** of demos close → **~2 ad-sourced shops/month**, a CAC of ~375 DT.

**Kill / shift rule [D]:** if 2,000 DT of spend gives a CAC above 800 DT, or 300 DT gives no demo, move the money to field visits and referrals. Those cost ~180–300 DT per shop [E, doc 01 4.1].

**Acquisition mix target (base) [E]:** about 50% ads-assisted, 30% field walk-ins in clusters, 20% referrals and the chamber.

### 4.3 Base scenario: month by month (HT, DT)

| Month | New shops | Live shops | MRR (HT) | Cash in (HT) | Cash out (HT, no founder pay) | Operating cash flow | Cumulative | Cumulative with 3,000 DT/month founder pay |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nov 26 | 2 | 4 | 167 | 1,324 | 2,798 | -1,475 | -1,475 | -4,475 |
| Dec 26 | 3 | 7 | 305 | 2,462 | 2,516 | -54 | -1,529 | -7,529 |
| Jan 27 | 2 | 9 | 466 | 2,176 | 2,210 | -34 | -1,563 | -10,563 |
| Feb 27 | 3 | 12 | 599 | 2,668 | 2,525 | 143 | -1,419 | -13,419 |
| Mar 27 | 4 | 16 | 792 | 3,630 | 2,843 | 786 | -633 | -15,633 |
| Apr 27 | 4 | 20 | 1,025 | 4,006 | 2,851 | 1,155 | 522 | -17,478 |
| May 27 | 4 | 23 | 1,255 | 4,164 | 2,857 | 1,307 | 1,829 | -19,171 |
| Jun 27 | 2 | 25 | 1,446 | 3,068 | 2,239 | 829 | 2,658 | -21,342 |
| Jul 27 | 1 | 26 | 1,531 | 2,079 | 1,477 | 603 | 3,261 | -23,739 |
| Aug 27 | 0 | 26 | 1,553 | 1,976 | 1,018 | 958 | 4,219 | -25,781 |
| Sep 27 | 0 | 25 | 1,532 | 1,026 | 1,013 | 13 | 4,232 | -28,768 |
| Oct 27 | 2 | 27 | 1,547 | 2,258 | 2,238 | 20 | 4,252 | -31,748 |
| **12 months** | **27** | **27** | **1,547** | **30,837** | **26,584** | **4,252** | | **-31,748** |

- **Where the cash in comes from:** setup 9,189 DT, subscriptions 13,933, lifetime licences 7,714 (2.7 licences). **A quarter of year-1 cash is lifetime money**, so the base case depends on the lifetime offer selling.
- **MRR** counts monthly plans plus annual plans divided by 12. Lifetime is excluded. **ARR at month 12 = 18,569 DT HT.**
- **Break-even month (operating cash, no founder pay): February 2027, and it stays positive.** The deepest cumulative dip is −1,563 DT (Jan 2027).
- **With founder pay:** never within 12 months (−31.7k DT).

### 4.4 Conservative and optimistic scenarios (HT, DT)

**Conservative**

| Month | New shops | Live shops | MRR | Cash in | Cash out | Op. cash flow | Cumulative | Cum. with founder pay |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nov 26 | 1 | 3 | 146 | 574 | 2,182 | -1,609 | -1,609 | -4,609 |
| Dec 26 | 2 | 5 | 223 | 1,302 | 1,894 | -592 | -2,200 | -8,200 |
| Jan 27 | 1 | 6 | 335 | 1,075 | 1,589 | -514 | -2,715 | -11,715 |
| Feb 27 | 2 | 8 | 408 | 1,442 | 1,899 | -457 | -3,171 | -15,171 |
| Mar 27 | 2 | 10 | 530 | 1,713 | 1,903 | -190 | -3,361 | -18,361 |
| Apr 27 | 2 | 12 | 649 | 1,802 | 1,906 | -104 | -3,465 | -21,465 |
| May 27 | 2 | 13 | 766 | 1,889 | 1,909 | -20 | -3,485 | -24,485 |
| Jun 27 | 1 | 14 | 865 | 1,471 | 1,603 | -132 | -3,617 | -27,617 |
| Jul 27 | 0 | 14 | 896 | 822 | 1,145 | -323 | -3,940 | -30,940 |
| Aug 27 | 0 | 14 | 877 | 1,338 | 997 | 342 | -3,598 | -33,598 |
| Sep 27 | 0 | 13 | 858 | 605 | 993 | -387 | -3,986 | -36,986 |
| Oct 27 | 1 | 14 | 855 | 1,089 | 1,601 | -512 | -4,498 | -40,498 |
| **12 months** | **14** | **14** | **855** | **15,123** | **19,621** | **-4,498** | | **-40,498** |

Operating cash flow is positive only in August, when Sofiene renews, so there is **no sustained break-even**. ARR at month 12 = 10,262 DT. **If after 3 months (end of January) the pace matches this scenario, cut ads to 450 DT/month and put the time into referrals and the chamber.**

**Optimistic**

| Month | New shops | Live shops | MRR | Cash in | Cash out | Op. cash flow | Cumulative | Cum. with founder pay |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nov 26 | 3 | 5 | 193 | 2,321 | 3,572 | -1,250 | -1,250 | -4,250 |
| Dec 26 | 5 | 10 | 404 | 4,678 | 3,613 | 1,065 | -186 | -6,186 |
| Jan 27 | 4 | 14 | 663 | 4,603 | 3,307 | 1,296 | 1,111 | -7,889 |
| Feb 27 | 6 | 20 | 925 | 5,991 | 3,945 | 2,046 | 3,157 | -8,843 |
| Mar 27 | 7 | 27 | 1,278 | 7,448 | 4,273 | 3,175 | 6,331 | -8,669 |
| Apr 27 | 7 | 34 | 1,664 | 7,937 | 4,286 | 3,652 | 9,983 | -8,017 |
| May 27 | 7 | 40 | 2,045 | 8,173 | 4,297 | 3,876 | 13,859 | -7,141 |
| Jun 27 | 4 | 44 | 2,361 | 6,156 | 3,360 | 2,796 | 16,655 | -7,345 |
| Jul 27 | 1 | 45 | 2,504 | 3,278 | 1,614 | 1,664 | 18,318 | -8,682 |
| Aug 27 | 0 | 45 | 2,517 | 2,505 | 1,049 | 1,456 | 19,774 | -10,226 |
| Sep 27 | 0 | 44 | 2,493 | 1,517 | 1,044 | 474 | 20,248 | -12,752 |
| Oct 27 | 3 | 47 | 2,533 | 3,744 | 3,041 | 703 | 20,951 | -15,049 |
| **12 months** | **47** | **47** | **2,533** | **58,352** | **37,401** | **20,951** | | **-15,049** |

- Operating break-even from **December 2026**. With founder pay, the months of March to May 2027 are positive, but the year is not.
- ARR at month 12 = 30,398 DT.
- 7 lifetime licences sold.
- 7 installs a month (~84 h of onboarding) is near the 2-person ceiling (2.4).
- The TTC-equivalent turnover (~69k DT) is near the **75k auto-entrepreneur ceiling**.

### 4.5 Scenario summary

| | Conservative | Base | Optimistic |
| --- | ---: | ---: | ---: |
| New shops (12 mo) | 14 | 27 | 47 |
| Live shops at Oct 2027 | 14 | 27 | 47 |
| MRR at month 12 (HT) | 855 | 1,547 | 2,533 |
| ARR at month 12 (HT) | 10,262 | 18,569 | 30,398 |
| Cash in, 12 months (HT) | 15,123 | 30,837 | 58,352 |
| Operating cash flow, 12 months (no founder pay) | −4,498 | +4,252 | +20,951 |
| Sustained operating break-even month | Not reached | **Feb 2027** | **Dec 2026** |
| Deepest cumulative cash dip (no founder pay) | −4,498 (still falling) | −1,563 | −1,250 |
| With 3,000 DT/month founder pay, 12-month cumulative | −40,498 | −31,748 | −15,049 |

### 4.6 Beyond 12 months: when can the founders be paid? [E]

The model was extended to 36 months with these assumptions: the same seasonal pattern, new installs ×1.5 in year 2 and ×2 in year 3, 85% annual renewal, the lifetime cap of 20, and 70% of lifetime shops buying maintenance from year 3.

| | Live shops Oct 2028 | Live shops Oct 2029 | Reaches ~78 shops (pays 2 × 1,500 DT) |
| --- | ---: | ---: | --- |
| Conservative | ~28 | ~46 | Not within 36 months |
| Base | ~59 | ~99 | **~March 2029** |
| Optimistic | ~106 | ~180 | **~April 2028** |

**Reading:** at 83 DT and with two people doing everything, salaries arrive in **year 2 (optimistic) or year 3 (base)**. To bring that forward:

1. Choose a VAT-exempt start.
2. Sell annual and extra tills.
3. Test **99 DT TTC** in a new region in spring 2027 [H, D].
4. Push referrals and the chamber, which cost less than ads.
5. Apply for the Startup label (2.6).

### 4.7 Cash needs

**Buffer before scaling ads: ~5,000–6,000 DT [E]:**

| Item | Amount |
| --- | ---: |
| Five standard kits in stock (2 weeks of installs in Feb–May) | ~1,800 DT |
| Three months of fixed costs + ads (base) | ~4,700 DT |
| Less early setup receipts | (deducted) |
| VAT paid on kits before it is recovered | (included) |

**Funding the founders in year 1** means one of four things: founder savings or other income; lifetime pre-sales, which trade future revenue; a startup grant or label "bourse" (2.6); or accepting the base-case −31.7k DT.

### 4.8 Main risks to the numbers

| Risk | Effect | Mitigation |
| --- | --- | --- |
| The Tier A share is lower than assumed, or buyers resist the price | The conservative case | Validate with the 10 interviews of doc 01, 3.6, before spending past 2,000 DT on ads |
| Firestore Spark quota | Platform-wide freeze on a busy day | Blaze + budget alerts **now** (2.2) |
| Lifetime oversold | Support liability from 2029 | Cap of 20; 24-month support term; maintenance |
| Churn after the first rentrée (Sep–Oct 2027) | MRR drop | Service Rentrée + a check-in visit in late August |
| International card limit | Ads or Firebase billing stop | Ask the bank now; Startup label foreign-currency account |
| Founder time at the rentrée | Support overload, slow installs | Install freeze 1 Aug–10 Oct; hire at ~60–80 shops |
| Tax status error (VAT, withholding) | Back taxes, repricing | Accountant before the first invoice |

---

## 5. Getting paid in Tunisia: the process

### 5.1 Week-1 set-up checklist

1. **Legal status and tax ID [D]:**
   - Auto-entrepreneur (fastest, VAT-exempt, ≤75k DT), **or** individual on régime réel, **or** SUARL.
   - Get the matricule fiscal or the auto-entrepreneur card before invoicing.
   - Engage an expert-comptable: the model budgets 200 DT/month [E].
2. **Collection accounts:**
   - A business bank account (or CCP) with RIB printed on every invoice.
   - **Konnect** merchant account: no setup or subscription fee [B19].
   - Optionally Flouci [B20].
   - A WhatsApp Business catalogue entry with the payment options.
3. **Documents** (FR + AR, one page each):
   - **Tariff sheet:** the grid in 3.2.
   - **Order form / contract (CGV):** plan, price TTC, start date, free month, renewal, 30-day notice, prepayment, late-payment rule (5.5), data ownership and export, data kept 6 months after termination, lifetime terms (3.5), hardware warranty pass-through, support hours, 60 days' notice of any price change, and the current price locked 12 months for existing clients.
   - **Invoice template.**
4. **Billing register** (Google Sheet):
   - Columns: shop, login email, shopId, plan, price TTC, paidUntil, last invoice no., amount, method, date paid, withholding certificate (Y/N), next action.
5. **Firebase on Blaze + budget alerts**, and Netlify Personal (2.2, 2.3).

### 5.2 Which payment method to push

| Rank | Method | For |
| --- | --- | --- |
| 1 | **Annual prepayment by bank transfer** (0 fee) **or Konnect link** (1.3%) | Everyone who will stay a year: the default offer |
| 2 | **Standing order** (virement permanent) set up by the shop at its bank | Monthly plans: no reminders, no visits |
| 3 | Konnect / Flouci payment link sent on WhatsApp, or D17 / e-Dinar through Konnect | Monthly plans paid from a phone |
| 4 | Cash at a visit, against a **numbered receipt + invoice** | Shops that will not pay any other way. Bundle it with a support visit. |
| 5 | Cheques / lettres de change | Lifetime or annual instalments only. **Verify on TuniChèque** [B23]. |

### 5.3 Invoicing rules

- **One invoice per payment period**, numbered with no gaps (e.g. `MK-2026-0001`), dated, in DT with 3 decimals.
- Show:
  - Mektebti's name, address and matricule fiscal (or auto-entrepreneur number);
  - the client's name, address and **matricule fiscal if it has one** (most shops do; the app prints it on their own invoices via `ShopSettings.taxId`);
  - the description (e.g. "Abonnement Mektebti — Annuel du 01/12/2026 au 30/11/2027");
  - HT, VAT 19% and TTC, or the VAT-exempt mention;
  - **droit de timbre 1.000 DT** [B24];
  - the payment terms.
- **The mandatory mentions come from the VAT code.** Have the accountant validate the template once.
- **Hardware on a separate line** from the service, for warranty and in case VAT treatment differs.
- **Withholding:** if a company shop pays 1,000 DT TTC or more, it may withhold 1.5% [B27]. Accept the net amount, **get the withholding certificate**, file it, and mark the invoice paid.
- **Optional, dogfooding:** run Mektebti's own billing as a "shop" inside Mektebti. Products are "Abonnement mensuel", "Mise en service", "Kit"; customers are the shops; unpaid invoices go in the **carnet de crédit**. The accountant must confirm the A4 invoice layout is legally complete first.

### 5.4 The billing cycle and the CLI runbook

The plan lives in the `paidUntil` claim, which only `cli/lib.mjs` can set. The security rules allow writes until **`paidUntil` + 14 days** (`RULES_GRACE_MS`, which must match `graceMs()` in `firestore.rules`). After that the shop can still read and export but not record anything. Claim changes reach a till within the hour, or immediately on reload.

| Event | Command (from `cli/`) | Note |
| --- | --- | --- |
| New shop installed (trial month) | `node lib.mjs shops:create --email <login> --password <pw> --name "Librairie X" --days 30 --plan month` | `--plan` stores a label (`month` / `year` / `life`). With the grace window, the trial is effectively 44 days. |
| Payment received **before or on** `paidUntil` | `node lib.mjs plan:extend <email> --days 30` (monthly) or `--days 365` (annual) | Adds to the current end date, so the anniversary is kept |
| Payment received **late, still inside the 14-day grace window** (the shop kept selling) | `node lib.mjs plan:set <email> --until <old paidUntil + 1 month or + 1 year>` | **Do not use `plan:extend` here.** It restarts from today when `paidUntil` has passed, so the shop would get the late days free (`cli/lib.mjs`, `plan:extend`: `Math.max(Date.now(), paidUntil)`). |
| Payment received **after** the shop was blocked (past the 14 days) | `node lib.mjs shops:resume <email> --days 30` | Starts from today, which is fair: the shop could not record anything during the block |
| Lifetime fully paid | `node lib.mjs plan:set <email> --until 2099-12-31 --plan life` | During instalments, set the date to one month past each paid instalment |
| Referral reward | `node lib.mjs plan:extend <email> --days 30` | Note it in the register |
| Weekly check (every Monday) | `node lib.mjs shops:list` | Shows each shop's end date and "Nd left" (yellow ≤ 14 days, red expired) |
| Fraud or compromised account only | `node lib.mjs shops:suspend <email> [--revoke]` | **Never `--revoke` for an unpaid invoice.** As the CLI warns, it can sign out an offline till and destroy its queued sales. A late payer simply expires on its own. |

### 5.5 When a shop does not pay

| Day | What the app does (automatic) | What the team does |
| --- | --- | --- |
| J−10 | Normal | Issue the invoice and send it on WhatsApp with RIB, Konnect link and amount |
| J−3 | Normal | Friendly reminder |
| **J0** (`paidUntil`) | Orange banner **"Abonnement expiré"**; sales are still recorded (`auth.lapsedBody`) | WhatsApp + call |
| J+7 | Orange banner | Founder calls. Agree a date; offer to move to annual or a 2-part payment. |
| **J+14** | Red banner. **Recording stops; reading and backup still work** (`auth.blockedBody`). No CLI action needed. | Final notice: "réactivation immédiate dès paiement" |
| J+30 | Read-only | Formal letter (mise en demeure) for any unpaid amount; support stops |
| J+90 | Read-only | Close the account under the contract. Send the shop its data export (backup / CSV). Delete after the retention period stated in the contract. |

Rules:

1. The hardware was sold, not leased, so never threaten to take it back.
2. Never hold the shop's data hostage. Reading and export stay open by design (SAAS.md, "Reads outlive the plan on purpose").
3. Keep the tone of a neighbour, not a bank. Word of mouth is the main channel.

### 5.6 Monthly close (1 hour, by the 5th)

1. Match bank, Konnect, Flouci and cash receipts to invoices in the register.
2. Run `shops:list` and check that every paid shop's end date moved and every unpaid one is in the 5.5 sequence.
3. Send the accountant the invoices, receipts, withholding certificates, kit purchase invoices and the foreign-service receipts (Google, Meta, Netlify).
4. Track four numbers: **live shops, MRR, cash in the bank, CAC of the month** (ads ÷ ad-sourced shops).

---

## 6. Decisions the founder must make

Also returned in the structured summary.

1. **Legal and tax status:** auto-entrepreneur (VAT-exempt, ≤75k DT) vs individual on régime réel vs SUARL, plus a Startup label later.
2. **TTC or HT display**, and so whether 83 DT is the shop's price or Mektebti's net.
3. **Monthly price:** keep 83 DT (recommended for launch) or test 99 DT TTC in a new region in spring 2027.
4. **Annual price:** 830 DT/year (2 months free) to replace 2,000, with the setup charged separately.
5. **Lifetime:** keep 3,400 DT with the kit; cap at 20; 24 months of support then 290 DT/year maintenance; instalments allowed (3×); price after the cap.
6. **Setup:** 500 DT with a named standard kit / 250 DT without; which kit models and which supplier.
7. **Add-ons:** extra till 20 DT/month (200/year, 600 once); Service Rentrée 190 DT; Pro kit +250 DT.
8. **Promotions:** launch "annual = setup at half price" until 20 Dec 2026; "Prêt pour la rentrée" Feb–Jun 2027; referral (1 month + 100 DT); chamber −10%.
9. **Existing clients:** terms for Librairie Sofiene (prepaid to 17 Aug 2027) and the second client. Grandfather their price for 12 months.
10. **Stamp duty:** add 1 DT to each invoice or absorb it.
11. **Founder pay and runway:** how much to draw, from when, and how year 1 is funded.
12. **Ads budget and the kill/shift rule** (base 750 DT/month; stop above 800 DT CAC).
13. **Billing policy:** anniversary billing; accepted methods; the J+14 / J+30 / J+90 dunning steps; data retention after closure.
14. **Infrastructure spend:** move Firebase to Blaze with budget alerts; Netlify Personal.
15. **Engage an expert-comptable**: invoice template, VAT on hardware, withholding, minimum tax.

---

## 7. Implementation tasks for the repo

Also returned in the structured summary.

| Priority | Task | Files |
| --- | --- | --- |
| Now (after decisions 2–8) | Update the landing pricing to the new grid. Add a "TTC" label (or "TVA non applicable"); show the annual plan as "Recommandé — 2 mois offerts"; move the badge off lifetime; add the lifetime cap ("20 licences Fondateurs"); name the kit models; add the setup line "500 DT avec matériel / 250 DT sans"; add the extra-till price. FR and AR. | `src/features/landing/copy.ts`, `src/features/landing/LandingPage.tsx` |
| Now | Confirm the Firebase project is on Blaze, set budget alerts, and write the plan and alert amounts into the ops doc | Firebase console; `SAAS.md` |
| Soon | CLI `plan:renew <shop> --period month\|year`: always extends from the current `paidUntil` while it is inside the 14-day grace window, so late payers keep their anniversary. Add `--from-end` to `plan:extend`. | `cli/lib.mjs` |
| Soon | CLI billing ledger: `billing:record <shop> --amount --method --invoice [--days]` writes to a **root** collection `billing/{shopId}/payments/{id}` and extends the plan in one step. It must **not** go under `shops/{id}/…`, which the shop itself can write while paid. Add `billing:due --within 10`, which lists shops expiring soon with `wa.me` reminder links. | `cli/lib.mjs`; check `firestore.rules` leaves `billing/` denied to clients (no rule = denied) |
| Soon | In-app reminder before expiry (J−7) and a "Comment renouveler" panel: RIB, Konnect link, WhatsApp +216 98 158 160. Show "Abonnement payé jusqu'au …" in Settings. | `src/components/layout/AppShell.tsx`, `src/auth/AuthContext.tsx`, `src/i18n/fr.ts`, `src/i18n/ar.ts`, `src/features/settings/` |
| Soon | A public conditions page (/conditions) with the plan terms of 5.1 and 3.5, linked from the pricing section | `src/features/landing/` and the router |
| Later | Keep dashboard reads flat as history grows: bound `usePurchases()` and `useAllCreditEntries()` by the selected period | `src/features/purchases/usePurchases.ts`, `src/features/customers/useCustomers.ts`, `src/features/dashboard/DashboardPage.tsx` |
| Later | Device ("poste") registry so the extra-till add-on is visible to the back office (count, not block) | `src/lib/` (new), `cli/lib.mjs` |
| Later | Send a tracking event when a visitor clicks a pricing plan's "Choisir" (the `wa.plan` WhatsApp message), so CAC per plan can be measured. Coordinate with the analytics/GTM workstream. | `src/features/landing/LandingPage.tsx` |

---

## 8. Sources

All accessed 15 October 2026 unless stated. Retail prices change daily; re-check before printing a tariff sheet.

| # | Source |
| --- | --- |
| B1 | Tunisianet, douchettes category (A9 99 DT, A8 139 DT, Honeywell 1960 599 DT): https://www.tunisianet.com.tn/344-douchettes |
| B2 | Tunisianet, A8 wireless 1D/2D scanner, 139 DT TTC, 1-year warranty: https://www.tunisianet.com.tn/douchettes/87452-douchette-code-a-barre-a8-1d-2d-qr-wireless-barcode-scan.html |
| B3 | Spacenet, Honeywell Voyager 1400g, 219 DT TTC: https://spacenet.tn/douchette/99816-douchette-code-a-barres-honeywell-voyager-1400g-noir.html |
| B4 | Spacenet, YHD-1100LW, 119 DT TTC (search-result snippet, "arriving"): https://spacenet.tn/douchette/91280-douchette-yhd-1100lw-noir.html |
| B5 | Primini, wireless scanners: CY8220 (109 DT): https://primini.tn/prix/171435/lecteur-code-a-barre-sans-fil-1d-2d-noir-cy8220 ; Honeywell 1602g (499–549 DT): https://primini.tn/prix/57631/lecteur-code-a-barre-honeywell-1d-sans-fil-bluetooth-1602g1d-2usb-os ; Mytek scanners category (not machine-readable, HTTP 403): https://www.mytek.tn/bureautique/materiel-point-de-vente/douchette.html |
| B6 | Primini, RP79 80 mm USB printer: QSNET 214, **Mytek 229**, Tunisianet 229 DT (updated 13–14 Oct 2026): https://primini.tn/prix/188063/imprimante-thermique-de-tickets-rp79-usb-noir |
| B7 | Spacenet, ZKTeco ZKP8016 (USB/serial/Ethernet, auto-cut), 225 DT TTC, arriving: https://spacenet.tn/imprimante-thermique/103869-imprimante-thermique-de-tickets-zkteco-zkp8016-noir.html |
| B8 | Spacenet, Xprinter T80A, 225 DT TTC (was 299): https://spacenet.tn/imprimante-thermique/60199-imprimante-pointe-de-vente-thermique-t80a-noir.html |
| B9 | Tunisianet, SPRT SP-POS8811A (USB+Ethernet, auto-cutter), 329 DT TTC, in stock: https://www.tunisianet.com.tn/imprimante-professionnelle/97857-imprimante-de-ticket-sprt-sp-pos8811a.html |
| B10 | Tunisianet, Epson TM-T20X Ethernet, 359 DT TTC (search-result snippet): https://www.tunisianet.com.tn/imprimante-professionnelle/50713-imprimante-de-ticket-thermique-epson-tm-t20x-052-ethernet-noir.html |
| B11 | Thermal rolls 80×70: Spacenet 3.700 DT: https://spacenet.tn/papier-thermique/56434-rouleau-de-papier-thermique-80-x-70-mm-a1-48g.html ; Tunisianet 3.450 DT: https://www.tunisianet.com.tn/adaptables/22896-rouleau-papier-thermique-80mm70mm.html |
| B12 | Spacenet, Honeywell IHR810X 80 mm printer, 699 DT (search-result snippet): https://spacenet.tn/imprimante-thermique/98838-imprimante-thermique-pour-tickets-honeywell-gris.html |
| B13 | Google Cloud, Firestore pricing (Standard edition, Paris europe-west9; free quota; egress): https://cloud.google.com/firestore/pricing |
| B14 | Firebase, Understand Cloud Firestore billing (listeners, 30-minute rule): https://firebase.google.com/docs/firestore/pricing |
| B15 | Firebase pricing (Auth "No-cost up to 50K MAUs"; quotas apply at project level): https://firebase.google.com/pricing |
| B16 | Netlify pricing: https://www.netlify.com/pricing/ ; credit-based plans (Free = hard limit; 15 credits/deploy; 20 credits/GB): https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ |
| B17 | OVHcloud Tunisia, .tn domain (8.190 DT HT first year; 12 DT HT renewal; eligibility): https://www.ovhcloud.com/fr-tn/domains/tld/tn/ |
| B18 | Banque Centrale de Tunisie, interbank rates (13/10/2026: USD 3.0071, EUR 3.3637): https://www.bct.gov.tn/bct/siteprod/cours.jsp |
| B19 | Konnect pricing (1.3% national cards and e-Dinar, 2.9% international, 2 TND per transfer, no setup or subscription): https://konnect.network/pricing |
| B20 | Flouci pricing (1.3% HT national cards and wallets, 3% HT international, no setup fee): https://fr.flouci.com/pricing/virtual-offer |
| B21 | Kolonell, 7 Oct 2026, online payment in Tunisia, ClicToPay vs Konnect (indicative ranges; agency article): https://kolonell.com/fr/blog/paiement-en-ligne-ecommerce-tunisie-clictopay-konnect-comparatif-2026 |
| B22 | D17 / e-Dinar: Idaraty procedure: https://idaraty.tn/fr/procedures/obtention-de-la-carte-d17-la-poste ; Webdo, free e-Dinar wallet: https://www.webdo.tn/fr/actualite/national/la-poste-tunisienne-lance-le-wallet-e-dinar-gratuit-pour-ces-services/379737/ |
| B23 | Cheque law 2024-41 and TuniChèque (in force 2 Feb 2025): Webdo: https://www.webdo.tn/fr/actualite/national/tunisie-la-nouvelle-loi-sur-les-cheques-entre-en-vigueur-tout-ce-qu-il-faut-savoir/219538/ ; Kapitalis: https://kapitalis.com/tunisie/?p=15395982 |
| B24 | PwC Tax Summaries, Tunisia, other taxes (VAT 19/13/7%; stamp duty 1 DT per invoice): https://taxsummaries.pwc.com/tunisia/corporate/other-taxes |
| B25 | PwC, Tunisia, corporate income tax (20% general rate; minimum tax 0.2%, minimum 500 DT): https://taxsummaries.pwc.com/tunisia/corporate/taxes-on-corporate-income ; Kapitalis, 20 Dec 2024 (IS 15%→20%, profits from 1 Jan 2024): https://kapitalis.com/tunisie/2024/12/20/tunisie-la-hausse-de-limpot-sur-les-societes-entrave-linvestissement/ |
| B26 | PwC, Tunisia, personal income tax scale from 1 Jan 2025 and the solidarity contribution: https://taxsummaries.pwc.com/tunisia/individual/taxes-on-personal-income |
| B27 | PwC, Tunisia, withholding taxes (1.5% on payments ≥ 1,000 DT TTC; fees 10%/3%): https://taxsummaries.pwc.com/tunisia/corporate/withholding-taxes |
| B28 | Auto-entrepreneur regime: Beancount guide, 26 Sept 2026 (promotional; 75k ceiling, VAT exemption, ~20 DT/month social): https://beancount.io/fr/blog/2026/09/26/tunisia-auto-entrepreneur-flat-tax-freelance-platform-guide ; FES (0.5% + 7.5% social): https://mena.fes.de/blog/e/informal-work-and-auto-entrepreneurship-laws-in-the-maghreb-what-can-tunisia-learn-from-morocco-1 ; BDO Tunisie note, July 2020: https://admin.leaders.com.tn/uploads/FCK_files/BDO%20Tunisie%20-%20Le%20r%C3%A9gime%20de%20l'autoentrepreneur%2006%2007%202020.pdf |
| B29 | Startup Act: Deloitte Avocats, Tunisia tax briefs: https://blog.avocats.deloitte.fr/tunisie-breves-fiscales-juridiques/ ; Managers.tn, the law in 13 points (2017; technology-card ceiling 10k→100k DT, to verify): https://managers.tn/2017/04/12/startup-act-la-loi-sur-les-startup-en-13-points ; official portal: https://startup.gov.tn |
| B30 | WordStream, Facebook ads benchmarks 2025 (global, not Tunisia): https://www.wordstream.com/blog/facebook-ads-benchmarks-2025 |
| — | Competitor prices (Gastevo, Hesabi, Swiver, SharPOS, Tassaruf…): see `docs/launch/01-market-research.md`, section 2.2 and sources S23–S37 |
| — | Repo: `src/features/landing/copy.ts` (current prices), `cli/lib.mjs` (`shops:create`, `plan:set`, `plan:extend`, `shops:suspend`, `shops:resume`, `RULES_GRACE_MS`), `firestore.rules` (`paid()`, `graceMs()`), `src/auth/AuthContext.tsx` (`isLapsed`, `isBlocked`), `src/lib/liveCollection.ts`, `src/features/sales/useSales.ts`, `src/features/dashboard/periods.ts`, `SAAS.md` |

**Searched for but not found:**

- Mytek prices read directly (blocked; Primini used instead).
- Any scanner or printer listing on Wiki.tn or SBS.
- A published D17 merchant fee.
- The official current carte technologique ceiling.
- An official, consistent auto-entrepreneur income-tax rate (sources conflict).
- Tunisia-specific Meta or Google Ads cost benchmarks.
- What Netlify does to a site at the Free credit limit (assumed paused).

**Model:** the projection was computed with a small script, not included in the repo. Its inputs are exactly those in 4.1, so anyone can rebuild it in a spreadsheet.
