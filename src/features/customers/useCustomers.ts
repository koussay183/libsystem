import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  increment,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createLiveCollection } from '@/lib/liveCollection'
import type { Customer, CreditEntry } from '@/types/models'

const CUSTOMERS = 'customers'
const ENTRIES = 'credit_entries'

export interface CustomerInput {
  name: string
  phone?: string
  note?: string
}

/** Live list of all customers, ordered by name — one shared subscription. */
const customersStore = createLiveCollection<Customer>(() =>
  query(collection(db, CUSTOMERS), orderBy('name')),
)

export function useCustomers() {
  const state = useSyncExternalStore(
    customersStore.subscribe,
    customersStore.getSnapshot,
    customersStore.getSnapshot,
  )
  return { customers: state.data, loading: state.loading, error: state.error }
}

/** Live single customer document. */
export function useCustomer(id: string | undefined) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    return onSnapshot(
      doc(db, CUSTOMERS, id),
      (snap) => {
        setCustomer(
          snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Customer, 'id'>) } : null,
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [id])

  return { customer, loading, error }
}

/**
 * Live ledger for one customer. Uses only an equality filter (no composite
 * index needed) and sorts by date on the client.
 */
export function useCustomerLedger(id: string | undefined) {
  const [entries, setEntries] = useState<CreditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    const q = query(collection(db, ENTRIES), where('customerId', '==', id))
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CreditEntry, 'id'>),
        }))
        rows.sort((a, b) => b.date - a.date)
        setEntries(rows)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [id])

  return { entries, loading, error }
}

/**
 * Every ledger line in the shop, newest first.
 *
 * The carnet index has to answer "since when does he owe?" and "when did he
 * last pay anything?" for each client at once, and neither can be read off the
 * customer document — they only fall out of replaying the history. One live
 * subscription for the whole collection is far cheaper than one per client.
 * The cap keeps a very old shop from loading its entire life on every visit;
 * it is generous enough that in practice nothing is ever cut.
 */
export function useAllCreditEntries(max = 3000) {
  const [entries, setEntries] = useState<CreditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, ENTRIES), orderBy('date', 'desc'), limit(max))
    return onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CreditEntry, 'id'>) })),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [max])

  return { entries, loading, error }
}

export async function createCustomer(input: CustomerInput): Promise<string> {
  const now = Date.now()
  const ref = await addDoc(collection(db, CUSTOMERS), {
    name: input.name,
    phone: input.phone || undefined,
    note: input.note || undefined,
    balance: 0,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function updateCustomer(id: string, input: CustomerInput) {
  // deleteField() removes a cleared optional field. Plain undefined would be
  // silently ignored (db is created with ignoreUndefinedProperties), leaving
  // the stale value in place.
  await updateDoc(doc(db, CUSTOMERS, id), {
    name: input.name,
    phone: input.phone ? input.phone : deleteField(),
    note: input.note ? input.note : deleteField(),
    updatedAt: Date.now(),
  })
}

/** Thrown when a delete would erase a debt instead of settling it. */
export class OutstandingBalanceError extends Error {
  constructor(public balance: number) {
    super('removeCustomer: customer still owes money')
    this.name = 'OutstandingBalanceError'
  }
}

/**
 * Deletes the customer and all of their ledger entries. Entries are removed in
 * chunks so we never exceed Firestore's hard limit of 500 writes per batch.
 *
 * Refuses outright while the account is not settled. Deleting a debtor makes
 * the money owed disappear from the books with no trace — the owner must
 * record the payment (or write the debt off explicitly) first. The balance is
 * re-read here rather than trusted from the list, so a debit that landed a
 * second ago still blocks the delete.
 */
export async function removeCustomer(id: string) {
  const snap = await getDoc(doc(db, CUSTOMERS, id))
  const balance = snap.exists() ? ((snap.data() as Customer).balance ?? 0) : 0
  if (balance !== 0) throw new OutstandingBalanceError(balance)

  const entries = await getDocs(
    query(collection(db, ENTRIES), where('customerId', '==', id)),
  )
  const refs = entries.docs.map((d) => d.ref)
  const CHUNK = 450
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db)
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
  const finalBatch = writeBatch(db)
  finalBatch.delete(doc(db, CUSTOMERS, id))
  await finalBatch.commit()
}

/**
 * Adds a ledger entry and adjusts the customer's balance atomically.
 * debit = customer took goods on credit (+balance).
 * payment = customer paid money back (-balance).
 *
 * The line and the balance move in ONE batch on purpose: a carnet where the
 * lines and the total can disagree is worse than no carnet at all. Either both
 * land or neither does.
 */
export async function addCreditEntry(
  customerId: string,
  type: 'debit' | 'payment',
  amountMinor: number,
  label?: string,
) {
  // Amounts are stored positive and the direction lives in `type`. A zero or
  // negative amount would silently corrupt the running balance.
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('addCreditEntry: amount must be a positive integer of millimes')
  }
  const now = Date.now()
  const batch = writeBatch(db)
  batch.set(doc(collection(db, ENTRIES)), {
    customerId,
    type,
    amount: amountMinor,
    label: label || undefined,
    date: now,
    createdAt: now,
  })
  const delta = type === 'debit' ? amountMinor : -amountMinor
  batch.update(doc(db, CUSTOMERS, customerId), {
    balance: increment(delta),
    updatedAt: now,
  })
  await batch.commit()
}
