# 08 — Pricing v2: priced on what it really costs

The founder's real hardware cost is **250 DT for the scanner + 250 DT for the
ticket printer = 500 DT per kit**. The previous grid sold the kit plus the
installation for 500 DT, i.e. the installation day was free and the hardware
had no margin; the launch promo (half-price setup) even lost 250 DT per shop.
This grid separates the three things a shop pays for.

All numbers live in one place: `PRICES` in `src/features/landing/copy.ts`
(the page, the CGV and the Google data follow automatically).

## The grid

| | Price | What it pays for |
| --- | ---: | --- |
| **Mensuel** | **99 DT / month**, no commitment, 1st month free | servers, updates, WhatsApp support |
| **Annuel** (recommended) | **990 DT / year** (= 10 months, 2 free → 82.5 DT/month) | same, paid upfront |
| **À vie — Fondateurs** | **4 400 DT once**, kit + installation included, 24 months support, 20 licences | ≈ 3.5 years of subscription after the kit |
| **Installation** | **290 DT** | ≈ 1 day: install on site, train the team, load the stock |
| **Kit matériel** (optional) | **590 DT** | cost 500 + 90 for transport, configuration, a spare/return |
| **Extra till** | **+25 DT / month** | |
| **Maintenance after lifetime support** | **290 DT / year**, optional | |

**Launch offer (until 20 Dec 2026):** installation offered (290 DT) with the
annual plan. The kit is never discounted, so no offer can lose money on hardware.

## What a shop pays (with kit, without promo)

| Horizon | Mensuel | Annuel | À vie |
| --- | ---: | ---: | ---: |
| 1 year | 1 969 | 1 870 | 4 400 |
| 2 years | 3 157 | 2 860 | 4 400 |
| 3 years | 4 345 | 3 850 | 4 400 (+290 maintenance if wanted) |
| 4 years | 5 533 | 4 840 | 4 400 (+580) |
| 5 years | 6 721 | 5 830 | 4 400 (+870) |

Annual is cheaper than monthly from year 1; lifetime becomes the cheapest
from year 4. A shop that keeps its own hardware pays 590 DT less on monthly
and annual.

## What Mektebti keeps (estimates)

- **Servers** (Firestore europe-west9 + Netlify + domain): about **1–5 DT per
  shop per month** (doc 03 §2.2). Budget 5 DT.
- **Per subscribed shop:** 99 − 5 servers ≈ **94 DT/month** for support and
  profit (annual: 82.5 − 5 ≈ 77).
- **Per new shop on day one:** installation 290 (your day of work) + kit
  margin 90 → the first visit is paid, whatever plan is chosen.
- **Break-even:**
  - ads + tools ≈ 800 DT/month → about **9 paying shops**;
  - also paying two founders 1 500 DT each → about **41 shops**.

## To decide

1. **Existing clients:** keep the 2 current clients on their old price
   (83 DT): it costs little and protects the relationship.
2. **Tax status:**
   - if Mektebti charges VAT, these prices are TTC (99 TTC = 83.19 HT);
   - as an auto-entrepreneur, write "TVA non applicable" on invoices.
3. **The 20 December offer:** can be replaced by "installation offerte avant
   la rentrée" from February to June.
