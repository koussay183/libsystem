import {
  collection,
  getDocs,
  getDocsFromCache,
  doc,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QuerySnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'
import { track } from '@/lib/syncStatus'
import { withDeadline } from '@/lib/deadline'

/** Every collection the app owns — the whole shop lives in these. */
export const BACKUP_COLLECTIONS = [
  'products',
  // Without this line the owner's packs are silently absent from the one
  // artefact that survives losing the account.
  'packs',
  'categories',
  'suppliers',
  'customers',
  'credit_entries',
  'sales',
  'purchases',
  // The shop identity printed on every ticket — losing it in a restore would
  // silently reset the receipt header.
  'settings',
] as const

export type BackupRow = Record<string, unknown> & { id: string }

export interface BackupFile {
  app: 'lib-manager'
  /**
   * Deliberately still 1. The two fields below are additive and optional, so a
   * file written by this build restores unchanged in an older one, and a file
   * written by an older build restores here — see isBackupFile() and
   * summarise(), both of which treat their absence as "nothing to report".
   */
  version: 1
  exportedAt: string
  /**
   * The export could not be confirmed against the server for at least one
   * collection and MAY THEREFORE BE INCOMPLETE.
   *
   * This is the whole reason the field exists. Offline, Firestore answers a
   * read from the local cache, and the cache holds only what this device has
   * actually seen and still keeps: liveCollection unpins its listener 30 s
   * after the last unmount, several raw onSnapshot hooks drop their target the
   * moment they unmount, and the SDK's 40 MB LRU evicts anything unpinned. So
   * an export taken with the line down can be missing whole collections, or
   * the older half of the sales, and still look like a perfectly good file.
   * This file is the shop's last line of defence on the day the account is
   * lost; it is not allowed to overstate what it holds.
   */
  fromCache?: boolean
  /** Exactly which collections came from the cache rather than the server. */
  cachedCollections?: string[]
  collections: Record<string, BackupRow[]>
}

/**
 * How long the WHOLE export may spend waiting for the server, across all
 * collections put together.
 *
 * A budget rather than a per-collection timeout, because the failure this
 * guards is a dead line that still reads as `navigator.onLine === true` (a
 * powered ADSL router with no uplink, a captive portal): there the RPC does not
 * refuse, it stalls, and nine collections at ten seconds each is a two-minute
 * spinner on a screen the owner pressed to feel safe. One collection failing
 * to reach the server means they all will, so the first stall spends the whole
 * budget and every remaining collection is read straight from the cache.
 *
 * Set above the SDK's own ~10 s online-state timeout on purpose: normally
 * Firestore notices it is offline first and hands getDocs the cached snapshot
 * itself, correctly flagged fromCache, and this deadline never fires. It is the
 * backstop for the case where it does not.
 */
const SERVER_BUDGET_MS = 12_000

function rowsOf(snap: QuerySnapshot<DocumentData>): BackupRow[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BackupRow)
}

/*
  withDeadline lives in src/lib/deadline.ts. It was written here first, then the
  customer-delete path in useCustomers.ts turned out to need exactly the same
  bound for exactly the same reason — an awaited read that stalls on a dead
  uplink instead of falling back to the cache — so it moved rather than being
  copied. Two copies of a rule about how long to wait is how they drift apart;
  the three copies of "zero renders as an empty field" that bug 5.10 was are the
  precedent.

  It never rejects, deliberately: the caller's next move is the same either way,
  ask the cache, and a rejection here would abort an export the owner can still
  be given.
*/

/**
 * Reads every collection into a single portable object, and records where each
 * answer came from.
 *
 * IT USED TO BE A BARE `await getDocs()` PER COLLECTION, which failed two ways
 * at once with the line down: it could stall for minutes on the RPC (see
 * SERVER_BUDGET_MS), and when it did answer from the cache it said nothing
 * about it — so the owner pressed Sauvegarde, received a file, and believed he
 * had his shop in his hand.
 *
 * An offline export is still produced, on purpose: a warned backup beats no
 * backup, and refusing would leave the shop with nothing on exactly the days it
 * is most exposed. What is not allowed is a quiet one.
 */
export async function exportAll(): Promise<BackupFile> {
  const collections: Record<string, BackupRow[]> = {}
  const cachedCollections: string[] = []
  let budget = SERVER_BUDGET_MS

  for (const name of BACKUP_COLLECTIONS) {
    const q = collection(db, shopPath(name))
    let snap: QuerySnapshot<DocumentData> | null = null

    if (budget > 0) {
      const startedAt = Date.now()
      snap = await withDeadline(getDocs(q), budget)
      budget -= Date.now() - startedAt
      // Either the line is down or it is refusing; do not pay for it nine
      // times. The cache answers the rest of the export immediately.
      if (snap === null || snap.metadata.fromCache) budget = 0
    }

    if (snap === null) {
      try {
        snap = await getDocsFromCache(q)
      } catch {
        // A query read from the cache resolves empty rather than throwing, so
        // this is the exotic case (a terminated SDK, no IndexedDB at all).
        // Report the collection as unconfirmed with nothing in it, which is
        // precisely what the file then holds.
        collections[name] = []
        cachedCollections.push(name)
        continue
      }
    }

    collections[name] = rowsOf(snap)
    if (snap.metadata.fromCache) cachedCollections.push(name)
  }

  return {
    app: 'lib-manager',
    version: 1,
    exportedAt: new Date().toISOString(),
    fromCache: cachedCollections.length > 0,
    cachedCollections,
    collections,
  }
}

export function countDocs(backup: BackupFile): number {
  return Object.values(backup.collections).reduce((n, rows) => n + rows.length, 0)
}

/**
 * Whether the file itself admits it may be incomplete.
 *
 * A file written before these fields existed answers false, and that is the
 * only answer available: nothing inside such a file records whether it was
 * taken with a line or without one, and inventing a warning for every old file
 * would train the owner to click past the real one.
 */
export function isPartialBackup(backup: BackupFile): boolean {
  return backup.fromCache === true || partialCollections(backup).length > 0
}

/**
 * The collections a partial backup could not confirm. Empty for an old file.
 *
 * Defensive about the shape because this runs on a file the owner picked off a
 * USB key, straight in the render body of the review dialog — and there is no
 * error boundary anywhere in this app, so a throw here is a blank white screen
 * with no way back.
 */
export function partialCollections(backup: BackupFile): string[] {
  const listed: unknown = backup.cachedCollections
  if (!Array.isArray(listed)) return []
  return listed.filter((name): name is string => typeof name === 'string')
}

/** One line per collection, so a restore can be checked before it happens. */
export function summarise(
  backup: BackupFile,
): { name: string; count: number; fromCache: boolean }[] {
  const cached = new Set(partialCollections(backup))
  return BACKUP_COLLECTIONS.map((name) => ({
    name,
    count: backup.collections[name]?.length ?? 0,
    fromCache: cached.has(name),
  }))
}

/**
 * When a backup was last downloaded, remembered on this machine. A shop that
 * has never been backed up should be told so, loudly and often — the whole
 * point of the feature is the day the account is lost.
 */
const LAST_BACKUP_KEY = 'backup.lastAt'

/**
 * Whether that last backup was the partial, cache-sourced kind. Remembered
 * next to the date because the date alone is a claim of safety: "Dernière
 * sauvegarde : hier" under a green shield is exactly the sentence that must not
 * appear over a file taken with the line down.
 */
const LAST_BACKUP_PARTIAL_KEY = 'backup.lastFromCache'

/** Past this many days without a backup, the screen starts nagging. */
export const STALE_BACKUP_DAYS = 7

export function readLastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY)
    if (!raw) return null
    const at = Number(raw)
    return Number.isFinite(at) && at > 0 ? at : null
  } catch {
    return null
  }
}

export function readLastBackupPartial(): boolean {
  try {
    return localStorage.getItem(LAST_BACKUP_PARTIAL_KEY) === '1'
  } catch {
    return false
  }
}

export function writeLastBackupAt(at: number, partial = false) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(at))
    // Written every time, not only when true: a good backup has to clear the
    // warning a previous partial one left behind.
    localStorage.setItem(LAST_BACKUP_PARTIAL_KEY, partial ? '1' : '0')
  } catch {
    /* private mode — the reminder simply does not persist */
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadJson(backup: BackupFile, filename: string) {
  triggerDownload(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    filename,
  )
}

/** Flattens rows to CSV. Nested values (like sale items) are JSON-encoded. */
export function toCsv(rows: BackupRow[]): string {
  if (rows.length === 0) return ''
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => esc(r[k])).join(',')),
  ].join('\n')
}

/** One CSV per collection. The BOM makes Excel read UTF-8 accents correctly. */
export function downloadCsvFiles(backup: BackupFile) {
  for (const [name, rows] of Object.entries(backup.collections)) {
    if (rows.length === 0) continue
    triggerDownload(
      new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }),
      `${name}.csv`,
    )
  }
}

/**
 * Checks only what a restore actually needs. `fromCache` and
 * `cachedCollections` are deliberately NOT required: every file exported before
 * they existed is still a valid backup, and the day this matters is the day the
 * owner reaches for the oldest file he can find.
 */
export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<BackupFile>
  return v.app === 'lib-manager' && typeof v.collections === 'object' && !!v.collections
}

/**
 * Writes a backup back into Firestore. Documents keep their original ids, so a
 * restore overwrites same-id documents and leaves anything else untouched.
 * Chunked to stay under Firestore's 500-writes-per-batch limit.
 *
 * The commits are NOT awaited. A batch resolves only when the server
 * acknowledges it, so with the line down the promise never settles and never
 * rejects: the restore dialog spun forever while the shop's data had in fact
 * already been written to the local cache and was visible on every screen
 * behind it. The count returned is therefore a count of rows written LOCALLY —
 * durable in IndexedDB, replayed to the server in order on reconnect — and the
 * caller must say so rather than claim an upload it has not seen finish.
 */
export async function restoreAll(backup: BackupFile): Promise<number> {
  let written = 0
  const CHUNK = 400
  for (const [name, rows] of Object.entries(backup.collections)) {
    // The collection name and the row id both become Firestore path segments,
    // and doc() throws SYNCHRONOUSLY on a segment carrying a slash — which,
    // now that the commits are fire-and-forget, would abandon the restore
    // half-queued and report a failure over data that was really written. A
    // hand-edited or truncated file is not worth that.
    if (name === '' || name.includes('/')) continue
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const batch = writeBatch(db)
      let queued = 0
      for (const row of slice) {
        const { id, ...data } = row
        if (typeof id !== 'string' || id === '' || id.includes('/')) continue
        batch.set(doc(db, shopPath(name), id), data)
        queued += 1
      }
      if (queued === 0) continue
      void track(batch.commit()).catch(() => {
        /* replayed by the SDK; a refusal surfaces on the sync badge */
      })
      written += queued
    }
  }
  return written
}
