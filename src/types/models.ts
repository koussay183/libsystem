/**
 * Firestore data model. All money fields are integer minor units (millimes) —
 * see src/lib/money.ts. Timestamps are epoch milliseconds (number).
 *
 * Collections:
 *   products        — the stock
 *   categories      — managed product categories
 *   suppliers       — managed suppliers (fournisseurs)
 *   customers       — people who buy on credit
 *   credit_entries  — ledger lines per customer
 *   purchases       — stock bought in / factures d'achat
 *   sales           — sales / factures de vente
 *   packs           — bundles of products sold together at one price
 *   settings        — single doc "shop": the shop identity printed on tickets
 */

export interface Category {
  id: string
  name: string
  createdAt: number
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  note?: string
  createdAt: number
  updatedAt: number
}

export interface Product {
  id: string
  /** Scanned or typed barcode. May be null for hand-added items. */
  barcode: string | null
  /** Full display name, e.g. "Stylo Bic — Bleu". Always what the till shows. */
  name: string
  category?: string
  supplier?: string

  /**
   * Variants: one real pen comes in several kinds. Each kind stays its own
   * document (its own barcode, price, stock and profit), and `family` is what
   * groups them in the stock list. `variant` is the kind on its own ("Bleu").
   */
  family?: string
  variant?: string
  /** What one unit is: pièce, paquet, boîte… Display only. */
  unit?: string

  /**
   * The three prices, all in millimes.
   *
   * `costPriceHT` is what the supplier's invoice says before tax, `vatRate` is
   * the rate that applies to this article (7% or 19% in Tunisia), and
   * `costPrice` is the two of them combined — what the shop actually pays. Only
   * `costPrice` is used for profit, everywhere, which is why it stays the
   * required field: articles entered before the HT/TVA split simply have no
   * `costPriceHT` and nothing about their figures changes.
   */
  costPriceHT?: number
  /** VAT rate on the purchase, in percent (0, 7 or 19). */
  vatRate?: number
  /** What the shop pays, tax included (millimes). */
  costPrice: number
  /**
   * Margin taken on `costPrice`, in percent. Filled in from the shop's default
   * (or the category's) and freely overridden — it is what makes the sale price
   * compute itself instead of being worked out on paper every time.
   */
  margin?: number
  /** What the shop sells for (millimes). */
  salePrice: number
  /** Current units in stock. */
  quantity: number
  /** Alert when quantity <= this. */
  lowStockThreshold: number

  /**
   * Running lifetime totals, incremented atomically on every sale/purchase.
   * This is what makes "how much did I sell/buy of this, is it worth it?"
   * instant instead of scanning every ticket. Optional because documents
   * created before this existed simply have no value yet.
   *
   * A refund decrements them (negative increment), so they stay truthful.
   */
  soldQty?: number
  /** Revenue collected for this product, millimes. */
  soldRevenue?: number
  /** Cost of goods sold for this product, millimes (for profit). */
  soldCost?: number
  boughtQty?: number
  /** Total spent restocking this product, millimes. */
  boughtCost?: number
  /** When this product last sold — drives the "dead stock" report. */
  lastSoldAt?: number

  createdAt: number
  updatedAt: number
}

/** Product without server-managed fields — what a form produces. */
export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

export interface Customer {
  id: string
  name: string
  phone?: string
  /**
   * Carte d'identite nationale. Two clients in a small town genuinely share a
   * name, and the shop settles its carnet on that number — so it is what tells
   * one Mohamed Ali apart from the other when the debt is called in.
   */
  cin?: string
  note?: string
  /** Outstanding balance in millimes (positive = customer owes the shop). */
  balance: number
  createdAt: number
  updatedAt: number
}

export interface CreditEntry {
  id: string
  customerId: string
  /** debit = took goods on credit; payment = paid money back. */
  type: 'debit' | 'payment'
  /** Positive amount in millimes. */
  amount: number
  label?: string
  /** Set when the line came from a till ticket, so the carnet can link back. */
  saleId?: string
  ticketNo?: string
  date: number
  createdAt: number
}

export interface PurchaseItem {
  productId?: string
  name: string
  qty: number
  unitCost: number
}

export interface Purchase {
  id: string
  supplier?: string
  reference?: string
  date: number
  /** Total spent in millimes. */
  total: number
  /**
   * What the shop has actually paid this supplier so far (millimes).
   * total - paid = what is still owed on this facture d'achat.
   */
  paid: number
  items?: PurchaseItem[]
  note?: string
  createdAt: number
  updatedAt?: number
}

/** How the client settled the ticket. */
export type PaymentMode = 'paid' | 'credit' | 'partial'

export interface SaleItem {
  /** null for a free "article divers" line that is not in the stock. */
  productId: string | null
  name: string
  /** Negative on a return line — the maths and the stock then reverse. */
  qty: number
  unitPrice: number
  unitCost: number
}

export interface Sale {
  id: string
  /** Human-readable ticket reference, e.g. "260721-143512". */
  ticketNo: string
  date: number
  /** Net total in millimes, after any discount. Negative on a pure refund. */
  total: number
  /** Sum of the lines before the whole-ticket discount. */
  subtotal?: number
  /** Whole-ticket discount in millimes. */
  discount?: number
  /** Amount actually received now (rest goes on the client's account). */
  paid: number
  /** Cash handed over, when it was more than the total — for the change line. */
  received?: number
  mode: PaymentMode
  onCredit: boolean
  customerId?: string | null
  /** Denormalised so old tickets still read correctly if a client is deleted. */
  customerName?: string | null
  /** A till ticket, or a proper facture de vente (wholesale). */
  kind?: 'ticket' | 'invoice'
  /** True when the ticket contains at least one return line. */
  hasReturn?: boolean
  items: SaleItem[]
  createdAt: number
}

/** One article inside a pack, and how many of it the pack contains. */
export interface PackItem {
  productId: string
  /**
   * Denormalised: a pack has to keep reading correctly on an old ticket even
   * after the article has been renamed or removed from the stock.
   */
  name: string
  qty: number
}

/**
 * Several articles sold together for one price — the "pack rentrée": three
 * notebooks, two pens and a bag for 25 DT.
 *
 * The pack is NOT a product: it holds no stock of its own and never appears in
 * the profitability report. At the till it becomes one line per article, priced
 * so the lines add up to the pack price, so the stock and the per-article
 * profit stay exactly as truthful as on any other ticket.
 */
export interface Pack {
  id: string
  name: string
  /** Optional, so a printed pack label can be scanned like any article. */
  barcode?: string | null
  /** What the client pays for the whole pack, in millimes. */
  price: number
  items: PackItem[]
  /** A seasonal pack is switched off rather than deleted. */
  active: boolean
  createdAt: number
  updatedAt: number
}

/** Pack without the server-managed fields — what the form produces. */
export type PackInput = Omit<Pack, 'id' | 'createdAt' | 'updatedAt'>

/**
 * A service the shop performs rather than an article it stocks: photocopying,
 * printing, binding.
 *
 * There is nothing to count and no purchase price — the price is whatever the
 * job came to, and the cashier types it once the work is done. The shop prints
 * `code` as a QR label, sticks it next to the machine, and scans it with the
 * same hand reader it uses for books.
 */
export interface QuickService {
  id: string
  /** What the cashier and the ticket see: "Photocopie". */
  name: string
  /** What the QR label carries. Matched ignoring case and accents. */
  code: string
  /** A common price for this job, offered as one tap. Millimes. */
  defaultPrice?: number
  /** A service that is not on offer today is switched off, not deleted. */
  active?: boolean
}

/** Shop identity printed on the ticket. Stored as settings/shop. */
export interface ShopSettings {
  name: string
  address?: string
  phone?: string
  taxId?: string
  footer?: string
  /** Margin applied to a new article when its category says nothing, percent. */
  defaultMargin?: number
  /**
   * Margin per category, percent — paper goods carry less than the rest, and
   * the owner should never have to remember which is which.
   */
  categoryMargins?: Record<string, number>
  /** VAT rate pre-selected on a new article, percent. */
  defaultVat?: number
  /**
   * How prices are written and typed throughout the app: 10,500 DT, or
   * 10 500 millimes. Display only — money is stored as integer millimes
   * either way. Kept on the shop document so it follows the shop to its
   * other machine.
   */
  moneyMode?: 'dinar' | 'millime'
  /**
   * Services sold by scanning a printed QR label. Kept on the shop document
   * rather than in a collection of their own: there are a handful of them, the
   * settings are already subscribed to on every page, and this way they ride
   * along in the backup with everything else.
   */
  services?: QuickService[]
}
