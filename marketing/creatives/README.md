# Mektebti.tn ad creatives (Meta + Google Display)

These are paid-ads creatives for **Mektebti.tn**, the point-of-sale and management app for librairies and papeteries in Tunisia. Each concept comes in French and Tunisian Arabic (derja).

- The logo is never redrawn. Every image places the original `public/brand/logo-on-light.png`, unchanged, on a white chip. The chip is shown at 250 to 300 px wide, which is below the 510 px source width, so the logo is never upscaled.
- Colors are the brand palette from `src/theme.ts`: ultramarine `#1800AC` / `#2A12CF`, amber `#FFAD20` and ink `#0B0A1F`. WhatsApp green (`#25D366`) is used only on the contact icon.
- Fonts are Inter (FR) and Cairo (AR). Both are SIL OFL and ship in `src/fonts/` together with their licences.
- Every image is rendered from HTML/CSS/SVG with Playwright/Chromium and saved as a 256-colour palette PNG. The total is 47 files, about 6 MB. The largest file is 220 KB, and every Google file is 180 KB or less.
- The data shown inside the images is made up for illustration: client names, amounts, ticket lines and the EAN-13 barcode (Tunisian prefix 619). It is not a real customer record.

## 1. Meta (Facebook + Instagram): 6 concepts × 3 sizes × FR/AR = 36 files

| Size | Placement | Notes |
|---|---|---|
| `1080x1080` | Feed 1:1 (the size requested in the brief) | WhatsApp CTA band at the bottom |
| `1080x1350` | Feed 4:5 | Meta now recommends 4:5 for Feed ([Meta ads guide, Facebook Feed](https://www.facebook.com/business/ads-guide/update/image/facebook-feed)). It takes up more of the screen. Use it as the default for Feed. |
| `1080x1920` | Stories + Reels cover / 9:16 | Logo, headline, offer, fine print and WhatsApp CTA all sit between y 270 and y 1248. That keeps the top 14 %, the bottom 35 % and 6 % on each side free, as Meta's 9:16 guidance asks ([Meta ads guide, Instagram Stories](https://www.facebook.com/business/ads-guide/update/image/instagram-story)). Only the illustration runs below. |

Files are in `meta/fr/` and `meta/ar/`, named `<concept>_<size>.png`.

| # | Files (in `meta/fr/` and `meta/ar/`) | Concept and angle | Text on the image FR / AR |
|---|---|---|---|
| 01 | `01-bip-scanner_1080x1080.png`, `_1080x1350.png`, `_1080x1920.png` | Scanner speed at the till: barcode with laser, "BIP!" burst, 80 mm ticket | **Bip, c'est vendu.** / **بيب، تباعت!** |
| 02 | `02-fini-cahier-credit_…` (same 3 sizes) | Pain point: the paper credit notebook gets crossed out and replaced by the in-app customer ledger. Uses the light theme for variety. | **Fini le cahier de crédit.** / **ما عادش كرّاس الكريدي.** |
| 03 | `03-pret-rentree_…` | School packs: one scan puts the whole school list on the bill | **Prêt pour la rentrée ?** / **جاهز للرونتري؟** |
| 04 | `04-sans-internet_…` | Works offline: wifi crossed out, the sale is still recorded. Uses the dark ink theme. | **Internet coupé ? La caisse continue.** / **الإنترنت قصّ؟ الكاسة تكمّل تخدم.** |
| 05 | `05-prix-83dt_…` | Clear pricing: 83 DT/month, first month free, the 500 DT setup fee printed on the image. Uses the amber theme. | **83 DT / mois, 1er mois offert** / **83 د / الشهر، الشهر الأول مجاني** |
| 06 | `06-stock-2-postes_…` | Multi-device: the till and the back office show the same stock, live | **2 postes, 1 seul stock.** / **زوز حواسيب، مخزون واحد.** |

Every image carries the WhatsApp CTA **+216 98 158 160** ("Écrivez-nous sur WhatsApp" / "ابعثلنا على واتساب") and the pill "1er mois offert" / "الشهر الأول مجاني". On 05 the offer is shown next to the price instead.

### Suggested ad copy (Meta)

Meta recommends primary text of 50–150 characters and a headline of about 27 characters ([Meta ads guide](https://www.facebook.com/business/ads-guide/update/image/facebook-feed)). Every headline below is 27 characters or fewer.

| # | Primary text FR | Headline FR | Primary text AR | Headline AR |
|---|---|---|---|---|
| 01 | Scannez, encaissez, le ticket sort tout seul. Mektebti, la caisse pensée pour les librairies et papeteries en Tunisie. 1er mois offert. | Bip, c'est vendu. | سكاني، خلّص، والتيكيت يطلع وحدو. مكتبتي: الكاسة المصنوعة للمكتبات في تونس. الشهر الأول مجاني. | بيب، تباعت! |
| 02 | Le cahier de crédit se perd, se tache, s'oublie. Avec Mektebti, chaque client a son carnet dans la caisse : qui doit quoi, depuis quand. | Fini le cahier de crédit | كرّاس الكريدي يضيع ويتنسى. مع مكتبتي، كل حريف عندو كرّاسو في الكاسة: شكون يتسال، قدّاش، ومن وقتاش. | ما عادش كرّاس الكريدي |
| 03 | Les packs scolaires prêts avant le rush : un scan et toute la liste passe en caisse, au millime près. Préparez la rentrée avec Mektebti. | Prêt pour la rentrée ? | حضّر الباكات المدرسية قبل الزحمة: سكان واحد والقائمة الكل تتعدّى في الكاسة، بالمليم. حضّر الرونتري مع مكتبتي. | جاهز للرونتري؟ |
| 04 | Coupure internet ? Mektebti continue d'encaisser. Vos ventes sont enregistrées et tout se synchronise dès le retour du réseau. | La caisse marche hors ligne | الإنترنت قصّ؟ مكتبتي تكمّل تخلّص الحرفاء وتسجّل البيعات، وكل شي يتحفظ أونلاين كي يرجع الإنترنت. | الكاسة تخدم بلا إنترنت |
| 05 | Caisse, stock, packs scolaires, carnet clients et rentabilité : 83 DT/mois, 1er mois offert. Mise en service 500 DT (scanner + imprimante ticket). | 83 DT/mois, 1er mois offert | كاسة، مخزون، باكات مدرسية، كرّاس الحرفاء والربح: 83 د في الشهر، والشهر الأول مجاني. التركيب 500 د (سكانر + طابعة تيكيت). | 83 د/الشهر، أول شهر مجاني |
| 06 | Caisse au comptoir, bureau à l'arrière : Mektebti affiche le même stock sur vos 2 postes, en direct. | 2 postes, 1 seul stock (alternative: Votre stock en direct sur 2 postes) | الكاسة قدّام والبيرو لتالي: مكتبتي تورّيك نفس المخزون على الزوز حواسيب، مباشرة. | زوز حواسيب، مخزون واحد |

How to set up the ads:

- **CTA button.** Use "Send WhatsApp message" (Click-to-WhatsApp) with the prefilled text from the landing page: `Bonjour, je veux essayer Mektebti pour ma librairie.` / `السلام، نحب نجرّب مكتبتي للمكتبة متاعي.` The WhatsApp number has to be connected to the Facebook Page first; check this in Ads Manager before you launch.
- **Website variant.** Use "Learn more" pointing to `https://libsystem-tn.netlify.app/decouvrir?utm_source=meta&utm_medium=paid_social&utm_campaign=launch&utm_content=<file name without .png>`, for example `utm_content=01-bip-scanner_1080x1350_fr`.
- **Language targeting.** Run FR and AR as separate ad sets, or as one ad set with Meta's multiple-languages option. Always pair an AR image with AR copy.

## 2. Google Display: concept 01 "Bip, c'est vendu", 11 files

Concept 01 is the strongest for Display. Display placements are small and get little attention, so they need one instantly readable idea. A barcode with a red laser plus a ticket says "till for shops" without any reading, and the 2-word hook stays readable at 300×250. Concept 05 converts better on intent, but it needs the fine print, so it belongs on Meta and Search.

| File | Use |
|---|---|
| `google-display/01-bip-scanner_300x250_fr.png`, `…_300x250_ar.png` | Uploaded image ad (inline rectangle). Uploaded image ads must be GIF/JPG/PNG and at most 150 KB, and 300×250 is a supported size ([Google Ads help 1722096](https://support.google.com/google-ads/answer/1722096)). These files are about 20 KB. |
| `google-display/01-bip-scanner_1200x628_fr.png`, `…_ar.png` | 1.91:1 with headline, button and WhatsApp. Use in Demand Gen / Performance Max, or as a responsive-display image if you accept the text overlay. |
| `google-display/01-bip-scanner_1200x1200_fr.png`, `…_ar.png` | 1:1 version of the same, built from the feed layout. |
| `google-display/01-bip-scanner_1200x628-clean_fr.png`, `…_ar.png` | **Recommended for Responsive Display Ads.** Illustration only, with no text, logo or button overlay. Google advises against overlaying text, logos or buttons on RDA images ([Google Ads help 9823397](https://support.google.com/google-ads/answer/9823397)). |
| `google-display/01-bip-scanner_1200x1200-clean_fr.png`, `…_ar.png` | Square RDA image, clean. |
| `google-display/logo-landscape_512x128.png` | 4:1 RDA logo at exactly the 512×128 minimum, made from the original PNG without upscaling. For the 1:1 logo, use `public/brand/icon-512.png` (minimum 128×128). Specs: [Google Ads help 17090561](https://support.google.com/google-ads/answer/17090561). A 1200×300 / 1200×1200 logo needs a vector or high-resolution master of the logo, which the repo does not have. |

Google 9823397 also notes that Display campaigns are moving to Demand Gen, with voluntary migration from June 2026. The 1.91:1 and 1:1 images work there too.

### RDA text assets

Limits: headline ≤ 30, long headline ≤ 90, description ≤ 90, business name ≤ 25 ([Google Ads help 17090561](https://support.google.com/google-ads/answer/17090561)). Every line below has been counted against these limits.

| Asset | FR | AR |
|---|---|---|
| Headlines | Bip, c'est vendu. · La caisse des librairies · 1er mois offert · Marche sans internet · Fini le cahier de crédit | بيب، تباعت! · كاسة المكتبات في تونس · الشهر الأول مجاني · تخدم بلا إنترنت · ما عادش كرّاس الكريدي |
| Long headline | Mektebti : la caisse au scanner pensée pour les librairies et papeteries en Tunisie | مكتبتي: كاسة بالسكانر مصنوعة للمكتبات في تونس، تخدم حتى بلا إنترنت |
| Descriptions | Caisse au scanner, stock, packs scolaires et carnet clients. Même sans internet. · 83 DT/mois, 1er mois offert. Mise en service 500 DT : scanner + imprimante ticket. | كاسة بالسكانر، مخزون، باكات مدرسية وكرّاس الحرفاء. حتى بلا إنترنت. · 83 د في الشهر، الشهر الأول مجاني. التركيب 500 د: سكانر + طابعة تيكيت. |
| Business name | Mektebti.tn | Mektebti.tn |
| Final URL | `https://libsystem-tn.netlify.app/decouvrir?utm_source=google&utm_medium=display&utm_campaign=launch` | same |

## 3. Things to check before spending

1. **Price honesty.** Any ad that says "83 DT" must also show the 500 DT setup fee. The image for 05 shows it, and the copy for 05 and the Google description include it. Do not shorten them.
2. **Setup fee when the shop already owns hardware.** The plan says a shop may already have the scanner or printer. If those shops pay less than 500 DT, change `fine` in `src/copy.mjs` (for example "si besoin") and re-render.
3. **Annual plan.** Do not advertise the annual plan until its price is fixed. At 2000 DT it costs more in year 1 than monthly (500 + 11 × 83 = 1413 DT).
4. **"1er mois offert"** appears on every image. The landing page and the onboarding must honour it.
5. **Timing of concept 03.** The school year starts in September and today is October 2026, so concept 03 is out of season. Pause it now and schedule it for the pre-rentrée window, July to September. For an evergreen version, change `kicker`/`h1` to "Packs scolaires en 1 scan".
6. **"2 postes".** Concept 06 says 2 devices. If the plans allow more than 2 devices, consider "plusieurs postes".
7. **Testing plan.** Launch 01, 02 and 05 first, in 4:5 + 9:16, with one ad set for FR and one for AR. Keep the winner, then rotate 04 and 06 in about every 2 weeks to fight creative fatigue. This is a suggestion, not a benchmark.

## 4. Rebuild or edit

All on-image words live in `src/copy.mjs`. Layout, visuals and CSS live in `src/build.mjs`.

```bash
# full rebuild (47 files)
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
CHROMIUM_PATH=/path/to/chromium \
SHARP_MODULE=/path/to/node_modules/sharp \
node marketing/creatives/src/build.mjs

# filters (all must match): concept id, lang, format or size
node marketing/creatives/src/build.mjs 05 ar story
node marketing/creatives/src/build.mjs display
DEBUG_SAFE=1 node marketing/creatives/src/build.mjs story   # red overlay on the Meta 9:16 unsafe zones (review only)
```

`sharp` is optional and is not a project dependency. It palette-quantizes the PNGs, which makes them much smaller. Without it the PNGs are written as-is. Headlines auto-fit to their line width and the illustrations auto-scale to the space left. The Arabic version mirrors itself through `dir="rtl"`, while barcodes, phone numbers and quantities stay left-to-right.
