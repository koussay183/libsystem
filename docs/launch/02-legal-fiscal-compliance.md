# 02 — Legal, tax and data-protection compliance (Tunisia)

> **Read this first.** This is a compliance research brief written for the founder of
> Mektebti.tn on **15 October 2026**. It is **not legal or tax advice**. Every rule below
> comes with its source, and each one is tagged:
>
> - **[Texte]**: read in a primary or consolidated legal text.
> - **[Secondaire]**: from a Big-4, press or professional summary.
> - **[À confirmer]**: sources disagree, or the text may have changed after the
>   consolidated version we read.
>
> Before you put any of this in front of a client, have a **Tunisian lawyer** check the
> templates in §6 and an **expert-comptable** check §1, §2 and §4. Finance laws change
> every January, and the consolidated VAT code we read is the January 2022 edition. Have
> the LF 2023 to LF 2026 changes checked.

---

## 0. TL;DR: what matters for "ready to sell tomorrow"

1. **Selling tomorrow is fine.** Nothing here blocks two more shops from signing next
   week. But **four things need to be in place before you advertise publicly** (Google and
   Meta ads):
   - a legal entity that can issue proper invoices;
   - mentions légales, CGV and privacy pages on the landing page;
   - a cookie-consent gate in front of GA4, Google Ads and Meta Pixel;
   - no "FACTURE" printed on documents that are not legal invoices (see §7, gap G1).
2. **Bookshops are not covered by the mandatory cash-register (caisse enregistreuse)
   rollout** as of today. It covers on-site food and drink (restaurants, cafés, salons de
   thé) only. **Do not claim "caisse homologuée"** anywhere. [Secondaire, §3]
3. **Bookshops selling goods at retail are not covered by mandatory e-invoicing (El
   Fatoora / TTN).** **Mektebti itself, as a VAT-registered service provider, might be**
   (LF 2026 art. 53). Parliament voted in committee in April 2026 to suspend that
   extension, so the status must be confirmed with the accountant. [Secondaire, §2]
4. **Many of your clients are probably not VAT-registered.** A retailer reselling goods is
   inside the VAT scope only if its annual turnover is **≥ 100,000 DT**, and the
   *forfaitaire* regime is common. **A shop that prints VAT on an invoice owes that VAT**,
   even if it is not registered. So the app must know the shop's tax regime before it
   prints any VAT line. [Texte, Code TVA art. 1-II-11 and art. 2-I-2]
5. **The VAT rates that matter in a librairie-papeterie:**
   - **books are VAT-exempt** (except leather-bound ones);
   - **numbered school exercise books** (12/24/48/72 pages, plus TP, dessin, récitation and
     musique exercise books) are at **7%**;
   - most other stationery is at **19%**.

   [Texte, Code TVA Tableau A n°18, Tableau B n°12 bis, art. 7]
6. **A legal invoice needs:**
   - an **uninterrupted number series**;
   - the seller's **matricule fiscal**;
   - the client's identity and address, plus the client's MF when the client is a
     registered business;
   - each item with its **price excluding VAT (HT)**;
   - the **VAT rate and VAT amount**;
   - a **1.000 DT timbre fiscal** per invoice.

   **The amount written out in words is not required** by article 18. It is customary, and
   worth doing. [Texte, Code TVA art. 18; CDET art. 117]
7. **The app is not invoice-compliant yet.** Five problems, detailed in §7:
   - it prints "FACTURE" on any A4 ticket;
   - ticket numbers are timestamp plus random suffix, not sequential;
   - sales store no VAT;
   - the client has no address or MF;
   - a voided sale is **hard-deleted**.
8. **Data protection: Loi organique 2004-63 is strict on paper.**
   - Declaration to the INPDP before processing.
   - **INPDP authorisation for every transfer abroad**, and Firestore is in Paris.
   - Specific consent for any advertising use.
   - Breaches are criminal offences (for example 1 year and 5,000 DT for processing
     without a declaration, or transferring abroad without authorisation).

   [Texte, art. 7, 30, 52, 90]
9. **On the landing page, treat GA4, Google Ads and Meta Pixel as personal-data processing.**
   No Tunisian cookie-specific rule was found, but the processing is advertising (art. 30)
   and sends data to the US (art. 52). Use **opt-in consent with Consent Mode v2 in
   "denied" by default**, and **never load marketing tags inside the logged-in app.**
10. **On the founder side, the decisions only you can make are:**
    - the legal form (auto-entrepreneur, SUARL or SARL), plus the **Startup Act label**
      (corporate-tax exemption, and the State pays the social contributions during the
      label);
    - whether prices are quoted **TTC** (VAT included) or HT;
    - whether hardware is **sold** to the shop or **lent** to it;
    - what "lifetime" means in the lifetime plan.

    See §4 and §8.

---

## 1. What a bookshop's ticket and invoice must contain, and how the app should do it

### 1.1 First question: what is the shop's tax regime?

Everything downstream depends on this, so it must become a shop setting.

| Situation | What it means | Source |
|---|---|---|
| Retailer reselling goods as-is with **annual turnover < 100,000 DT** | Outside the VAT scope for those sales, unless it opts in. No VAT is invoiced. | Code TVA art. 1-II-11: VAT applies to *"la vente des produits en l'état par les commerçants détaillants qui réalisent un chiffre d'affaires annuel global égal ou supérieur à 100000 dinars"* [Texte] |
| Retailer at **≥ 100,000 DT**, or one that opted in, on the *régime réel* | VAT-registered (*assujetti*). Full invoice obligations (art. 18). Monthly VAT return. | Code TVA art. 2, art. 18-II and art. 18-IV [Texte] |
| **Régime forfaitaire** | Exempt from art. 18-II invoice obligations (*"autres que ceux soumis au régime forfaitaire"*). LF 2026 art. 91 added an **optional flat tax** for individuals with BIC turnover ≤ 100,000 DT (4,000 DT/yr up to 50 kDT and 5,000 DT/yr from 50 to 100 kDT, halved in rural zones). It excludes importers and wholesalers. | Code TVA art. 18-II [Texte]; [Tunisie Numérique on LF 2026 forfait optionnel](https://www.tunisienumerique.com/tunisie-forfait-optionnel-bic-comment-fonctionne-t-il/) [Secondaire] |
| Shop that **prints VAT on a document** even though it is not registered | **It owes the VAT it printed.** | Code TVA art. 2-I-2: *"Mentionnent la taxe sur la valeur ajoutée sur leurs factures… du seul fait de sa facturation"* [Texte] |

**What this means for the product:**
- Add a **"Régime fiscal"** setting with three values: *Non assujetti / forfaitaire*,
  *Assujetti TVA (réel)* and *Assujetti partiel*.
- For non-registered shops, the app must **never print a VAT line**.
- The 2nd segment of the matricule fiscal (*code TVA*: A, P, B, D or N) indicates the VAT
  status. Use it to suggest the setting, but let the owner confirm. MF structure:
  `NNNNNNN` + check letter (not I, O or U) / code TVA / category code (M, P, C, N or E) /
  3-digit establishment number. A non-`000` establishment number implies category `E`.
  ([python-stdnum `tn.mf`](https://arthurdejong.org/python-stdnum/doc/stdnum.tn.mf)
  [Secondaire])

### 1.2 VAT rates a librairie-papeterie actually meets

Source: Code TVA consolidated to 2022, Tableaux A and B, art. 7
([PDF](https://chaexpert.com/documents/Code%20de%20la%20taxe%20sur%20la%20valeur%20ajout%C3%A9e%202022.pdf)),
tagged [Texte]. Later finance laws must be checked [À confirmer].

| Product family | Rate | Legal basis |
|---|---|---|
| **Books, brochures and similar printed matter**, except books bound in natural, artificial or reconstituted leather | **Exempt (0%)** | Tableau A, I, n°18 |
| Newspapers, periodicals and e-newspapers (advertising excluded) | Exempt | Tableau A, I, n°18 |
| **School exercise books numbered 12, 24, 48 and 72**, and TP, dessin, récitation and musique exercise books (customs heading 482020000) | **7%** | Tableau B, I, n°12 bis (added by LF 2017) |
| Data-processing machines (customs heading 84.71) and their parts (84.73) | 7% | Tableau B, I, n°2 bis. **Possibly** relevant to barcode readers, depending on their customs classification [À confirmer] |
| Everything else: pens, bags, files, paper, art supplies, photocopy and printing services, the SaaS subscription | **19%** (default rate) | Art. 7: *"au taux de 19%, les opérations portant sur les biens et les services non soumis à un autre taux"* |
| Products under **administrative price approval** (*homologation administrative des prix*), sold by a retailer | Exempt at retail | Art. 1-II-11, last paragraph. Relevant if any subsidised or price-controlled school item is sold [À confirmer which items] |

**Consequences:**
- A VAT-registered bookshop sells both exempt items (books) and taxable ones (stationery).
  It is therefore a **partial taxpayer** (*assujetti partiel*), and its input-VAT deduction
  is pro-rated (Code TVA art. 9-II) [Texte].
- The app must store a **sale VAT rate per product**, separate from the purchase VAT it
  already stores (`Product.vatRate` is documented as purchase VAT only). It must also
  produce turnover **split by rate**.

### 1.3 Mandatory content of an invoice (*facture*)

Source: **Code TVA art. 18-II and 18-III** [Texte], confirmed by
[KPMG Tunisie, Circulaire fiscale n°2, Feb 2026](https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf)
and [Tuniscope, 23 Jan 2026](https://www.tuniscope.com/article/423074/business/economie/facturation-electronique-132422).

| Mention | Rule |
|---|---|
| Date of the operation | Mandatory |
| Client identity and address | Mandatory |
| Client's **matricule fiscal** | Mandatory **when the client is subject to the *déclaration d'existence*** (CIRPP/IS art. 56), i.e. any business |
| Seller's **matricule fiscal** (*carte d'identification fiscale*) | Mandatory |
| Designation of the goods or service and **price excluding VAT (HT)** | Mandatory |
| **VAT rates and VAT amounts** | Mandatory (for a VAT-registered seller) |
| VAT **suspended** (sales under a suspension attestation) | Mandatory where applicable, with a quarterly list to the tax office |
| **Numbering in an uninterrupted series** | Mandatory: *"d'utiliser des factures numérotées dans une série ininterrompue"* (art. 18-III-1) |
| **Timbre fiscal** | **1.000 DT per invoice** (CDET art. 117, 6°; see §1.5) |
| Amount written out in words (*"Arrêtée la présente facture à la somme de…"*) | **Not in art. 18.** Customary and expected by many accountants. Recommended, but optional. |
| Signature and stamp (*cachet*) | Not in art. 18 for paper invoices. Required on **paper copies of e-invoices** (art. 18-II ter). Customary. |

**What happens if a mention is missing:**
- The **buyer cannot deduct the VAT** (Code TVA art. 9-I-2-a requires invoices
  *"établies dans les conditions fixées à l'article 18"*) [Texte].
- **Failing to issue an invoice, or issuing one with understated amounts:** fines of
  **1,000 to 50,000 DT** and possible imprisonment, under Code des droits et procédures
  fiscaux (CDPF) art. 94
  ([Managers, 30 Jun 2026](https://managers.tn/2026/06/30/caisse-enregistreuse-obligatoire-ce-que-prevoit-la-loi-en-cas-de-non-respect/))
  [Secondaire; check the amounts against the CDPF text].

### 1.4 Ticket or invoice: what a retailer must hand out

Source: Code TVA art. 18-II, retailer paragraphs [Texte].

- A VAT-registered retailer must issue a **full invoice** for every sale to the State,
  public bodies, VAT-registered businesses, companies, and individuals taxed on business
  (BIC) or professional (BNC) income. It must also issue one **to anyone who asks**.
- For all other sales, the ones to private individuals, **the retailer must issue one daily
  "facture globale"** (*"le commerçant détaillant est tenu quotidiennement d'établir une
  facture globale"*).
- A retailer that **does not keep full accounts** must keep a **day-by-day register**
  (*livre côté et paraphé*) of:
  - purchases for resale, with the HT price, VAT rate and VAT amount of each operation;
  - daily turnover covered by invoices;
  - daily turnover covered by the global invoices, *"sur la base de l'arrêté de caisse"*;
  - year-end stock.
- The **thermal ticket itself has no statutory content list** for a small retailer. We did
  not find any text imposing one. The ticket stamp duty (100 millimes per ticket) applies
  **only** to big-box stores, multi-department stores managed by the large or medium
  taxpayer offices (DGE / DME), and foreign-brand franchises (CDET art. 117, 10°, added by
  LF 2022). **It does not apply to a neighbourhood bookshop.** [Texte]

**Product opportunity, a strong selling point:** Mektebti can generate the daily
*facture globale* automatically at the *clôture de caisse*, split by VAT rate. It can also
export the four registers above as CSV or PDF for the accountant. No competitor pitch we
know of says "votre registre fiscal journalier, prêt pour le comptable."

### 1.5 Timbre fiscal on invoices

Source: Code des droits d'enregistrement et de timbre (CDET), consolidated to 1 Jan 2025
([PDF](https://chaexpert.com/documents/Code-des-Droits-dEnregistrement-et-de-Timbre-2025-Fr.pdf)),
tagged [Texte].

- **Art. 117, 6°: "Les factures…": 1.000 DT per invoice.** Telephone and internet invoices
  follow a different rule.
- It is due **at the moment the invoice is issued** (*"à l'émission pour les factures"*).
- Exempt cases include export invoices (art. 118, n°29) and invoices supporting State
  payment orders (n°19).
- **Companies subject to corporate tax must pay the invoice stamp duty by declaration**
  (art. 124). Each invoice must then carry the words *"droit de timbre payé sur
  déclaration"* (art. 127). Individuals can apply for the same arrangement.
- In practice the 1.000 DT appears as its own line, **"Timbre fiscal: 1,000"**, added to the
  amount due. It is **not** a VAT base.
- **App:** add a "Timbre fiscal sur factures" toggle in settings, defaulting to 1.000 DT.
  Print it **only on invoices**, never on tickets, and add the art. 127 wording when
  "payé sur déclaration" is ticked. **[À confirmer]** whether a non-registered (forfaitaire)
  shop issuing an occasional invoice also adds it. Art. 117 is not limited to
  VAT-registered issuers, so our default is **yes**.

### 1.6 Retention

Keep invoices, tickets and accounting records for **10 years**. The basis is loi 96-112 on
the business accounting system, plus former CIR art. 62, as cited in
[this academic summary](https://www.memoireonline.com/02/08/887/m_la-preuve-en-droit-fiscal34.html)
[Secondaire; one 2026 blog says 5 years, so **use 10**].

**App consequences:**
- Sales must **never be hard-deleted**.
- The **export and backup** feature must stay readable for 10 years after a shop
  cancels. Put this in the CGV.

### 1.7 What the app should print

**A. Thermal ticket (80 mm). Recommended layout:**
```
<Nom commercial>             (+ raison sociale if different)
<Adresse> · Tél <…>
MF : 1234567X/A/M/000
--------------------------------
TICKET N° C1-2026-004812          <- per-device uninterrupted series
15/10/2026 10:42 · Caisse 1
--------------------------------
Cahier 96p            2 x 1,200   2,400  B
Roman "…"             1 x 18,500 18,500  E
Stylo bleu            3 x 0,800   2,400  A
--------------------------------
TOTAL TTC                       23,300
Espèces 25,000 · Rendu 1,700
[réel only]  A=19% B=7% E=exonéré
             Base HT / TVA par taux …
Facture sur demande.
Merci et à bientôt !
```
For a non-registered shop, leave out the per-line VAT letter and the VAT summary. Do not
print the word "TVA" at all, because art. 2-I-2 makes the shop liable for any VAT it
prints.

**B. A4 invoice (*facture*). Required blocks:**

1. Seller: *raison sociale*, trade name, address, **full MF**, phone. RNE number is
   optional.
2. "FACTURE N° 2026/000123" (uninterrupted series) and the date.
3. Client: name or *raison sociale*, **address**, **MF** (mandatory for a business client).
4. Lines: Désignation | Qté | **PU HT** | **TVA %** | **Montant HT**.
5. VAT summary by rate: Base HT, TVA. Then Total HT, Total TVA, **Timbre fiscal 1,000**,
   **Net à payer TTC**.
6. Amount in words: "Arrêtée la présente facture à la somme de : vingt-trois dinars et
   trois cents millimes."
7. Payment terms and method. *Cachet et signature.*
8. For forfaitaire shops: no VAT columns. One line of price, the total, and the timbre.
9. **Credit note (*facture d'avoir*)**: "AVOIR N° … annulant (ou rectifiant) la facture
   N° … du …". This is the **only** legal way to correct or cancel an invoice once issued.

**Calculation rules:**
- Prices are stored TTC in millimes (`salePrice`).
- For a VAT-registered shop, compute **HT = TTC / (1 + rate)** per line.
- Round to the millime, and **sum by rate** for the summary.
- Store the **rate, HT and VAT on each `SaleItem` at the time of sale**, never recomputed
  later.

---

## 2. Electronic invoicing (El Fatoora / Tunisie TradeNet)

### 2.1 The framework

| Element | Content | Source |
|---|---|---|
| Legal basis | Code TVA art. 18-II ter; **Décret gouvernemental 2016-1066** of 15 Aug 2016. TTN runs the platform. Format **TEIF**. Qualified e-signature (TunTrust DigiGO, ID-Trust or Entreprise-ID seal). Unique reference from TTN. | Code TVA [Texte]; [KPMG Feb 2026](https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf) |
| Mandatory **before 2026** | (a) Companies under the large-taxpayer office (DGE) invoicing the State, local authorities and public companies. (b) **Sales of medicines and hydrocarbons between professionals, retailers excluded** (LF 2019 art. 46). | Code TVA art. 18-II ter [Texte] |
| **LF 2026 art. 53** (loi n° 2025-17 of 12 Dec 2025) | Extends mandatory e-invoicing to **service providers** (*prestations de services*) from 1 Jan 2026, including professionals who issue fee notes (*notes d'honoraires*). | [KPMG Feb 2026](https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf); [Tuniscope](https://www.tuniscope.com/article/423074/business/economie/facturation-electronique-132422) [Secondaire] |
| Note commune n° 2/2026 | Applies only to providers that **have joined** the network. Those who **have applied** may keep issuing paper invoices. Those with **no proof of an application** risk **100 to 500 DT per non-compliant invoice, capped at 50,000 DT per audit**. Services that are only **accessory to a sale** (delivery, installation) are excluded **unless declared as a secondary activity**. | [KPMG Feb 2026](https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf) [Secondaire, citing the NC] |
| **Parliament, 2026** | A bill to amend art. 53 was filed on 22 to 26 Jan 2026. On **2 Apr 2026** the ARP finance committee **rejected repealing art. 53** but **adopted an amendment suspending its entry into force** until a new timetable is set by law. **We found no confirmation of a plenary vote or a JORT publication.** | [Business News, 2 Apr 2026](https://businessnews.com.tn/2026/04/02/facturation-electronique-la-commission-des-finances-rejette-le-report-mais-propose-un-decalage-de-lapplication/1394884/); [Tunisie Numérique, Jan 2026](https://www.tunisienumerique.com/tunisie-vers-un-amendement-du-cadre-de-la-facturation-electronique-audition-prevue-aujourdhui/) [**À confirmer: current status**] |
| Cost of joining | TTN subscription (fees set by arrêté of 28 Mar 2017). Qualified certificate: DigiGO from **50 DT HT**, ID-Trust **350 DT HT** + 7 DT delivery. Requires a fixed IP or SFTP, or an approved software. | [KPMG Feb 2026](https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf) |

### 2.2 Does it apply to small bookshops (Mektebti's clients)?

**No, in the normal case.** A bookshop sells goods at retail. Goods are only covered in
the DGE-to-State case and in the medicines and hydrocarbons case, which excludes retailers
anyway. Non-registered and forfaitaire shops are outside article 18 altogether.

**Edge case [À confirmer]:** a shop that **declared photocopying or printing as a
secondary activity** in its *déclaration d'existence*, and is VAT-registered, would fall
under the LF 2026 extension for those service invoices, if and when it applies.

**Product:** no TEIF integration is needed for launch. Keep it on the roadmap and design
invoice data so TEIF export is possible: HT, rate, VAT, MF of both parties, sequential
number.

### 2.3 Does it apply to Mektebti, the founder?

**Possibly yes**, if Mektebti invoices as a **VAT-registered service provider** (a SUARL or
SARL selling SaaS).

- **Before the first invoice:** ask the expert-comptable to confirm the current status of
  art. 53.
- **If it is in force:** **file the TTN adhesion request** (the filing receipt protects
  against fines, per NC 2/2026). Either integrate TEIF or use an approved e-invoicing
  software.
- **An auto-entrepreneur is not VAT-registered**, so it is likely outside art. 18 [À
  confirmer].

---

## 3. Cash registers (caisse enregistreuse / fiscal POS)

| | |
|---|---|
| Legal basis | **Décret gouvernemental 2019-1126 of 26 Nov 2019** (register module, tax-data module, Ministry central platform). Rollout by **arrêté of the Minister of Finance, 14 Oct 2025**. |
| Who | **On-site consumption only**: restaurants, cafés, salons de thé, places serving ready-to-eat food or drink, and later *"commerces assimilés"* (snacks, bakeries). **Retail and bookshops are not listed.** |
| Calendar | 1 Nov 2025: tourist restaurants and 2nd/3rd-category cafés and salons de thé. **1 Jul 2026:** other legal persons in the sector. **1 Jul 2027:** individuals on the real regime filing monthly. **1 Jul 2028:** all other individuals in the sector. |
| Software | Only **homologated** systems from approved suppliers. Supplier portal: `homologation.nacef.tn`. |
| Sanctions | Tampering, deletion or falsification of recorded data is sanctioned under **CDPF art. 94**. |
| Sources | [L'Economiste Maghrébin, 21 May 2026](https://www.leconomistemaghrebin.com/2026/05/21/caisses-enregistreuses-obligatoires-juillet-2026/); [Webdo, 17 Oct 2025](https://www.webdo.tn/fr/actualite/national/tunisie-fiscalite-lancement-du-systeme-dhomologation-des-caisses-enregistreuses/385862/); [Managers, 30 Jun 2026](https://managers.tn/2026/06/30/caisse-enregistreuse-obligatoire-ce-que-prevoit-la-loi-en-cas-de-non-respect/) [Secondaire] |

**What this means:**
- Mektebti **does not need homologation to sell to bookshops today**.
- Do **not** write "caisse homologuée", "conforme NACEF" or "conforme loi de finances" on
  the landing page or in ads. That would be a false claim.
- If a client also runs a café corner, that activity needs a homologated register, and
  Mektebti is not one.
- **Plan for retail being added later.** The decree's model (secure tax-data module,
  transmission to the Ministry, tamper evidence) is the direction of travel.
- Engineering choices that keep homologation possible later:
  - immutable sales (no hard delete);
  - an append-only hash-chained journal;
  - per-device sequential numbering;
  - an audit log.

  These are also the right choices for §1. See tasks G7 and G12.

---

## 4. The founder's side: selling the SaaS

### 4.1 Legal form

| Option | Fits Mektebti? | Key points | Sources |
|---|---|---|---|
| **Auto-entrepreneur** (Décret-loi 2020-33 of 10 Jun 2020, amended by LF 2023) | Only as a stop-gap, for **one person** | Tunisian individual, **turnover ≤ 75,000 DT/yr**. One *contribution unique* replaces income tax and VAT (200 DT/yr in communal zones, 100 DT elsewhere, + 20% TCL) plus social security. Nothing due in the first calendar year if the employment fund (FNE) covers contributions. **Not VAT-registered, so it cannot invoice VAT.** Cannot have a partner (your colleague), and **cannot get the Startup label** (which requires a company). The activity must be on the official eligible list; **we could not confirm that SaaS or software is on it.** | [WMC, Nov 2024](https://www.webmanagercenter.com/2024/11/12/534251/autoentrepreneur-en-tunisie-quel-est-le-regime-fiscal-et-social); [Copeps](https://copeps.fr/actualites/plateforme-auto-entrepreneur-tunisie/) [Secondaire; À confirmer for the activity list] |
| **SUARL** (single-member limited company) | Good if the colleague is an employee or contractor | Registration through the RNE (online). Minimum capital is reported as **1,000 DT** by secondary sources. Limited liability. VAT-registered for services. Eligible for the Startup label. | [Copeps, capital SARL/SUARL](https://copeps.fr/actualites/capital-minimum-sarl-tunisie/) [Secondaire; À confirmer] |
| **SARL** (2+ members) | **Best fit if founder and colleague are co-owners** | Same as SUARL, with 2 members. Article 3 of the Startup Act requires more than 2/3 of the capital to be held by individuals or investors, which fits. | as above |
| **Startup Act label** (Loi 2018-20 of 17 Apr 2018, Décret 2018-840) | **Apply right after incorporation** | **Conditions (art. 3):** company ≤ 8 years old, below headcount, assets and turnover caps, > 2/3 of capital held by individuals or VC, **innovative (notably technological) business model**, high growth potential. Pre-label for 6 months (art. 4). **Benefits:** **corporate-tax exemption** for the life of the label, and the **State pays employer and employee social-security contributions** (art. 19). **Startup grant (*bourse*)** for up to 3 full-time founders for 1 year (art. 10). **Startup leave (*congé startup*)** for salaried founders (art. 8). **Foreign-currency account** (art. 17). **Technology card raised to 100,000 TND/yr**. **Exemption from CERT approval** for imports. Authorised economic operator status for customs (art. 20). | [Loi 2018-20 (JORT text)](https://cmf.tn/sites/default/files/pdfs/reglementation/textes-reference/Loi2018_20%20%20sur%20les%20start%20up.pdf) [Texte]; [startup.gov.tn, benefits](https://startup.gov.tn/en/startup_act/benefits_to_Startups) [Officiel] |

**Recommendation:** incorporate a **SARL** (founder plus colleague) or a **SUARL**, and
**apply for the Startup label** immediately. An offline-first PWA, barcode till and
vertical SaaS has a credible "innovative technology" story, but this is **not
guaranteed**: a committee decides.

The foreign-currency account and technology card **solve the practical problem of paying
Google Ads, Meta, Firebase and Netlify in foreign currency.** Under the label, corporate
tax is exempt. Outside it, the LF 2025 rate grid (loi 2024-48) applies; ask the
accountant ([chaexpert, LF 2025](https://chaexpert.com/lf-2025-nouveaux-taux-is/)).

### 4.2 VAT on the SaaS

- **19%.** A SaaS subscription is not in Tableau B (7%), and is not one of the services
  listed at 13% (art. 7: architects, lawyers, tax advisers, *"experts et conseils"*…). Do
  not bill the SaaS as "conseil" to chase 13%. [Texte]
- **Decide HT or TTC.** Most of your clients are probably *non-assujettis* and cannot
  recover VAT, so the **TTC price is what they compare**. Recommendation: **quote TTC on the
  landing page** ("prix TTC"). Worked examples (arithmetic, not advice):
  - **83 DT/month TTC** = 69.748 HT + 13.252 VAT. **83 DT HT** = 98.770 TTC.
  - **2,000 DT/yr TTC** = 1,680.672 HT + 319.328 VAT.
  - **3,400 DT TTC** = 2,857.143 HT + 542.857 VAT.
- **Bundles that include hardware** (annual and lifetime plans) must be **split on the
  invoice**: one hardware line (19%, or 7% if the 84.71 classification is confirmed) and
  one service line (19%). The split must reflect a realistic value for each part.

### 4.3 Invoicing your clients

- Mektebti's own invoices must follow art. 18 (§1.3):
  - its **own MF**;
  - the shop's **name, address and MF**;
  - HT, VAT 19%, and the timbre fiscal (1.000 DT);
  - an **uninterrupted series**.
- Plus e-invoicing if §2.3 applies.
- **Stamp cost:** monthly invoicing means 12 stamps a year per client. Options: bill
  **quarterly or yearly in advance**, or check with the accountant whether a signed
  subscription contract can stand in (art. 18-II: *"sauf dans le cas où le contrat fait
  foi"*) [À confirmer].
- **First month free:** issue no invoice, or a zero invoice. The CGV must say when billing
  starts and how to cancel before it does.

### 4.4 Withholding tax (*retenue à la source*) your clients may apply

- **Payments ≥ 1,000 DT, VAT included,** for goods, equipment or services, made by **legal
  persons and real-regime individuals**, and by the State and public bodies, are subject to
  withholding at **0.5%, 1% or 1.5%**. The rate depends on the **recipient's** tax regime
  (LF 2025 grid, tied to the recipient's corporate-tax rate: 10%, 20%, or 35/40%).
- Sources:
  - [Note commune n°6/2025, DGI](https://jibaya.tn/wp-content/uploads/2025/03/Note-Commune-N%C2%B006.pdf)
    (via its published summary; the PDF did not load for us);
  - [chaexpert, LF 2025](https://chaexpert.com/lf-2025-nouveaux-taux-is/);
  - the 1.5% to 1% cut in LF 2021, per [Kapitalis](https://kapitalis.com/tunisie/?p=329853).
- **[À confirmer]**: one 2026 vendor guide says the threshold is HT and depends on the
  *payer*.
- **Impact:**
  - The monthly plan (83 DT) is under the threshold.
  - The **annual (2,000 DT) and lifetime (3,400 DT)** plans are over it. A client on the
    real regime may pay you **99%** (or 99.5% or 98.5%) and give you a withholding
    certificate, issued on the DGI **TEJ** platform.
  - The withheld amount is a **tax credit for Mektebti, not a loss**, but it must be
    tracked in collections.
  - A forfaitaire shop is usually not a withholding agent [À confirmer].
- **State and public buyers** (for example a public school library): they also withhold
  **25% of the VAT** on amounts ≥ 1,000 DT TTC (Code TVA art. 19 bis) [Texte].

### 4.5 Paying foreign providers (Google Ads, Meta Ads, Firebase/Google Cloud, Netlify)

- **VAT:** for taxable services from a provider with no establishment in Tunisia, **the
  Tunisian client withholds the VAT** (Code TVA art. 19-1, "retenue libératoire"). The
  invoice is HT. Your company declares 19% VAT on it, and can deduct it if VAT-registered.
  [Texte]
- **Income-tax withholding on payments to non-residents** may also apply. Rates range from
  5% to 20% depending on the type of income and the tax treaty
  ([Hesabi, 2026](https://hesabi.tn/actualites/taux-retenue-source-tunisie-2026))
  [Secondaire; À confirmer per provider].
- **Ask the accountant to set up the reverse-charge process before the first ad spend.**
- **Payment means:** an international technology card, or the Startup foreign-currency
  account (§4.1).

### 4.6 Hardware: barcode scanner and 80 mm thermal printer

| Option | Pros | Cons and obligations |
|---|---|---|
| **A. Buy from a Tunisian distributor, resell** (recommended for launch) | Simple. Supplier invoice with VAT you can deduct. Warranty from the distributor. | Your company's RNE activity must cover **trading in IT equipment** as well as software services. Resale VAT is 19% (7% only if the device is classified 84.71) [À confirmer with the supplier's invoice]. |
| **B. Import** | Better margin at volume | Customs declaration through a customs broker (*transitaire*), duties plus **import VAT**. **Radio devices (Bluetooth or 2.4 GHz scanners) need CERT type approval** (law 2001-1, décret 2020-48, per [ib-lenhardt](https://ib-lenhardt.com/fr/homologation-type/tunisie)) **unless you hold the Startup label** (CERT exemption, per [startup.gov.tn](https://startup.gov.tn/en/startup_act/benefits_to_Startups)). Corded USB scanners avoid the radio question. Note: the LF 2026 optional *forfait* excludes import activities. Whether an auto-entrepreneur may import is [À confirmer]. |
| **C. Lend the hardware as part of the subscription** (*mise à disposition*) | The hardware returns if the client churns, which protects the "annual including hardware" economics | The hardware stays Mektebti's fixed asset (depreciated). The CGV need clauses on care, loss and return. The plan price is then 100% a service at 19%. |

**Warranty:**
- Pass the **manufacturer's warranty** through, with its length stated in the CGV.
- Mektebti should not promise more than the distributor gives it.
- If a shop already owns compatible hardware, the 500 DT setup is not due, so state the
  compatibility list.

### 4.7 The "Lifetime 3,400 DT" plan

Legally risky as worded: "lifetime access" is an open-ended obligation. In the CGV, define:

- "à vie" means **for as long as Mektebti operates the service**, with a **minimum
  guaranteed period** (for example 5 years);
- what happens on discontinuation: notice period, **full data export**, and a pro-rata
  refund formula if it ends before the minimum;
- that it is **personal to the shop and not transferable**;
- that **hardware is excluded after its warranty**.

Also note, from the data-protection law: art. 24 requires informing the INPDP **3 months
before ceasing activity**.

---

## 5. Data protection: Loi organique 2004-63 (and website tracking)

### 5.1 Framework

- **Loi organique n° 2004-63 of 27 Jul 2004**
  ([text](https://legislation-securite.tn/wp-content/uploads/sites/5/2023/11/Loi-n°-2004-63-du-27-Juillet-2004-Fr.pdf))
  [Texte]. Implementing decree **2007-3004** (declaration and authorisation procedures).
  Regulator: **INPDP**.
- Tunisia is party to **Council of Europe Convention 108** (in force for Tunisia since
  1 Nov 2017)
  ([CoE](https://coe.int/en/web/data-protection/home/-/asset_publisher/RMbj8Pk1ApgJ/content/welcome-tunisia-new-party-to-convention-108)).
- **Reform pending:** a 132-article organic bill to replace the 2004 law was in committee
  in **Feb 2026**. It would add a data protection officer (DPO), impact assessments and
  larger financial penalties
  ([Tunisie Numérique, 19 Feb 2026](https://www.tunisienumerique.com/protection-des-donnees-en-tunisie-vers-une-reforme-majeure-face-aux-defis-numeriques/)).
  **Building to a GDPR-like standard now is the cheap insurance.**

### 5.2 Who is who

| Data | Controller (*responsable du traitement*) | Mektebti's role |
|---|---|---|
| Carnet clients (name, phone, **CIN**, debts, purchase history) | **The shop** | **Processor** (*sous-traitant*, art. 20). Needs a written processing agreement. |
| Shop owner accounts and logins, billing, support (WhatsApp) | **Mektebti** | Controller |
| Landing-page visitors (GA4, Google Ads, Meta Pixel, WhatsApp leads) | **Mektebti** | Controller (Google and Meta are recipients) |

### 5.3 Obligations and what they mean for the product

| Article | Obligation | Mektebti action |
|---|---|---|
| **7** | **Prior declaration to the INPDP** for any processing. Silence for 1 month counts as acceptance. | Mektebti files its own declaration (accounts, billing, website). Give shops a **pre-filled declaration template** for their carnet and offer it as a service. Penalty for processing without a declaration: **1 year and 5,000 DT** (art. 90). |
| 10–11 | Explicit, lawful purpose. Data **limited to what is necessary**, accurate and up to date. | **CIN must stay optional**, with its purpose shown: "identification en cas de recouvrement". Do not collect anything else "just in case". |
| 27, 29 | Express written consent, **except** when processing is required by an agreement the person is party to (art. 29). A credit arrangement is one. | The carnet relies on art. 29. Nonetheless, **information (art. 31) is still owed**. |
| **30** | **Use for advertising requires express and specific consent.** | Add a **"Accepte d'être contacté (WhatsApp/SMS)"** flag on Customer, off by default. No bulk messaging feature without it. |
| 31 | Inform data subjects **in writing**, including: nature of data, purposes, mandatory or optional, recipients, controller identity, rights of access, withdrawal and objection, **retention period**, security summary, **country of any transfer**. | Provide a printable **"Avis d'information – carnet de crédit"** (FR/AR) for the counter, and a line on the carnet print. |
| **18–19** | Security: access control, **after-the-fact traceability** of who entered or changed what and when, protection in transit, **secure backup copies**. | Per-user logins and roles. **Audit log** of sales, price and carnet changes. Downloaded backups are **plain JSON/CSV today**: warn the owner, or encrypt them (gap G10). |
| 20, 22 | Choose the processor carefully. **Art. 22:** the controller, the processor *and their agents* must be **Tunisian nationals, resident in Tunisia, with no criminal record.** | Mektebti (Tunisian founders) is fine. **Google (Firebase) and Netlify as sub-processors raise an art. 22 question**: **lawyer opinion needed**. |
| **50–52** | Transfer abroad: forbidden if it threatens public security or vital interests (art. 50). Requires an adequate level of protection (art. 51). **INPDP authorisation is required in every case** (art. 52). | Firestore is in **europe-west9 (Paris)**. Firebase Auth and Netlify are also outside Tunisia. **File the art. 52 authorisation request** (Mektebti for its data; support shops for theirs) and name **France/EU** in the privacy notice. Penalty: **1 year and 5,000 DT** (art. 90). |
| 24 | Inform the INPDP **3 months before ceasing activity.** | CGV and lifetime plan (§4.7). |
| 28 | Data about **children** needs guardian consent **and a family judge's authorisation**. | Product rule: **no carnet for minors**. The account holder is the parent. Say so in the UI. |
| 32–43 | Rights of access, rectification and objection. | Per-customer **export** and **erasure** (when the balance is 0; keep anonymised accounting references for 10 years). |
| 45 | Destroy data at the end of the declared retention period (in the presence of a bailiff and an expert). | Define retention: carnet data for the life of the account + N months after a zero balance, then anonymise. |

### 5.4 Cookies and tracking on the website (GA4, GTM, Google Ads, Meta Pixel)

- **Tunisia has no cookie-specific statute that we could find.** INPDP guidance on cookies
  was not found either. But the identifiers GA4 and the Pixel set are personal data under
  art. 4–5. Using them for ads triggers **art. 30 (express consent)**, and sending them to
  Google and Meta (US) triggers **art. 52**.
- **Google:** the EU User Consent Policy is **mandatory only for users in the EEA, the UK
  and Switzerland**
  ([Google](https://www.google.com/about/company/user-consent-policy/)). It still matters
  if the site gets Tunisian diaspora traffic from France.
- **Meta:** the Business Tools Terms require a **"clear and prominent notice on each web
  page where our pixels are used"**, and **verifiable consent where the law requires it**
  (§3.c–d, [Meta](https://www.facebook.com/legal/technology_terms)).
- **E-commerce law** (loi 2000-83, art. 25): before a contract is concluded online, give
  identity and contact details, prices and taxes, payment, delivery and after-sales terms
  ([official FR text](https://www.cmf.tn/sites/default/files/pdfs/reglementation/textes-reference/loi_2000-83_090800_fr.pdf);
  [unofficial EN translation](https://www.ictpolicyafrica.org/en/document/94x41x6wcz6?page=5)).
  This mostly targets consumers, but **putting prices TTC and terms on the page satisfies
  it anyway**.

**Recommended setup** (to agree with the agent doing GTM/GA4):

1. A consent banner in FR and AR on `/decouvrir` and the marketing routes only:
   **"Accepter" / "Refuser" / "Personnaliser"**, with equal prominence. Continuing to
   browse ≠ consent.
2. **Google Consent Mode v2**: `ad_storage`, `ad_user_data`, `ad_personalization` and
   `analytics_storage` set to **denied by default**, and updated on acceptance.
3. **Meta Pixel and the Google Ads tags are loaded only after consent.** Lead events
   (clicking the WhatsApp CTA) fire only after consent.
4. **Never load GTM, GA4 or the Pixel inside the logged-in app** (`/`, `/caisse`, etc.).
   Those screens show shop customers' names, phones and CIN, and must stay tag-free.
5. A "Gérer mes cookies" link in the footer. Store the consent log (date, choice, version).
6. Privacy policy and cookie policy pages (§6.2, §6.3).

---

## 6. Ready-to-adapt French templates

> ⚠️ **MODÈLES À FAIRE VALIDER PAR UN AVOCAT TUNISIEN AVANT PUBLICATION.**
> Fill in every `[…]`. Do not publish with placeholders. An Arabic version is
> recommended. If they diverge, say which version prevails.

### 6.1 Mentions légales (footer page `/mentions-legales`)

- Éditeur : `[Raison sociale]`, `[SARL/SUARL]` au capital de `[…]` DT, siège `[adresse]`,
  RNE `[…]`, matricule fiscal `[…]`, tél. +216 98 158 160, e-mail `[…]`.
- Directeur de la publication : `[Nom]`.
- Hébergement du site : Netlify, Inc. (États-Unis), `[adresse à compléter]`. Données de
  l'application : Google Cloud / Firebase, région europe-west9 (Paris, France).
- Propriété intellectuelle : marque et logo « Mektebti.tn / مكتبتي » `[dépôt INNORPI
  n° … le cas échéant]`.

### 6.2 Conditions générales de vente et d'utilisation (CGV/CGU): outline

1. **Objet.** Abonnement au logiciel Mektebti.tn (caisse, stock, carnet de crédit,
   factures, rapports) en mode SaaS, et le cas échéant fourniture de matériel (douchette,
   imprimante thermique).
2. **Clients.** Professionnels uniquement (librairies, papeteries). Le client déclare agir
   pour les besoins de son activité.
3. **Offres et prix.** Prix en dinars tunisiens, **TTC (TVA 19 %)** sauf mention contraire.
   Frais de mise en service, mensuel, annuel, « à vie » : contenu exact de chaque formule
   (matériel vendu ou mis à disposition). **Premier mois offert : conditions et date de
   début de facturation.**
4. **Commande et activation.** Création du compte par Mektebti (pas d'inscription libre).
   Identifiants personnels, confidentialité, responsabilité du client pour ses
   utilisateurs.
5. **Facturation et paiement.** Périodicité, moyens de paiement, timbre fiscal, retenue à
   la source (remise du certificat), retard de paiement : suspension après mise en demeure
   de `[X]` jours, **sans suppression des données** pendant `[Y]` jours.
6. **Durée, résiliation.** Mensuel sans engagement, préavis `[…]`. Annuel : engagement
   12 mois. **Formule « à vie »** : définition (durée d'exploitation du service, minimum
   garanti de `[N]` ans), cas d'arrêt, préavis, export et remboursement au prorata (§4.7).
7. **Matériel.** Vente ou mise à disposition. Garantie constructeur de `[durée]`
   transmise. Exclusions (casse, liquide, surtension). Restitution en fin d'abonnement si
   mis à disposition.
8. **Service et disponibilité.** Fonctionnement hors ligne et synchronisation. Pas de
   garantie de disponibilité absolue. Maintenance. Support WhatsApp `[horaires]`.
9. **Obligations fiscales du client.** **Le client reste seul responsable** du choix de son
   régime fiscal, des taux de TVA paramétrés, de la numérotation et de la conservation de
   ses factures, et de ses déclarations. Mektebti fournit un outil et ne délivre aucun
   conseil fiscal. **Le logiciel n'est pas une caisse enregistreuse homologuée au sens du
   décret 2019-1126**, non requise à ce jour pour l'activité de librairie.
10. **Données.** Le client est responsable du traitement des données de ses propres
    clients (carnet). Mektebti agit comme sous-traitant (renvoi à l'accord de sous-traitance,
    §6.4). **Le client reste propriétaire de ses données** : export à tout moment, et
    conservation et restitution `[N]` mois après la fin du contrat.
11. **Responsabilité.** Limitée aux sommes payées sur les 12 derniers mois. Exclusion des
    dommages indirects. Sauvegardes : responsabilité partagée (export recommandé).
12. **Propriété intellectuelle.** Licence d'utilisation non exclusive et non cessible.
13. **Modification des CGV.** Information `[30]` jours avant.
14. **Droit applicable et litiges.** Droit tunisien. Tentative amiable, puis tribunaux de
    `[ville]`.

### 6.3 Politique de confidentialité (site + application): outline

1. **Responsable du traitement** (identité, contact, numéro de déclaration INPDP `[…]`).
2. **Données collectées.**
   - Site : données de navigation et cookies (si consentement), données transmises via
     WhatsApp.
   - Application : compte gérant, données de facturation.
   - Données des clients des librairies : traitées **pour le compte** de la librairie.
3. **Finalités.** Fourniture du service, facturation, support, amélioration, mesure
   d'audience et publicité (**uniquement avec consentement**).
4. **Base de traitement.** Contrat (art. 29), consentement (art. 27 et 30), obligations
   légales (comptabilité).
5. **Destinataires et sous-traitants.** Google (Firebase), Netlify, Google Ads / Meta (si
   consentement), comptable.
6. **Transferts hors de Tunisie.** **France (Union européenne)** pour l'hébergement des
   données de l'application. États-Unis pour la mesure d'audience et la publicité.
   **Autorisation de l'INPDP n° `[…]`** (art. 52).
7. **Durées de conservation.** Compte : durée du contrat + `[N]` mois. Factures : 10 ans.
   Cookies : `[13]` mois maximum. Prospects : `[N]` mois.
8. **Sécurité** (art. 18–19). Chiffrement en transit, contrôle d'accès, sauvegardes.
9. **Vos droits** (art. 32–43). Accès, rectification, opposition, retrait du consentement.
   Adresse de contact. Recours auprès de l'INPDP.
10. **Mineurs.** Le service ne s'adresse pas aux mineurs. Pas de carnet ouvert au nom d'un
    mineur.
11. **Cookies.** Liste (nom, émetteur, finalité, durée), gestion du consentement, lien
    « Gérer mes cookies ».
12. **Mise à jour** de la politique, avec la date.

### 6.4 Accord de sous-traitance (annexe aux CGV): outline

Objet et durée. Nature et finalité du traitement (gestion du carnet de crédit et des
ventes). Catégories de données : nom, téléphone, **CIN facultatif**, montants.
Instructions du client. Confidentialité des agents (art. 23). Mesures de sécurité
(art. 18–19). Sous-traitants ultérieurs (Google Cloud, Paris). Assistance pour les droits
des personnes. Notification sans délai de tout incident. Restitution ou destruction en fin
de contrat. Audit raisonnable.

### 6.5 Bannière cookies (texte court)

> « Mektebti.tn utilise des cookies de mesure d'audience et de publicité (Google, Meta)
> **uniquement si vous l'acceptez**. Ils nous aident à savoir quelles annonces vous ont
> amené ici. Vous pouvez changer d'avis à tout moment via « Gérer mes cookies ».
> [Accepter] [Refuser] [Personnaliser] — En savoir plus »

### 6.6 Avis d'information « carnet de crédit » (affiche ou mention au dos du carnet)

> « La librairie `[nom]` enregistre vos nom, téléphone (et, si vous l'acceptez, votre
> numéro de CIN) pour gérer votre compte de crédit. Ces données sont hébergées par son
> prestataire Mektebti.tn (serveurs en France) et ne sont jamais utilisées à des fins
> publicitaires sans votre accord écrit. Vous pouvez y accéder, les faire corriger ou vous
> opposer à leur traitement auprès de la librairie. Conservation : `[durée]`. »

---

## 7. App compliance gaps (read-only review of the code)

Files reviewed:
- `src/features/pos/Ticket.tsx`
- `src/features/settings/SettingsPage.tsx` and `useShopSettings.ts`
- `src/types/models.ts`
- `src/features/sales/useSales.ts` and `NewSaleInvoice.tsx`
- `src/features/stock/pricing.ts`
- `src/features/credit/*`
- `src/features/landing/*`

| ID | Gap (evidence) | Why it matters | Fix |
|---|---|---|---|
| **G1** | `Ticket.tsx` prints **"FACTURE" for every A4 print** (`a4Head`), whatever `Sale.kind` is. The till lets any ticket be printed in A4 (`CaissePage.tsx` `doPrint('a4')`, `SalesTab.tsx`). | A counter ticket handed over as a "FACTURE" without HT, VAT, client MF or a sequential number is a **non-compliant invoice**. It exposes the *shop* (art. 18, CDPF art. 94) and lets the buyer down (no VAT deduction). | Print "TICKET DE CAISSE" or "REÇU" unless `kind === 'invoice'` and the invoice requirements (G2–G5) are met. |
| **G2** | No fiscal profile: `ShopSettings` has only free-text `taxId`, plus `name`, `address`, `phone`. No legal name, legal form, RNE, VAT regime, or stamp setting. | The app cannot know whether to print VAT (art. 2-I-2 risk) or the timbre. | Add `fiscalRegime` (`'non_assujetti' \| 'reel' \| 'partiel'`), `legalName`, `rne`, `stampDuty` (millimes, default 1000), `stampPaidByDeclaration`, plus a lenient **MF validator** (python-stdnum structure). Show the regime in the settings preview. |
| **G3** | `makeTicketNo()` = `YYMMDD-HHmmss-<random 2 chars>`, and the same number is used for invoices. | Art. 18-III-1 requires invoices **numbered in an uninterrupted series**. | Separate **invoice series** per shop and year (`2026/000123`), assigned in a Firestore **transaction when online** (invoices are rare and B2B). Tickets get a **per-device series** (`C1-2026-004812`), with the device prefix registered at enrolment. The accountant must validate that multiple series are acceptable. |
| **G4** | `SaleItem` stores `unitPrice` and `unitCost` only. `Product.vatRate` is **purchase** VAT. `VAT_RATES = [0, 7, 19]` exists, but nothing on the sale side uses it. | No HT, rate or VAT on invoices. No turnover split by rate. Books (exempt) and 7% exercise books cannot be told apart from 19% items on the sale side. | Add `Product.saleVatRate` (pre-filled from category: Livres 0, Cahiers scolaires 7, others 19). Snapshot `vatRate`, `ht` and `vat` on each `SaleItem` at sale time. Show a VAT summary on invoices and tickets for `reel` shops only. |
| **G5** | `Customer` has `name`, `phone`, `cin`. **No address and no MF.** `NewSaleInvoice` picks a customer and prints only the name. | Art. 18 requires the client's identity and address, plus the MF for businesses. | Add `Customer.address`, `Customer.taxId` and `Customer.isBusiness`. Make them required in `NewSaleInvoice` when the client is a business. Print the client block on A4. |
| **G6** | No timbre fiscal line and no amount in words. | CDET art. 117 6° (1.000 DT per invoice). The amount in words is a customary expectation. | Add a "Timbre fiscal" line to invoices only (G2 setting), and `amountInWordsFr(millimes)` ("… dinars et … millimes"). |
| **G7** | `voidSale()` **hard-deletes** the sale (`batch.delete(doc(... SALES ...))`). `updateSale()` rewrites the ticket **in place**. | Invoices must be kept for 10 years and corrected only by **credit note**. Deleting sales is also exactly the "suppression des données enregistrées" the cash-register regime sanctions. | Replace the delete with `status: 'voided'` + `voidedAt` + `voidReason` (reports filter it out). For `kind === 'invoice'`, **block edits after issue** and generate a **facture d'avoir** linked to the original. Keep the edit history (`revisions[]`). |
| **G8** | No daily close (*clôture / Z*), no *facture globale*, no fiscal registers. | Art. 18-II requires a daily global invoice and day-by-day registers for retailers without full accounts. This is also a **differentiating feature**. | Add a "Clôture de caisse" button: totals by VAT rate and payment mode, a numbered *facture globale*, and an accountant export (CSV/PDF) of the four registers. |
| **G9** | `PurchaseItem` = `name`, `qty`, `unitCost`. `Supplier` has no MF. | The daily purchase register needs HT, rate and VAT per purchase. VAT deduction needs compliant supplier invoices. | Add `htCost`, `vatRate` and `vatAmount` to `PurchaseItem`, `supplierInvoiceNo`, and `Supplier.taxId`. |
| **G10** | Customer `cin` is shown in lists (`CreditPage.tsx`) and printed on the carnet (`CarnetPrint.tsx`). Backups are downloaded as **plain JSON/CSV** (`backupService.ts`). No marketing-consent flag. | Loi 2004-63: data minimisation (art. 11), security (art. 18–19), advertising consent (art. 30). | CIN optional with a purpose hint, masked in lists (`•••• 4821`), and printed only if the owner ticks a box. Add `Customer.contactOptIn`. Show a warning before downloading a backup (or encrypt it with a passphrase). Add per-customer export and erase. |
| **G11** | The landing page has no legal links (footer: `© 2026 Mektebti.tn · Fait en Tunisie`). Tags are about to be added. | E-commerce law art. 25, loi 2004-63 art. 31, Meta §3.c notice, Google consent. | Add `/mentions-legales`, `/cgv`, `/confidentialite` and `/cookies` routes, footer links, and a **consent banner gating GTM, GA4, Ads and Pixel** (Consent Mode v2 denied by default). **Exclude all tags from app routes.** |
| **G12** | No audit log, and every device writes as the same shop account. | Art. 19 (*"vérifiés à posteriori l'identité des personnes… le moment de cette introduction"*). It is also a prerequisite for any future fiscal-POS homologation. | Later: per-user logins and roles (owner/cashier), an append-only `audit` collection, and a hash-chained sales journal. |
| **G13** | Marketing claims. | Saying "conforme", "homologué" or "facture légale" before G1–G7 ship would be misleading. | Landing copy: claim only what exists. Once G2–G7 ship, use: « Factures avec matricule fiscal, TVA par taux et timbre fiscal ». |

---

## 8. Decisions only the founder can make

1. **Legal entity:** SARL (with your colleague as co-owner), SUARL, or auto-entrepreneur as
   a stop-gap. And **whether to apply for the Startup label** right away.
2. **Are published prices TTC or HT?** (Recommendation: TTC.) What exactly is the VAT base
   of each plan, and how is it split between hardware and service on bundled invoices?
3. **Hardware: sell it or lend it?** Buy locally or import? Corded or wireless scanner
   (wireless needs CERT approval)? What warranty length do you pass on?
4. **What "à vie" means:** the minimum guaranteed years, the discontinuation and refund
   rule, and transferability.
5. **Invoicing rhythm** for the monthly plan (monthly, quarterly or annual) given the
   1.000 DT stamp per invoice. Whether a signed contract can replace monthly invoices (ask
   the accountant).
6. **E-invoicing:** file the TTN adhesion request now as a precaution, or rely on the April
   2026 suspension. This needs the accountant's confirmation.
7. **Data hosting abroad:** accept the INPDP art. 52 authorisation route for Firebase Paris
   (recommended; changing region is impossible, see `SAAS.md`), and get a lawyer's view on
   art. 22.
8. **Whether to keep collecting the CIN** in the carnet at all.
9. **Tracking:** consent-gated GA4, Ads and Pixel for everyone (recommended), or no Meta
   Pixel at launch.
10. **Who signs** as data controller and privacy contact (name, e-mail), and which
    registered address appears in the mentions légales.
11. **Budget** for a lawyer (CGV, privacy policy, processing agreement, art. 22 and 52
    opinion) and an expert-comptable (VAT registration, withholding, reverse charge, stamp
    by declaration).
12. **Numbering policy:** per-device ticket series plus an online-only invoice series (G3),
    to be validated by the accountant.

---

## 9. Sources

**Primary or consolidated texts**
- Code de la TVA, consolidated 2022:
  https://chaexpert.com/documents/Code%20de%20la%20taxe%20sur%20la%20valeur%20ajout%C3%A9e%202022.pdf
  (art. 1-II-11, 2, 7, 9, 18, 19, 19 bis; Tableaux A and B)
- Code des droits d'enregistrement et de timbre, consolidated to 1 Jan 2025:
  https://chaexpert.com/documents/Code-des-Droits-dEnregistrement-et-de-Timbre-2025-Fr.pdf
  (art. 117, 118, 124, 127)
- Loi 2018-20 (Startup Act), JORT text:
  https://cmf.tn/sites/default/files/pdfs/reglementation/textes-reference/Loi2018_20%20%20sur%20les%20start%20up.pdf
- Loi organique 2004-63:
  https://legislation-securite.tn/wp-content/uploads/sites/5/2023/11/Loi-n°-2004-63-du-27-Juillet-2004-Fr.pdf
- Loi 2000-83 (e-commerce):
  https://www.cmf.tn/sites/default/files/pdfs/reglementation/textes-reference/loi_2000-83_090800_fr.pdf

**Official or institutional**
- startup.gov.tn, benefits: https://startup.gov.tn/en/startup_act/benefits_to_Startups
- DGI Note commune 6/2025 (withholding):
  https://jibaya.tn/wp-content/uploads/2025/03/Note-Commune-N%C2%B006.pdf
- Council of Europe, Tunisia and Convention 108:
  https://coe.int/en/web/data-protection/home/-/asset_publisher/RMbj8Pk1ApgJ/content/welcome-tunisia-new-party-to-convention-108
- Google EU User Consent Policy: https://www.google.com/about/company/user-consent-policy/
- Meta Business Tools Terms: https://www.facebook.com/legal/technology_terms

**Professional or press (secondary)**
- KPMG Tunisie, Circulaire fiscale n°2, Feb 2026 (e-invoicing, NC 2/2026):
  https://assets.kpmg.com/content/dam/kpmgsites/tn/pdf/circulaires-fiscales/Circulaire%20fiscale%20f%C3%A9vrier%202026%20final.pdf.coredownload.inline.pdf
- Tuniscope, 23 Jan 2026:
  https://www.tuniscope.com/article/423074/business/economie/facturation-electronique-132422
- Business News, 2 Apr 2026:
  https://businessnews.com.tn/2026/04/02/facturation-electronique-la-commission-des-finances-rejette-le-report-mais-propose-un-decalage-de-lapplication/1394884/
- Tunisie Numérique, e-invoicing amendment:
  https://www.tunisienumerique.com/tunisie-vers-un-amendement-du-cadre-de-la-facturation-electronique-audition-prevue-aujourdhui/
- L'Economiste Maghrébin, cash registers:
  https://www.leconomistemaghrebin.com/2026/05/21/caisses-enregistreuses-obligatoires-juillet-2026/
- Webdo, homologation launch:
  https://www.webdo.tn/fr/actualite/national/tunisie-fiscalite-lancement-du-systeme-dhomologation-des-caisses-enregistreuses/385862/
- Managers, sanctions (CDPF art. 94):
  https://managers.tn/2026/06/30/caisse-enregistreuse-obligatoire-ce-que-prevoit-la-loi-en-cas-de-non-respect/
- Tunisie Numérique, forfait optionnel LF 2026:
  https://www.tunisienumerique.com/tunisie-forfait-optionnel-bic-comment-fonctionne-t-il/
- Tunisie Numérique, data protection reform (Feb 2026):
  https://www.tunisienumerique.com/protection-des-donnees-en-tunisie-vers-une-reforme-majeure-face-aux-defis-numeriques/
- WMC, auto-entrepreneur:
  https://www.webmanagercenter.com/2024/11/12/534251/autoentrepreneur-en-tunisie-quel-est-le-regime-fiscal-et-social
- Copeps, auto-entrepreneur:
  https://copeps.fr/actualites/plateforme-auto-entrepreneur-tunisie/
- Copeps, SARL/SUARL capital:
  https://copeps.fr/actualites/capital-minimum-sarl-tunisie/
- Kapitalis, LF 2021 withholding rates: https://kapitalis.com/tunisie/?p=329853
- chaexpert, LF 2025 corporate-tax rates and withholding grid:
  https://chaexpert.com/lf-2025-nouveaux-taux-is/
- Hesabi, withholding table 2026:
  https://hesabi.tn/actualites/taux-retenue-source-tunisie-2026
- ib-lenhardt, CERT type approval: https://ib-lenhardt.com/fr/homologation-type/tunisie
- python-stdnum, MF structure: https://arthurdejong.org/python-stdnum/doc/stdnum.tn.mf
- Memoire Online, retention (loi 96-112):
  https://www.memoireonline.com/02/08/887/m_la-preuve-en-droit-fiscal34.html
- Unofficial EN translation of loi 2000-83:
  https://www.ictpolicyafrica.org/en/document/94x41x6wcz6?page=5
