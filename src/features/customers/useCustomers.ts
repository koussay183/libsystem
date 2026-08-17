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
  getDocFromCache,
  getDocsFromCache,
  setDoc,
  updateDoc,
  doc,
  writeBatch,
  increment,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { createLiveCollection } from '@/lib/liveCollection'
import type { LiveFatalReason } from '@/lib/liveCollection'
import { track } from '@/lib/syncStatus'
import { withDeadline, READ_DEADLINE_MS } from '@/lib/deadline'
import { entryTime } from '@/features/credit/ledger'
import type { Customer, CreditEntry } from '@/types/models'

const CUSTOMERS = 'customers'
const ENTRIES = 'credit_entries'

export interface CustomerInput {
  name: string
  phone?: string
  /** Carte d'identite nationale — what identifies a debtor beyond his name. */
  cin?: string
  note?: string
}

/** Live list of all customers, ordered by name — one shared subscription. */
const customersStore = createLiveCollection<Customer>(() =>
  query(collection(db, shopPath(CUSTOMERS)), orderBy('name')),
)

export function useCustomers() {
  const state = useSyncExternalStore(
    customersStore.subscribe,
    customersStore.getSnapshot,
    customersStore.getSnapshot,
  )
  // `fatal` is forwarded rather than dropped. When the shared listener has given
  // up for good the carnet keeps rendering the last balances it was able to
  // confirm, and a debt read off a frozen snapshot is a debt the owner chases
  // for the wrong amount — the one case where showing stale money silently is
  // worse than saying so. `fatalReason` carries which kind of giving-up it was,
  // because "the line is poor, try again" and "sign in again" are different
  // sentences and the SDK's English error string is not either of them.
  // `retry` rides along for the same reason it does in useProducts: reporting a
  // dead listener without offering to re-arm it leaves the owner nothing but a
  // page reload, and offline a reload is the riskiest thing he can do.
  return {
    customers: state.data,
    loading: state.loading,
    error: state.error,
    fatal: state.fatal,
    fatalReason: state.fatalReason,
    retry: customersStore.retry,
  }
}

/**
 * The give-up on its own, so the app shell can watch this listener without
 * subscribing the navigation to every customer in the carnet. See
 * useProductsFatal in src/features/stock/useProducts.ts for why the snapshot is
 * narrowed to a reason string.
 */
const customersFatal = (): LiveFatalReason | null => {
  const state = customersStore.getSnapshot()
  return state.fatal ? state.fatalReason : null
}

export function useCustomersFatal(): LiveFatalReason | null {
  return useSyncExternalStore(customersStore.subscribe, customersFatal, customersFatal)
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
      doc(db, shopPath(CUSTOMERS), id),
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
    const q = query(collection(db, shopPath(ENTRIES)), where('customerId', '==', id))
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CreditEntry, 'id'>),
        }))
        // Ordered through `entryTime` (ledger.ts) so a line whose `date` did not
        // survive a backup restore cannot make this comparator return NaN — an
        // NaN comparator leaves Array.prototype.sort's ordering
        // implementation-defined, and this list is a statement of debt.
        rows.sort((a, b) => entryTime(b) - entryTime(a))
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
    const q = query(collection(db, shopPath(ENTRIES)), orderBy('date', 'desc'), limit(max))
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

/**
 * The id is minted locally and the write is NOT awaited.
 *
 * With the line down Firestore only resolves a write on server acknowledgement,
 * so awaiting it would hang forever — and this runs in the middle of a sale,
 * where the cashier is adding the client he is about to put the ticket on. The
 * document is durable in IndexedDB the moment setDoc is called, and the live
 * list picks it up from the local cache straight away.
 */
export function createCustomer(input: CustomerInput): string {
  const now = Date.now()
  const ref = doc(collection(db, shopPath(CUSTOMERS)))
  void track(
    setDoc(ref, {
      name: input.name,
      phone: input.phone || undefined,
      cin: input.cin || undefined,
      note: input.note || undefined,
      balance: 0,
      createdAt: now,
      updatedAt: now,
    }),
  ).catch(() => {})
  return ref.id
}

/**
 * Saves the edited identity fields.
 *
 * Queued and NOT awaited, exactly like createCustomer above: Firestore settles a
 * write only on server acknowledgement, so with the line down `await updateDoc`
 * never returns — and it never rejects either, so neither the try/catch nor the
 * `finally setBusy(false)` in CustomerForm.submit can close the dialog. The edit
 * is durable in IndexedDB the moment updateDoc is called and the live list shows
 * it straight away.
 *
 * `balance` is deliberately absent: it belongs to addCreditEntry and recordSale,
 * which move it with increment(). Writing it from a form that captured it when
 * the dialog opened would blind-write a stale total over every ticket rung up on
 * credit in the meantime.
 *
 * The `async` and the Promise are kept on purpose so CustomerForm keeps its
 * `await updateCustomer(...)` and now resolves on the next microtask. Do not
 * "clean this up" by dropping async.
 */
export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  // deleteField() removes a cleared optional field. Plain undefined would be
  // silently ignored (db is created with ignoreUndefinedProperties), leaving
  // the stale value in place.
  void track(
    updateDoc(doc(db, shopPath(CUSTOMERS), id), {
      name: input.name,
      phone: input.phone ? input.phone : deleteField(),
      cin: input.cin ? input.cin : deleteField(),
      note: input.note ? input.note : deleteField(),
      updatedAt: Date.now(),
    }),
  ).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
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
 * The customer's ledger lines could not be read, from the server or the cache,
 * so a delete would have to guess how many there were.
 *
 * Refusing is the conservative half of a choice with no good options. Deleting
 * the customer and leaving his lines behind puts money on the books under a name
 * that no longer appears anywhere, which only a CLI sweep would ever find; this
 * way the owner is told to try again with a line, and nothing is half-done.
 */
export class LedgerUnreadableError extends Error {
  constructor() {
    super('removeCustomer: the ledger could not be read')
    this.name = 'LedgerUnreadableError'
  }
}

/**
 * Deletes the customer and all of their ledger entries. Entries are removed in
 * chunks so we never exceed Firestore's hard limit of 500 writes per batch.
 *
 * Refuses outright while the account is not settled. Deleting a debtor makes
 * the money owed disappear from the books with no trace — the owner must
 * record the payment (or write the debt off explicitly) first. The balance is
 * re-read from the document rather than taken from the list, so a debit that
 * landed a second ago still blocks the delete; the list is consulted only when
 * the document itself comes back missing.
 *
 * The two reads are awaited, and each one is on a DEADLINE. A read is not a
 * server acknowledgement, so it cannot hang for ever the way an awaited write
 * can — but it can hang for a long time, and the reasoning that this was
 * therefore "safe" was too generous. getDoc and getDocs try the server first and
 * only fall back to IndexedDB once the SDK has concluded there is no line. After
 * an afternoon offline it concluded that long ago and the read is instant; on the
 * failure this shop actually has, though — a router up with a dead uplink, where
 * navigator.onLine says everything is fine and packets simply disappear — the
 * conclusion is about ten seconds away, twice, and the Supprimer button does
 * nothing for twenty seconds on a screen where every write now returns at once.
 *
 * So each read gets READ_DEADLINE_MS and then the cache is asked directly. What
 * that preserves is the guard itself: a cached document already carries every
 * increment() this machine has queued, so a debit recorded with no network two
 * minutes ago still blocks the delete — which is precisely what it is for.
 *
 * The commits are queued and NOT awaited. `await batch.commit()` used to sit
 * between the chunks, so with the line down the very first chunk hung, the
 * customer document was never deleted, and CustomerDetailPage.onDelete spun on a
 * promise that never settles and never rejects. The chunks are enqueued in order
 * and the SDK replays them in that order, with the customer document last: if the
 * replay is ever refused it is refused before the owner ends up gone from the
 * carnet while his lines are still on the books.
 */
export async function removeCustomer(id: string) {
  const ref = doc(db, shopPath(CUSTOMERS), id)
  // Server first while there is a line, because it is the freshest answer; the
  // cache when there is not, and the cache read cannot itself stall — it either
  // holds the document or throws immediately.
  const snap =
    (await withDeadline(getDoc(ref), READ_DEADLINE_MS)) ??
    (await getDocFromCache(ref).catch(() => null))
  // A cache miss and an already-deleted customer are indistinguishable from
  // here: both are a non-existent snapshot. Trusting the implied zero would let
  // an evicted document (there is no cacheSizeBytes, so the SDK's 40 MB LRU
  // applies) turn a debtor into a deletable customer, so the resident list gets
  // the last word — it is the same document, and createLiveCollection keeps its
  // final snapshot after the last screen unmounts.
  const listed = customersStore.getSnapshot().data.find((c) => c.id === id)
  const balance =
    snap && snap.exists() ? ((snap.data() as Customer).balance ?? 0) : (listed?.balance ?? 0)
  if (balance !== 0) throw new OutstandingBalanceError(balance)

  // Answered from the cache when there is no line. What the cache cannot return
  // is a ledger line it has already evicted: a line this query misses is not
  // deleted, and outlives the customer as an orphan in `credit_entries` that only
  // a CLI sweep will ever find. That is still the right trade — refusing to
  // delete at all offline would strand the owner — but it is the reason a delete
  // is worth doing while the line is up if there is a choice.
  const ledgerQuery = query(collection(db, shopPath(ENTRIES)), where('customerId', '==', id))
  const entries =
    (await withDeadline(getDocs(ledgerQuery), READ_DEADLINE_MS)) ??
    (await getDocsFromCache(ledgerQuery).catch(() => null))
  // No cache entry for this query either. Deleting the customer while leaving
  // his lines behind would put money on the books under a name that no longer
  // exists, so this stops instead — and says so, rather than half-deleting.
  if (!entries) throw new LedgerUnreadableError()
  const refs = entries.docs.map((d) => d.ref)
  const CHUNK = 450
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db)
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref))
    void track(batch.commit()).catch(() => {
      /* replayed by the SDK; a refusal surfaces through the sync badge */
    })
  }
  const finalBatch = writeBatch(db)
  finalBatch.delete(doc(db, shopPath(CUSTOMERS), id))
  void track(finalBatch.commit()).catch(() => {
    /* replayed by the SDK; a refusal surfaces through the sync badge */
  })
}

/**
 * Adds a ledger entry and adjusts the customer's balance atomically.
 * debit = customer took goods on credit (+balance).
 * payment = customer paid money back (-balance).
 *
 * The line and the balance move in ONE batch on purpose: a carnet where the
 * lines and the total can disagree is worse than no carnet at all. Either both
 * land or neither does.
 *
 * The commit is queued and NOT awaited, and of all the writes in this app this is
 * the one where awaiting cost the most. Firestore settles a commit only when the
 * server acknowledges it, so with the line down `await batch.commit()` never
 * returns — and it never rejects either, so neither the try/catch nor the
 * `finally setBusy(false)` in CreditEntryForm.submit can end it. What the owner
 * saw was a spinner that would not stop over money a named human being owes him.
 * What he does about that is dismiss the dialog (Escape and the backdrop close it
 * through onOpenChange, which is not gated on `busy`) and type the twenty dinars
 * again — and both commits are durable, both replay, and the client now owes
 * forty with nothing in the data to say which line was the mistake. Resolving on
 * the next microtask closes the dialog the instant the line is safe on the
 * machine, which is what removes the reason to retry.
 *
 * Nothing here computes the new balance, and nothing here may start to. The SDK
 * applies `increment(delta)` to the cached customer document the moment commit()
 * is called, so the figure useCustomer renders immediately afterwards is
 * Firestore's own arithmetic on the local copy and is exactly what the server
 * will replay onto the same base. A hand-computed `balance: previous + delta`
 * would be a blind absolute write instead, and would wipe out every credit
 * ticket the till queued between the dialog opening and this commit.
 *
 * The `async` keyword and the Promise return type are kept deliberately even
 * though nothing is awaited inside: CreditEntryForm keeps its
 * `await addCreditEntry(...)`, and the amount check below still rejects rather
 * than throwing synchronously. Do not "clean this up" by dropping async.
 */
export async function addCreditEntry(
  customerId: string,
  type: 'debit' | 'payment',
  amountMinor: number,
  label?: string,
): Promise<void> {
  // Amounts are stored positive and the direction lives in `type`. A zero or
  // negative amount would silently corrupt the running balance.
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('addCreditEntry: amount must be a positive integer of millimes')
  }
  // Both stamps are local clock values, never serverTimestamp(): a sentinel reads
  // back as null while the document is still queued, and ledger.ts orders the
  // whole carnet on `date`. See the note on entryTime() there before changing it.
  const now = Date.now()
  const batch = writeBatch(db)
  // The id is minted locally by doc() with no round trip, so the line exists on
  // this machine before commit() is even called.
  batch.set(doc(collection(db, shopPath(ENTRIES))), {
    customerId,
    type,
    amount: amountMinor,
    label: label || undefined,
    date: now,
    createdAt: now,
  })
  const delta = type === 'debit' ? amountMinor : -amountMinor
  batch.update(doc(db, shopPath(CUSTOMERS), customerId), {
    balance: increment(delta),
    updatedAt: now,
  })
  void track(batch.commit()).catch(() => {
    /* replayed by the SDK, in order; a refusal surfaces through the sync badge */
  })
}
