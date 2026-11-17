/**
 * The backup vault: restore points kept ON THIS MACHINE, in IndexedDB.
 *
 * Zero infrastructure on purpose. Every shop already runs a browser on the
 * till PC with gigabytes of quota; storing a few compressed copies of its own
 * books there costs us nothing, keeps working with the line down, and survives
 * the one disaster the cloud copy does not cover — a mistake by the owner
 * (a mass delete, a bad restore) that Firestore faithfully replicates.
 *
 * What it does NOT survive is the PC itself dying or the browser profile being
 * wiped. That is what the folder copy (autoBackup.ts, a USB key or Documents)
 * and the downloaded file are for. The panel says so.
 *
 * Three object stores, kept apart so that listing restore points never pulls
 * megabytes of payload into memory:
 *   snapshots — small metadata per restore point (date, counts, carnet totals)
 *   payloads  — the compressed backup file itself, same key
 *   meta      — the per-shop mirror used for cheap delta syncs, and the folder
 *               handle the owner picked
 */
import dayjs from 'dayjs'
import type { BackupFile } from './backupService'
import type { CarnetSummary } from './carnet'

const DB_NAME = 'lib-backup'
const DB_VERSION = 1
const SNAPSHOTS = 'snapshots'
const PAYLOADS = 'payloads'
const META = 'meta'

export interface SnapshotMeta {
  /** `${shopId}|${at}` — sorts by shop, then by time. */
  key: string
  shopId: string
  /** When the data was read from the server. */
  at: number
  /** Last time a sync found exactly this content again (dedupe). */
  checkedAt: number
  /** SHA-256 over the collections — identical days share one restore point. */
  hash: string
  counts: Record<string, number>
  total: number
  /** Stored (compressed) size in bytes. */
  bytes: number
  source: 'auto' | 'manual'
  carnet: CarnetSummary
}

interface PayloadRecord {
  key: string
  gz: boolean
  data: ArrayBuffer | string
}

let opening: Promise<IDBDatabase> | null = null

export function vaultSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

function open(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        db.createObjectStore(SNAPSHOTS, { keyPath: 'key' }).createIndex('shopId', 'shopId')
      }
      if (!db.objectStoreNames.contains(PAYLOADS)) db.createObjectStore(PAYLOADS, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    r.onsuccess = () => {
      const db = r.result
      // Another tab upgrading must not be blocked by this one.
      db.onversionchange = () => {
        db.close()
        opening = null
      }
      resolve(db)
    }
    r.onerror = () => {
      opening = null
      reject(r.error)
    }
  })
  return opening
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error)
  })
}

function result<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

// ------------------------------------------------------------------ meta ---

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return (await result(db.transaction(META).objectStore(META).get(key))) as T | undefined
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await open()
  const tx = db.transaction(META, 'readwrite')
  tx.objectStore(META).put(value, key)
  await done(tx)
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await open()
  const tx = db.transaction(META, 'readwrite')
  tx.objectStore(META).delete(key)
  await done(tx)
}

// ----------------------------------------------------------- compression ---

/**
 * gzip through the browser's own CompressionStream. A shop's JSON is mostly
 * repeated field names, so it shrinks about tenfold. Where the API is missing
 * (old Safari) the text is stored as is — bigger, never lost.
 */
async function pack(text: string): Promise<Omit<PayloadRecord, 'key'>> {
  if (typeof CompressionStream === 'undefined') return { gz: false, data: text }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return { gz: true, data: await new Response(stream).arrayBuffer() }
}

async function unpack(p: PayloadRecord): Promise<string> {
  if (!p.gz) return p.data as string
  const stream = new Blob([p.data as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    // Not a secure context (should not happen on https). A cheap FNV-1a keeps
    // dedupe working; collisions only cost an extra restore point.
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
    return `fnv-${(h >>> 0).toString(16)}-${text.length}`
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// ------------------------------------------------------------- snapshots ---

export async function listSnapshots(shopId: string): Promise<SnapshotMeta[]> {
  const db = await open()
  const all = (await result(
    db.transaction(SNAPSHOTS).objectStore(SNAPSHOTS).index('shopId').getAll(shopId),
  )) as SnapshotMeta[]
  return all.sort((a, b) => b.at - a.at)
}

export async function readSnapshot(key: string): Promise<BackupFile | null> {
  const db = await open()
  const p = (await result(db.transaction(PAYLOADS).objectStore(PAYLOADS).get(key))) as
    | PayloadRecord
    | undefined
  if (!p) return null
  return JSON.parse(await unpack(p)) as BackupFile
}

/** Marks an existing restore point as "still exactly this" without a new copy. */
export async function touchSnapshot(meta: SnapshotMeta, at: number): Promise<void> {
  const db = await open()
  const tx = db.transaction(SNAPSHOTS, 'readwrite')
  tx.objectStore(SNAPSHOTS).put({ ...meta, checkedAt: at })
  await done(tx)
}

export async function saveSnapshot(
  meta: Omit<SnapshotMeta, 'key' | 'bytes'>,
  json: string,
): Promise<SnapshotMeta> {
  const payload = await pack(json)
  const key = `${meta.shopId}|${String(meta.at).padStart(15, '0')}`
  const bytes = typeof payload.data === 'string' ? payload.data.length : payload.data.byteLength
  const full: SnapshotMeta = { ...meta, key, bytes }
  const db = await open()
  const tx = db.transaction([SNAPSHOTS, PAYLOADS], 'readwrite')
  tx.objectStore(PAYLOADS).put({ key, ...payload })
  tx.objectStore(SNAPSHOTS).put(full)
  await done(tx)
  return full
}

async function deleteSnapshots(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const db = await open()
  const tx = db.transaction([SNAPSHOTS, PAYLOADS], 'readwrite')
  for (const key of keys) {
    tx.objectStore(SNAPSHOTS).delete(key)
    tx.objectStore(PAYLOADS).delete(key)
  }
  await done(tx)
}

/**
 * Grandfather-father-son retention: the newest point of each of the last 7
 * days, of each of the last 5 weeks, of each of the last 12 months — about 24
 * restore points covering a year, a few megabytes in all. The newest three are
 * always kept whatever their dates, so a burst of manual exports never deletes
 * the point taken just before them.
 */
export function chooseToDelete(points: SnapshotMeta[], now = Date.now()): string[] {
  const sorted = [...points].sort((a, b) => b.at - a.at)
  const keep = new Set<string>()
  const seen = { day: new Set<string>(), week: new Set<string>(), month: new Set<string>() }
  sorted.forEach((p, i) => {
    if (i < 3) keep.add(p.key)
    const d = dayjs(p.at)
    const age = now - p.at
    const DAY = 86_400_000
    const rules: [keyof typeof seen, string, number][] = [
      ['day', d.format('YYYY-MM-DD'), 7 * DAY],
      ['week', d.startOf('week').format('YYYY-MM-DD'), 35 * DAY],
      ['month', d.format('YYYY-MM'), 366 * DAY],
    ]
    for (const [tier, bucket, maxAge] of rules) {
      if (age <= maxAge && !seen[tier].has(bucket)) {
        seen[tier].add(bucket)
        keep.add(p.key)
      }
    }
  })
  return sorted.filter((p) => !keep.has(p.key)).map((p) => p.key)
}

export async function prune(shopId: string): Promise<void> {
  await deleteSnapshots(chooseToDelete(await listSnapshots(shopId)))
}

/**
 * Asks the browser not to evict this origin's storage under disk pressure.
 * Chrome grants it silently to an installed or often-used app; a refusal
 * changes nothing except that the browser keeps the right to clear it.
 */
export async function askPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
