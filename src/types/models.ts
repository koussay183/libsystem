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

  /** What the shop pays (millimes). */
  costPrice: number
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

/** Shop identity printed on the ticket. Stored as settings/shop. */
export interface ShopSettings {
  name: string
  address?: string
  phone?: string
  taxId?: string
  footer?: string
}
