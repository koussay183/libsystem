#!/usr/bin/env node
/**
 * Seed a demo bookshop into the LOCAL Firebase emulators.
 *
 *   node scripts/qa/seed.mjs <name> [--plan active|lapsed|blocked] [--empty]
 *   node scripts/qa/seed.mjs --wipe-all
 *
 * Creates (or resets) the account <name>@qa.test / qa-pass-123 with the custom
 * claims the security rules expect — { shopId: <name>, paidUntil } — and fills
 * shops/<name>/… with a realistic librairie: ~40 products with EAN-13 codes,
 * categories, suppliers, customers with a carnet, packs, three weeks of sales,
 * purchases and the settings document. Running it again wipes that one shop and
 * re-seeds it, so every run starts from the same state.
 *
 * EVERY NAME, PHONE NUMBER, PRICE AND VAT RATE BELOW IS MADE-UP TEST DATA. None
 * of it is a market price, a tax rule or a real person.
 *
 * It can only ever reach the emulators: the emulator hosts are forced to
 * loopback, the project id must start with "demo-" (a project id Firebase
 * guarantees has no production backend), and no credential is loaded.
 */

// ---------------------------------------------------------------------------
// Safety first — before firebase-admin is even imported.
// ---------------------------------------------------------------------------

const PROJECT_ID = process.env.QA_PROJECT_ID ?? 'demo-mektebti'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
// A service-account key in the environment is the one way this script could
// end up holding real credentials. It has no business here.
delete process.env.GOOGLE_APPLICATION_CREDENTIALS
// Without this google-auth-library probes the GCE metadata server for a
// project and credentials it will never use here — slow, and noisy behind a proxy.
process.env.METADATA_SERVER_DETECTION ??= 'none'

function assertLocal() {
  const loopback = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    if (!loopback.test(process.env[key] ?? '')) {
      throw new Error(`${key}=${process.env[key]} is not a loopback emulator host — refusing to run.`)
    }
  }
  if (!PROJECT_ID.startsWith('demo-')) {
    throw new Error(`Project id "${PROJECT_ID}" does not start with "demo-" — refusing to run.`)
  }
}
assertLocal()

const { pathToFileURL } = await import('node:url')
const { initializeApp, getApps } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')
const { getFirestore } = await import('firebase-admin/firestore')

// ---------------------------------------------------------------------------
// Constants shared with login.mjs
// ---------------------------------------------------------------------------

export const QA_PASSWORD = 'qa-pass-123'
export const emailFor = (name) => `${name}@qa.test`
/** Deliberately NOT equal to the shop id, so code mixing up uid and shopId fails in QA. */
export const uidFor = (name) => `${name}-uid`

const DAY = 86_400_000
/** 14 days — MUST MATCH graceMs() in firestore.rules. */
const RULES_GRACE_MS = 14 * DAY
/** 2099-12-31T00:00:00Z — far enough that no test ever sees a lapsed plan. */
const FAR_FUTURE = Date.UTC(2099, 11, 31)

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function app() {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
}

/** Deterministic PRNG, so a given shop name always seeds the same history. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return h >>> 0
}

/** Appends the EAN-13 check digit to 12 digits. */
export function ean13(body12) {
  if (!/^\d{12}$/.test(body12)) throw new Error(`ean13: need 12 digits, got ${body12}`)
  let sum = 0
  for (let i = 0; i < 12; i += 1) sum += Number(body12[i]) * (i % 2 === 0 ? 1 : 3)
  return body12 + ((10 - (sum % 10)) % 10)
}

const ttc = (ht, vat) => Math.round(ht * (1 + vat / 100))
const marginOf = (cost, sale) => Math.round(((sale - cost) / cost) * 1000) / 10
const pad = (n, w = 2) => String(n).padStart(w, '0')

/** Same shape as makeTicketNo() in src/features/sales/useSales.ts. */
function ticketNo(ts, rnd) {
  const d = new Date(ts)
  const stamp =
    `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const suffix = Math.floor(rnd() * 1296).toString(36).padStart(2, '0').toUpperCase()
  return `${stamp}-${suffix}`
}

/** A moment `daysAgo` days back, during opening hours (local time). */
function at(daysAgo, hour, minute = 0) {
  const d = new Date(Date.now() - daysAgo * DAY)
  d.setHours(hour, minute, Math.floor((hour * 7 + minute) % 60), 0)
  return Math.min(d.getTime(), Date.now() - 60_000)
}

/** Same as foldName() in cli/lib.mjs — what the catalogue search matches on. */
const foldName = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// ---------------------------------------------------------------------------
// The shop's data (all invented)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Arts plastiques',
  'Bureau',
  'Cahiers',
  'Cartables & trousses',
  'Écriture',
  'Livres & romans',
  'Livres scolaires',
  'Papeterie',
]

const SUPPLIERS = [
  { key: 'S1', name: 'Grossiste Papeterie Tunis', phone: '71 000 101', note: 'Livraison le mardi' },
  { key: 'S2', name: 'Diffusion Livres Sfax', phone: '74 000 202', note: 'Manuels et parascolaire' },
  { key: 'S3', name: 'Bureau Fournitures Sousse', phone: '73 000 303' },
]

/**
 * [key, name, category, supplierKey, costHT (millimes), vat %, salePrice (millimes),
 *  quantity, lowStockThreshold, unit, family?, variant?]
 * A null-ish key 'NOBARCODE' marks the one hand-added article with no code.
 */
const PRODUCTS = [
  ['bic-bleu', 'Stylo BIC Cristal — Bleu', 'Écriture', 'S1', 280, 19, 500, 120, 20, 'pièce', 'Stylo BIC Cristal', 'Bleu'],
  ['bic-noir', 'Stylo BIC Cristal — Noir', 'Écriture', 'S1', 280, 19, 500, 80, 20, 'pièce', 'Stylo BIC Cristal', 'Noir'],
  ['bic-rouge', 'Stylo BIC Cristal — Rouge', 'Écriture', 'S1', 280, 19, 500, 45, 20, 'pièce', 'Stylo BIC Cristal', 'Rouge'],
  ['bic-vert', 'Stylo BIC Cristal — Vert', 'Écriture', 'S1', 280, 19, 500, 6, 20, 'pièce', 'Stylo BIC Cristal', 'Vert'],
  ['crayon-hb', 'Crayon graphite HB', 'Écriture', 'S1', 350, 19, 600, 90, 20, 'pièce'],
  ['gomme', 'Gomme blanche Maped', 'Écriture', 'S1', 300, 19, 500, 60, 10, 'pièce'],
  ['taille', 'Taille-crayon métal Maped', 'Écriture', 'S1', 250, 19, 450, 40, 10, 'pièce'],
  ['surl-jaune', 'Surligneur Stabilo Boss — Jaune', 'Écriture', 'S1', 1200, 19, 2000, 25, 5, 'pièce', 'Surligneur Stabilo Boss', 'Jaune'],
  ['surl-rose', 'Surligneur Stabilo Boss — Rose', 'Écriture', 'S1', 1200, 19, 2000, 3, 5, 'pièce', 'Surligneur Stabilo Boss', 'Rose'],
  ['feutres', 'Feutres de coloriage x12', 'Écriture', 'S1', 3500, 19, 5800, 18, 5, 'boîte'],
  ['couleurs', 'Crayons de couleur x12 Maped', 'Écriture', 'S1', 3000, 19, 5000, 30, 6, 'boîte'],
  ['plume', 'Stylo plume Pelikan', 'Écriture', 'S1', 9000, 19, 15000, 0, 3, 'pièce'],
  ['correcteur', 'Correcteur stylo Tipp-Ex', 'Écriture', 'S1', 1600, 19, 2700, 22, 5, 'pièce'],
  ['cahier-48', 'Cahier 48 pages Seyès', 'Cahiers', 'S1', 380, 7, 550, 200, 50, 'pièce'],
  ['cahier-96', 'Cahier 96 pages Seyès', 'Cahiers', 'S1', 700, 7, 1000, 150, 40, 'pièce'],
  ['cahier-192', 'Cahier 192 pages grands carreaux', 'Cahiers', 'S1', 1400, 7, 2000, 60, 15, 'pièce'],
  ['cahier-tp', 'Cahier TP 64 pages', 'Cahiers', 'S1', 900, 7, 1300, 35, 10, 'pièce'],
  ['cahier-dessin', 'Cahier de dessin 32 pages', 'Cahiers', 'S1', 1100, 7, 1600, 12, 15, 'pièce'],
  ['bloc-a5', 'Bloc-notes A5 spirale', 'Cahiers', 'S1', 1500, 7, 2200, 28, 8, 'pièce'],
  ['repertoire', 'Répertoire alphabétique', 'Cahiers', 'S1', 2200, 7, 3200, 8, 3, 'pièce'],
  ['ramette', 'Ramette papier A4 80 g — 500 feuilles', 'Papeterie', 'S3', 11000, 19, 16000, 25, 5, 'ramette'],
  ['canson', 'Papier Canson couleur x10', 'Papeterie', 'S3', 2500, 19, 4000, 15, 5, 'paquet'],
  ['enveloppes', 'Enveloppes kraft A4 x10', 'Papeterie', 'S3', 1800, 19, 3000, 20, 5, 'paquet'],
  ['protege', 'Protège-cahier transparent', 'Papeterie', 'S3', 250, 19, 450, 300, 50, 'pièce'],
  ['etiquettes', 'Étiquettes scolaires x30', 'Papeterie', 'S3', 800, 19, 1400, 40, 10, 'paquet'],
  ['colle', 'Colle bâton UHU 21 g', 'Papeterie', 'S3', 1500, 19, 2500, 45, 10, 'pièce'],
  ['trousse', 'Trousse double compartiment', 'Cartables & trousses', 'S3', 6000, 19, 10500, 14, 4, 'pièce'],
  ['cartable', 'Cartable primaire à roulettes', 'Cartables & trousses', 'S3', 45000, 19, 75000, 6, 3, 'pièce'],
  ['sac-college', 'Sac à dos collège', 'Cartables & trousses', 'S3', 32000, 19, 52000, 9, 3, 'pièce'],
  ['agrafeuse', 'Agrafeuse de bureau', 'Bureau', 'S3', 7500, 19, 12500, 7, 2, 'pièce'],
  ['agrafes', 'Agrafes 24/6 x1000', 'Bureau', 'S3', 1200, 19, 2000, 30, 5, 'boîte'],
  ['classeur', 'Classeur à levier A4', 'Bureau', 'S3', 4500, 19, 7500, 18, 4, 'pièce'],
  ['calculatrice', 'Calculatrice scientifique Casio fx-82', 'Bureau', 'S3', 32000, 19, 49000, 5, 2, 'pièce'],
  ['regle', 'Règle plate 30 cm', 'Bureau', 'S3', 450, 19, 800, 70, 10, 'pièce'],
  ['ciseaux', 'Ciseaux scolaires bouts ronds', 'Bureau', 'S3', 1300, 19, 2300, 33, 8, 'pièce'],
  ['gouache', 'Gouache x6 tubes', 'Arts plastiques', 'S3', 5000, 19, 8500, 11, 3, 'boîte'],
  ['pinceaux', 'Pinceaux x5', 'Arts plastiques', 'S3', 2200, 19, 3800, 16, 4, 'paquet'],
  ['manuel-lecture', 'Manuel — Lecture 1ère année', 'Livres scolaires', 'S2', 3000, 0, 3500, 40, 10, 'pièce'],
  ['manuel-maths', 'Manuel — Mathématiques 6ème année', 'Livres scolaires', 'S2', 4200, 0, 4900, 25, 8, 'pièce'],
  ['parasco-fr', 'Parascolaire — Exercices de français 4ème', 'Livres scolaires', 'S2', 7500, 7, 11000, 12, 4, 'pièce'],
  ['petit-prince', 'Le Petit Prince (poche)', 'Livres & romans', 'S2', 6500, 7, 9500, 10, 3, 'pièce'],
  ['dico', 'Dictionnaire Larousse de poche', 'Livres & romans', 'S2', 18000, 7, 26000, 4, 3, 'pièce'],
  ['mie-de-pain', 'Gomme mie de pain (vrac)', 'Écriture', 'S1', 200, 19, 400, 50, 10, 'pièce', null, null, 'NOBARCODE'],
]

const PACKS = [
  {
    key: 'pack-1ere',
    name: 'Pack rentrée 1ère année',
    price: 24000,
    withBarcode: true,
    items: [
      ['cahier-48', 4], ['cahier-96', 2], ['bic-bleu', 2], ['crayon-hb', 2], ['gomme', 1],
      ['taille', 1], ['couleurs', 1], ['protege', 6], ['trousse', 1],
    ],
  },
  {
    key: 'pack-college',
    name: 'Pack collège 7ème année',
    price: 69000,
    withBarcode: false,
    items: [
      ['cahier-192', 4], ['cahier-tp', 2], ['bic-bleu', 3], ['bic-rouge', 1], ['surl-jaune', 1],
      ['regle', 1], ['classeur', 1], ['calculatrice', 1], ['correcteur', 1],
    ],
  },
]

const CUSTOMERS = [
  { key: 'c1', name: 'Mohamed Ali Ben Salah', phone: '98 000 001', cin: '00000001', note: 'Paie en fin de mois' },
  { key: 'c2', name: 'Fatma Trabelsi', phone: '22 000 002' },
  { key: 'c3', name: 'Sami Jlassi', phone: '55 000 003', cin: '00000003' },
  { key: 'c4', name: 'Amira Gharbi', phone: '97 000 004', note: 'Enseignante — école primaire' },
  { key: 'c5', name: 'Youssef Mejri', phone: '29 000 005' },
]

/** Hand-written carnet lines: [customerKey, type, amount, label, daysAgo]. */
const CREDIT_LINES = [
  ['c1', 'debit', 45500, 'Fournitures rentrée (carnet papier)', 40],
  ['c1', 'payment', 20000, 'Versement espèces', 10],
  ['c3', 'debit', 30000, 'Manuels scolaires', 50],
  ['c3', 'payment', 25000, 'Versement', 20],
  ['c4', 'debit', 87300, 'Packs rentrée x3 + manuels', 75],
  ['c5', 'debit', 4500, 'Ramette + enveloppes', 6],
]

/** Tickets on credit: [customerKey, [[productKey, qty]…], paid, daysAgo, hour]. */
const CREDIT_SALES = [
  ['c2', [['dico', 1], ['petit-prince', 1], ['cahier-96', 2]], 6000, 3, 11],
  ['c5', [['gouache', 1], ['pinceaux', 1]], 0, 1, 16],
]

/** [supplierKey, reference, [[productKey, qty]…], paidRatio, daysAgo, note?]. */
const PURCHASES = [
  ['S1', 'FA-2026-0412', [['cahier-48', 200], ['cahier-96', 150], ['bic-bleu', 100]], 1, 30, 'Commande rentrée'],
  ['S2', 'BL-7781', [['manuel-lecture', 40], ['manuel-maths', 25], ['petit-prince', 10]], 0.5, 15],
  ['S3', 'F-0093', [['ramette', 25], ['agrafeuse', 5], ['classeur', 20]], 0, 5],
]

/** Shared barcode catalogue entries (root `catalog/{code}`, global). */
const CATALOG_EXTRA = [
  { code: ean13('619999000001'), name: 'Cahier 288 pages Seyès', category: 'Cahiers', unit: 'pièce' },
  { code: ean13('619999000002'), name: 'Compas scolaire métal', brand: 'Maped', category: 'Bureau', unit: 'pièce' },
  { code: ean13('619999000003'), name: 'Feutre tableau blanc — Noir', category: 'Écriture', unit: 'pièce' },
  {
    code: ean13('619999000004'),
    name: 'Base 3 — Manuel QA de lecture',
    category: 'Livres scolaires',
    unit: 'pièce',
    official: true,
    officialPrice: 4000,
    officialCost: 3000,
    level: 'base3',
  },
]

// ---------------------------------------------------------------------------
// Building the documents
// ---------------------------------------------------------------------------

function buildShop(name, rnd) {
  const now = Date.now()
  const docs = [] // [collection, id, data]
  const put = (col, id, data) => docs.push([col, id, data])

  // Categories
  CATEGORIES.forEach((cat, i) => {
    put('categories', `cat-${i + 1}`, { name: cat, createdAt: now - 90 * DAY + i * 1000 })
  })

  // Suppliers
  const supplierName = {}
  SUPPLIERS.forEach((s, i) => {
    supplierName[s.key] = s.name
    put('suppliers', `sup-${i + 1}`, {
      name: s.name,
      phone: s.phone,
      ...(s.note ? { note: s.note } : {}),
      createdAt: now - 90 * DAY + i * 1000,
      updatedAt: now - 90 * DAY + i * 1000,
    })
  })

  // Products
  const products = {}
  PRODUCTS.forEach((row, i) => {
    const [key, pname, category, sup, costHT, vat, salePrice, quantity, threshold, unit, family, variant, flag] = row
    const costPrice = ttc(costHT, vat)
    const id = `p-${key}`
    products[key] = {
      id,
      data: {
        barcode: flag === 'NOBARCODE' ? null : ean13(`6191234${pad(i + 1, 5)}`),
        name: pname,
        category,
        supplier: supplierName[sup],
        ...(family ? { family, variant } : {}),
        unit,
        costPriceHT: costHT,
        vatRate: vat,
        costPrice,
        margin: marginOf(costPrice, salePrice),
        salePrice,
        quantity,
        lowStockThreshold: threshold,
        soldQty: 0,
        soldRevenue: 0,
        soldCost: 0,
        boughtQty: 0,
        boughtCost: 0,
        createdAt: now - 60 * DAY + i * 1000,
        updatedAt: now - 60 * DAY + i * 1000,
      },
    }
  })
  const P = (key) => {
    const p = products[key]
    if (!p) throw new Error(`seed: unknown product key ${key}`)
    return p
  }

  // Packs
  PACKS.forEach((pk, i) => {
    put('packs', pk.key, {
      name: pk.name,
      barcode: pk.withBarcode ? ean13(`2000000${pad(i + 1, 5)}`) : null,
      price: pk.price,
      items: pk.items.map(([key, qty]) => ({ productId: P(key).id, name: P(key).data.name, qty })),
      active: true,
      createdAt: now - 30 * DAY,
      updatedAt: now - 30 * DAY,
    })
  })

  // Customers + carnet
  const balances = Object.fromEntries(CUSTOMERS.map((c) => [c.key, 0]))
  const customerId = (key) => `cust-${key}`
  const customerName = (key) => CUSTOMERS.find((c) => c.key === key).name
  let entryN = 0
  const addEntry = (custKey, type, amount, label, date, extra = {}) => {
    entryN += 1
    balances[custKey] += type === 'debit' ? amount : -amount
    put('credit_entries', `ce-${pad(entryN, 3)}`, {
      customerId: customerId(custKey),
      type,
      amount,
      label,
      date,
      createdAt: date,
      ...extra,
    })
  }
  for (const [custKey, type, amount, label, daysAgo] of CREDIT_LINES) {
    addEntry(custKey, type, amount, label, at(daysAgo, 10 + (entryN % 7), 15))
  }

  // Sales
  const touch = (key, qty, unitPrice, unitCost, date) => {
    const d = P(key).data
    d.soldQty += qty
    d.soldRevenue += qty * unitPrice
    d.soldCost += qty * unitCost
    d.lastSoldAt = Math.max(d.lastSoldAt ?? 0, date)
  }
  let saleN = 0
  const addSale = ({ lines, date, discount = 0, paid, received, mode, custKey, kind = 'ticket' }) => {
    saleN += 1
    const items = lines.map(([key, qty]) => ({
      productId: P(key).id,
      name: P(key).data.name,
      qty,
      unitPrice: P(key).data.salePrice,
      unitCost: P(key).data.costPrice,
    }))
    const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
    const total = subtotal - discount
    const paidNow = paid ?? total
    const id = `sale-${pad(saleN, 3)}`
    const no = ticketNo(date, rnd)
    put('sales', id, {
      ticketNo: no,
      items,
      subtotal,
      discount,
      total,
      paid: paidNow,
      received: received ?? paidNow,
      mode: mode ?? (paidNow >= total ? 'paid' : paidNow > 0 ? 'partial' : 'credit'),
      onCredit: total - paidNow > 0,
      customerId: custKey ? customerId(custKey) : null,
      customerName: custKey ? customerName(custKey) : null,
      kind,
      hasReturn: false,
      date,
      createdAt: date,
    })
    lines.forEach(([key], i) => touch(key, items[i].qty, items[i].unitPrice, items[i].unitCost, date))
    if (total - paidNow > 0 && custKey) {
      addEntry(custKey, 'debit', total - paidNow, `Ticket ${no}`, date, { saleId: id, ticketNo: no })
    }
    return { id, total }
  }

  // ~3 weeks of cash tickets, deterministic for a given shop name. Day 0 is
  // today, so "Ventes du jour" on the home page is never empty.
  const sellable = PRODUCTS.filter((r) => r[12] !== 'NOBARCODE' && r[7] > 0).map((r) => r[0])
  for (let daysAgo = 20; daysAgo >= 0; daysAgo -= 1) {
    const tickets = 1 + Math.floor(rnd() * 3)
    for (let t = 0; t < tickets; t += 1) {
      const n = 1 + Math.floor(rnd() * 4)
      const lines = []
      for (let k = 0; k < n; k += 1) {
        const key = sellable[Math.floor(rnd() * sellable.length)]
        if (lines.some(([x]) => x === key)) continue
        lines.push([key, 1 + Math.floor(rnd() * 3)])
      }
      const hour = daysAgo === 0 ? Math.max(8, Math.min(new Date().getHours() - 1, 9 + t)) : 9 + Math.floor(rnd() * 10)
      const date = at(daysAgo, hour, Math.floor(rnd() * 60))
      const subtotal = lines.reduce((s, [k, q]) => s + q * P(k).data.salePrice, 0)
      const discount = subtotal > 20000 && rnd() < 0.4 ? 1000 : 0
      const total = subtotal - discount
      // Cash handed over rounded up to the next dinar sometimes, for the change line.
      const received = rnd() < 0.5 ? Math.ceil(total / 1000) * 1000 : total
      addSale({ lines, date, discount, paid: total, received })
    }
  }
  // One proper facture de vente (wholesale) for a teacher's class order.
  addSale({
    lines: [['cahier-96', 30], ['bic-bleu', 30], ['regle', 30]],
    date: at(8, 15, 30),
    discount: 3000,
    custKey: 'c4',
    kind: 'invoice',
  })
  // Tickets that went on a customer's carnet.
  for (const [custKey, lines, paid, daysAgo, hour] of CREDIT_SALES) {
    addSale({ lines, date: at(daysAgo, hour, 20), paid, custKey })
  }

  // Purchases (factures d'achat)
  PURCHASES.forEach(([supKey, reference, lines, paidRatio, daysAgo, note], i) => {
    const items = lines.map(([key, qty]) => ({
      productId: P(key).id,
      name: P(key).data.name,
      qty,
      unitCost: P(key).data.costPrice,
    }))
    const total = items.reduce((s, it) => s + it.qty * it.unitCost, 0)
    const date = at(daysAgo, 9, 30)
    put('purchases', `pur-${i + 1}`, {
      supplier: supplierName[supKey],
      reference,
      ...(note ? { note } : {}),
      items,
      total,
      paid: Math.round(total * paidRatio),
      date,
      createdAt: date,
      updatedAt: date,
    })
    for (const [key, qty] of lines) {
      P(key).data.boughtQty += qty
      P(key).data.boughtCost += qty * P(key).data.costPrice
    }
  })

  for (const { id, data } of Object.values(products)) put('products', id, data)

  CUSTOMERS.forEach((c, i) => {
    put('customers', customerId(c.key), {
      name: c.name,
      phone: c.phone,
      ...(c.cin ? { cin: c.cin } : {}),
      ...(c.note ? { note: c.note } : {}),
      balance: balances[c.key],
      createdAt: now - 80 * DAY + i * 1000,
      updatedAt: now - DAY,
    })
  })

  // Settings — the shop identity printed on tickets.
  put('settings', 'shop', {
    name: `Librairie QA · ${name}`,
    address: 'Avenue de la République, Tunis (adresse de test)',
    phone: '71 000 000',
    taxId: '0000000/A/M/000',
    footer: 'Merci et à bientôt !',
    defaultMargin: 35,
    categoryMargins: { Cahiers: 40, 'Livres scolaires': 15 },
    defaultVat: 19,
    moneyMode: 'dinar',
    services: [
      { id: 'svc-photocopie', name: 'Photocopie', code: 'PHOTOCOPIE', defaultPrice: 100, active: true },
      { id: 'svc-impression', name: 'Impression couleur', code: 'IMPRESSION', defaultPrice: 500, active: true },
      { id: 'svc-reliure', name: 'Reliure', code: 'RELIURE', defaultPrice: 2500, active: true },
    ],
  })

  // The same codes in the shared catalogue, so "recognised barcode" flows work,
  // plus a few articles this shop does not stock yet.
  const catalog = [
    ...['cahier-48', 'bic-bleu', 'colle', 'calculatrice', 'petit-prince'].map((key) => {
      const d = P(key).data
      return { code: d.barcode, name: d.name, category: d.category, unit: d.unit }
    }),
    ...CATALOG_EXTRA,
  ]

  const summary = {
    products: Object.keys(products).length,
    categories: CATEGORIES.length,
    suppliers: SUPPLIERS.length,
    customers: CUSTOMERS.length,
    creditEntries: entryN,
    packs: PACKS.length,
    sales: saleN,
    purchases: PURCHASES.length,
    catalog: catalog.length,
    balances: Object.fromEntries(CUSTOMERS.map((c) => [c.name, balances[c.key]])),
  }
  return { docs, catalog, summary }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const SHOP_COLLECTIONS = [
  'products',
  'categories',
  'suppliers',
  'customers',
  'credit_entries',
  'purchases',
  'sales',
  'packs',
  'settings',
  'catalog_contributions',
]

async function ensureUser(auth, name, paidUntil) {
  const uid = uidFor(name)
  const email = emailFor(name)
  // An account holding this email under another uid would make createUser fail.
  try {
    const byEmail = await auth.getUserByEmail(email)
    if (byEmail.uid !== uid) await auth.deleteUser(byEmail.uid)
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err
  }
  try {
    await auth.getUser(uid)
    await auth.updateUser(uid, { email, password: QA_PASSWORD, displayName: name, disabled: false })
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err
    await auth.createUser({ uid, email, password: QA_PASSWORD, displayName: name })
  }
  // Exactly what `shops:create` in cli/lib.mjs sets, and what firestore.rules reads.
  await auth.setCustomUserClaims(uid, { shopId: name, paidUntil })
  return { uid, email }
}

function paidUntilFor(plan) {
  if (plan === 'active') return FAR_FUTURE
  // Past the deadline but inside the grace window: banner shows, writes still work.
  if (plan === 'lapsed') return Date.now() - 2 * DAY
  // Past the grace window too: the rules refuse every write (what shops:suspend does).
  if (plan === 'blocked') return Date.now() - RULES_GRACE_MS - DAY
  throw new Error(`Unknown --plan "${plan}" (active | lapsed | blocked)`)
}

/**
 * Programmatic entry point: `await seedShop('qa-foo')`.
 * Returns { email, password, uid, shopId, paidUntil, summary }.
 */
export async function seedShop(name, { plan = 'active', empty = false } = {}) {
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(name)) {
    throw new Error(`Shop name "${name}" must be lowercase letters, digits and dashes (2–41 chars).`)
  }
  assertLocal()
  const db = getFirestore(app())
  const auth = getAuth(app())
  const paidUntil = paidUntilFor(plan)

  // Wipe this shop only.
  await db.recursiveDelete(db.collection('shops').doc(name))

  const { uid, email } = await ensureUser(auth, name, paidUntil)

  const now = Date.now()
  await db.collection('shops').doc(name).set({
    name: `Librairie QA · ${name}`,
    email,
    uid,
    plan: 'standard',
    paidUntil,
    createdAt: now,
    updatedAt: now,
  })

  const built = buildShop(name, mulberry32(hash(name)))
  const docs = empty ? built.docs.filter(([col]) => col === 'settings') : built.docs

  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch()
    for (const [col, id, data] of docs.slice(i, i + 400)) {
      batch.set(db.collection('shops').doc(name).collection(col).doc(id), data)
    }
    await batch.commit()
  }

  if (!empty) {
    const batch = db.batch()
    for (const { code, ...entry } of built.catalog) {
      batch.set(db.collection('catalog').doc(code), {
        ...entry,
        nameLower: foldName(entry.name),
        by: 'qa-seed',
        confirms: 0,
        createdAt: now,
      })
    }
    await batch.commit()
  }

  return {
    email,
    password: QA_PASSWORD,
    uid,
    shopId: name,
    plan,
    paidUntil,
    summary: empty ? { empty: true } : built.summary,
  }
}

/** Empties both emulators completely (every shop, every account, the catalogue). */
export async function wipeAll() {
  assertLocal()
  const fs = process.env.FIRESTORE_EMULATOR_HOST
  const au = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const r1 = await fetch(
    `http://${fs}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  const r2 = await fetch(`http://${au}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' })
  if (!r1.ok || !r2.ok) throw new Error(`wipe failed: firestore ${r1.status}, auth ${r2.status}`)
}

export { SHOP_COLLECTIONS }

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const args = process.argv.slice(2)
  const flag = (f) => args.includes(f)
  const value = (f) => {
    const i = args.indexOf(f)
    return i >= 0 ? args[i + 1] : undefined
  }
  try {
    if (flag('--wipe-all')) {
      await wipeAll()
      console.log('emulators wiped (all Firestore documents, all Auth accounts)')
      process.exit(0)
    }
    const name = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--plan')
    if (!name || flag('--help') || flag('-h')) {
      console.log(
        'usage: node scripts/qa/seed.mjs <name> [--plan active|lapsed|blocked] [--empty]\n' +
          '       node scripts/qa/seed.mjs --wipe-all',
      )
      process.exit(name || flag('--help') || flag('-h') ? 0 : 1)
    }
    const out = await seedShop(name, { plan: value('--plan') ?? 'active', empty: flag('--empty') })
    console.log(JSON.stringify(out, null, 2))
    process.exit(0)
  } catch (err) {
    const msg = String(err?.message ?? err)
    if (/ECONNREFUSED|UNAVAILABLE|fetch failed/.test(msg)) {
      console.error('Emulators are not reachable. Start them first:  bash scripts/qa/up.sh')
    }
    console.error(msg)
    process.exit(1)
  }
}
