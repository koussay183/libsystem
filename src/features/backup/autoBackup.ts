/**
 * Automatic backup — runs by itself on the shop's own PC, costs us nothing.
 *
 * WHAT HAPPENS, once a day, with nobody pressing anything:
 *   1. The shop's data is brought up to date against the SERVER (never the
 *      cache: a restore point has to be something we know is complete).
 *   2. A compressed restore point is stored in this browser (vault.ts), and
 *      old ones are thinned out to ~24 points covering a year.
 *   3. If the owner picked a folder once (a USB key, Documents, a synced
 *      Google Drive / OneDrive folder), a plain JSON backup and a readable
 *      carnet-de-crédit spreadsheet are written there too. That copy survives
 *      the browser, the PC's Windows reinstall, and our servers.
 *
 * WHY IT IS CHEAP — reads are what Firestore bills, so the sync reads as little
 * as it can while still being proven complete:
 *   - Small collections (settings, categories, suppliers, packs…) are re-read
 *     whole: a few hundred reads, not worth being clever about.
 *   - Big ones (products, sales, credit lines) are fetched as a DELTA: only
 *     documents created or updated since the last sync, minus a 3-day overlap
 *     for clocks and for tills that sync late, merged into the copy kept here.
 *   - Each delta is then proven with one count() aggregation (1 read per 1000
 *     documents): if the server holds a different number than the merged copy
 *     — a deletion, a write stamped too far in the past — that collection is
 *     re-read in full right away.
 *   - Once a week everything is re-read in full regardless, which bounds any
 *     drift the count cannot see (an old document edited by a till that was
 *     offline for more than the overlap).
 *   For a shop with 10 000 documents this is ~10 000 reads once a week and a
 *   few hundred on other days, against 70 000 for a naive daily export.
 *
 * Only ONE tab runs it (Web Locks), it starts a minute and a half after the
 * app opens so the till is never slowed down at opening, and it retries every
 * half hour while the line is down.
 */
import {
  collection,
  getCountFromServer,
  getDocsFromServer,
  query,
  where,
} from 'firebase/firestore'
import type { DocumentData, QuerySnapshot } from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'
import { currentShopId, hasShop } from '@/lib/tenant'
import { withDeadline } from '@/lib/deadline'
import {
  BACKUP_COLLECTIONS,
  countDocs,
  writeLastBackupAt,
} from './backupService'
import type { BackupFile, BackupRow } from './backupService'
import { carnetCsv, checkCarnet } from './carnet'
import {
  askPersistentStorage,
  getMeta,
  listSnapshots,
  prune,
  putMeta,
  deleteMeta,
  saveSnapshot,
  sha256,
  touchSnapshot,
  vaultSupported,
} from './vault'
import type { SnapshotMeta } from './vault'

const DAY = 86_400_000
/** A new restore point at most this often. Under 24 h so it drifts earlier, not later. */
const EVERY_MS = 20 * 60 * 60 * 1000
/** Full re-read of every collection at least this often. */
const FULL_EVERY_MS = 7 * DAY
/** How far back a delta reaches before the last sync. */
const OVERLAP_MS = 3 * DAY
/** Below this many documents, a collection is simply re-read whole. */
const SMALL = 300
/** Per server read. Generous: this runs in the background, nobody is waiting. */
const READ_DEADLINE_MS = 25_000
const FIRST_RUN_DELAY_MS = 90_000
const TICK_MS = 30 * 60_000
/** How many daily files are kept in the owner's folder. */
const FOLDER_KEEP = 30
const FOLDER_FILE = /^librairie-sauvegarde-(\d{4}-\d{2}-\d{2})\.json$/

// --------------------------------------------------------- folder (FSA) ---

/** The parts of the File System Access API used here; not in TS's DOM lib yet. */
interface DirHandle {
  name: string
  kind: 'directory'
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>
  }>
  removeEntry(name: string): Promise<void>
  keys(): AsyncIterableIterator<string>
}

type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle>
}

export function folderSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function'
}

const mirrorKey = (shop: string) => `mirror|${shop}`
const folderKey = (shop: string) => `folder|${shop}`
const LS_LAST = (shop: string) => `backup.auto.lastAt.${shop}`
const LS_FOLDER_LAST = (shop: string) => `backup.auto.folderAt.${shop}`
const LS_OFF = (shop: string) => `backup.auto.off.${shop}`

// ---------------------------------------------------------------- state ---

export type FolderState = { name: string; permission: PermissionState } | null

export interface AutoBackupState {
  shopId: string
  enabled: boolean
  running: boolean
  /** Last restore point stored on this machine. */
  lastAt: number | null
  /** Last copy written to the owner's folder. */
  folderLastAt: number | null
  folder: FolderState
  /** 'offline' or an error message from the last attempt, cleared on success. */
  lastError: string | null
  points: SnapshotMeta[]
  /** Reads spent by the last run — shown nowhere, logged for us. */
  lastReads: number | null
}

const readNum = (key: string): number | null => {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}
const writeLs = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

function initial(shopId: string): AutoBackupState {
  return {
    shopId,
    enabled: (() => {
      try {
        return localStorage.getItem(LS_OFF(shopId)) !== '1'
      } catch {
        return true
      }
    })(),
    running: false,
    lastAt: readNum(LS_LAST(shopId)),
    folderLastAt: readNum(LS_FOLDER_LAST(shopId)),
    folder: null,
    lastError: null,
    points: [],
    lastReads: null,
  }
}

let state: AutoBackupState = initial(currentShopId())
const listeners = new Set<() => void>()

function set(patch: Partial<AutoBackupState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const autoBackupStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  getSnapshot: () => state,
}

/** Re-reads everything this screen shows, for whichever shop is signed in now. */
export async function refreshAutoBackup(): Promise<void> {
  const shopId = currentShopId()
  if (state.shopId !== shopId) state = initial(shopId)
  if (!shopId || !vaultSupported()) return set({})
  try {
    const [points, folder] = await Promise.all([listSnapshots(shopId), loadFolder(shopId)])
    set({
      points,
      folder: folder ? { name: folder.name, permission: await folder.queryPermission({ mode: 'readwrite' }) } : null,
    })
  } catch {
    set({})
  }
}

// --------------------------------------------------------------- mirror ---

interface Mirror {
  backup: BackupFile
  /** Client time at which the last server sync started. */
  syncedAt: number
  /** Per collection: last full (non-delta) read. */
  fullAt: Record<string, number>
}

function rowsOf(snap: QuerySnapshot<DocumentData>): BackupRow[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BackupRow)
}

const byId = (a: BackupRow, b: BackupRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

class Offline extends Error {
  constructor() {
    super('offline')
  }
}

async function server<T>(p: Promise<T>): Promise<T> {
  const r = await withDeadline(p, READ_DEADLINE_MS)
  if (r === null) throw new Offline()
  return r
}

/**
 * Brings the mirror up to date against the server. Throws Offline when the
 * server cannot be reached: a half-synced copy is never stored.
 */
async function syncFromServer(shopId: string, prev: Mirror | undefined) {
  const startedAt = Date.now()
  const collections: Record<string, BackupRow[]> = {}
  const fullAt: Record<string, number> = { ...(prev?.fullAt ?? {}) }
  let reads = 0
  const base = `shops/${shopId}/`

  for (const name of BACKUP_COLLECTIONS) {
    const col = collection(db, base + name)
    const old = prev?.backup.collections[name]
    const fullDue =
      !Array.isArray(old) ||
      old.length < SMALL ||
      !fullAt[name] ||
      startedAt - fullAt[name] > FULL_EVERY_MS

    const full = async () => {
      const snap = await server(getDocsFromServer(col))
      reads += Math.max(1, snap.size)
      fullAt[name] = startedAt
      return rowsOf(snap)
    }

    if (fullDue || !prev || !Array.isArray(old)) {
      collections[name] = (await full()).sort(byId)
      continue
    }

    const since = prev.syncedAt - OVERLAP_MS
    const [byUpdate, byCreate, count] = await Promise.all([
      server(getDocsFromServer(query(col, where('updatedAt', '>=', since)))),
      server(getDocsFromServer(query(col, where('createdAt', '>=', since)))),
      server(getCountFromServer(col)),
    ])
    // Billing: a query costs at least one read even when empty; count() costs
    // one per 1000 index entries.
    reads +=
      Math.max(1, byUpdate.size) + Math.max(1, byCreate.size) + Math.max(1, Math.ceil(count.data().count / 1000))
    const merged = new Map(old.map((r) => [r.id, r]))
    for (const r of [...rowsOf(byUpdate), ...rowsOf(byCreate)]) merged.set(r.id, r)
    // The proof. Anything the delta could not see — a deletion, a document
    // stamped before `since` that reached the server late — shows up here as a
    // different count, and the collection is re-read whole on the spot.
    collections[name] =
      merged.size === count.data().count ? [...merged.values()].sort(byId) : (await full()).sort(byId)
  }

  const backup: BackupFile = {
    app: 'lib-manager',
    version: 1,
    exportedAt: new Date(startedAt).toISOString(),
    fromCache: false,
    cachedCollections: [],
    shopId,
    collections,
  }
  return { mirror: { backup, syncedAt: startedAt, fullAt } satisfies Mirror, reads }
}

// --------------------------------------------------------- restore points ---

/**
 * Stores a complete backup as a restore point — or, when nothing changed since
 * the newest one, just notes that it was confirmed again. Used by the automatic
 * run and by a manual download alike. A partial (cache-sourced) file is refused:
 * a restore point is a promise of completeness.
 */
export async function recordRestorePoint(
  backup: BackupFile,
  source: 'auto' | 'manual',
): Promise<SnapshotMeta | null> {
  const shopId = backup.shopId || currentShopId()
  if (!shopId || !vaultSupported() || backup.fromCache) return null
  const json = JSON.stringify(backup)
  const hash = await sha256(JSON.stringify(backup.collections))
  const at = Date.parse(backup.exportedAt) || Date.now()
  const [newest] = await listSnapshots(shopId)
  let meta: SnapshotMeta
  if (newest && newest.hash === hash) {
    await touchSnapshot(newest, at)
    meta = { ...newest, checkedAt: at }
  } else {
    const counts: Record<string, number> = {}
    for (const name of BACKUP_COLLECTIONS) counts[name] = backup.collections[name]?.length ?? 0
    meta = await saveSnapshot(
      { shopId, at, checkedAt: at, hash, counts, total: countDocs(backup), source, carnet: checkCarnet(backup) },
      json,
    )
    await prune(shopId)
  }
  if (source === 'manual') {
    // A full manual export is as good as a full sync: prime the mirror so the
    // next automatic run only reads the delta.
    await putMeta(mirrorKey(shopId), {
      backup,
      syncedAt: at,
      fullAt: Object.fromEntries(BACKUP_COLLECTIONS.map((n) => [n, at])),
    } satisfies Mirror)
  }
  writeLs(LS_LAST(shopId), String(Math.max(at, readNum(LS_LAST(shopId)) ?? 0)))
  if (shopId === state.shopId) {
    set({ lastAt: readNum(LS_LAST(shopId)), points: await listSnapshots(shopId) })
  }
  return meta
}

// --------------------------------------------------------------- folder ---

async function loadFolder(shopId: string): Promise<DirHandle | null> {
  if (!folderSupported()) return null
  try {
    return (await getMeta<DirHandle>(folderKey(shopId))) ?? null
  } catch {
    return null
  }
}

async function writeFile(dir: DirHandle, name: string, data: string) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

/** Writes today's file (overwriting today's earlier one) and keeps the last 30. */
async function writeToFolder(dir: DirHandle, backup: BackupFile): Promise<void> {
  const day = dayjs(backup.exportedAt).format('YYYY-MM-DD')
  await writeFile(dir, `librairie-sauvegarde-${day}.json`, JSON.stringify(backup))
  // Overwritten every day: the one file to open on the worst day.
  await writeFile(dir, 'carnet-credit.csv', carnetCsv(backup))
  const names: string[] = []
  for await (const n of dir.keys()) if (FOLDER_FILE.test(n)) names.push(n)
  names.sort().reverse()
  for (const old of names.slice(FOLDER_KEEP)) {
    await dir.removeEntry(old).catch(() => undefined)
  }
}

async function copyLatestToFolder(shopId: string, interactive: boolean): Promise<boolean> {
  const dir = await loadFolder(shopId)
  if (!dir) return false
  let perm = await dir.queryPermission({ mode: 'readwrite' })
  // requestPermission needs a click; only ever called from one.
  if (perm === 'prompt' && interactive) perm = await dir.requestPermission({ mode: 'readwrite' })
  set({ folder: { name: dir.name, permission: perm } })
  if (perm !== 'granted') return false
  const mirror = await getMeta<Mirror>(mirrorKey(shopId))
  if (!mirror) return false
  await writeToFolder(dir, mirror.backup)
  const now = Date.now()
  writeLs(LS_FOLDER_LAST(shopId), String(now))
  // A file on disk or on a USB key is a backup the owner holds: it clears the
  // "never backed up / 7 days" nag exactly like a download does.
  writeLastBackupAt(now, false)
  set({ folderLastAt: now })
  return true
}

/** Opens the system folder picker. Must be called from a click. */
export async function chooseFolder(): Promise<boolean> {
  const shopId = currentShopId()
  const picker = (window as PickerWindow).showDirectoryPicker
  if (!shopId || !picker) return false
  let dir: DirHandle
  try {
    dir = await picker.call(window, { id: 'lib-backup', mode: 'readwrite', startIn: 'documents' })
  } catch {
    return false // cancelled
  }
  await putMeta(folderKey(shopId), dir)
  set({ folder: { name: dir.name, permission: 'granted' } })
  // Write right away so the owner sees the file appear in the folder he chose.
  await runAutoBackup({ force: true, interactive: true })
  return true
}

/** Re-grants access after a browser restart. Must be called from a click. */
export async function reconnectFolder(): Promise<boolean> {
  const shopId = currentShopId()
  if (!shopId) return false
  try {
    if (!state.lastAt) await runAutoBackup({ force: true, interactive: true })
    return await copyLatestToFolder(shopId, true)
  } catch (err) {
    set({ lastError: (err as Error).message })
    return false
  }
}

export async function forgetFolder(): Promise<void> {
  const shopId = currentShopId()
  if (!shopId) return
  await deleteMeta(folderKey(shopId))
  writeLs(LS_FOLDER_LAST(shopId), null)
  set({ folder: null, folderLastAt: null })
}

export function setAutoBackupEnabled(on: boolean) {
  const shopId = currentShopId()
  if (!shopId) return
  writeLs(LS_OFF(shopId), on ? null : '1')
  set({ enabled: on })
  if (on) void runAutoBackup()
}

// ------------------------------------------------------------------ run ---

function due(): boolean {
  const shopId = currentShopId()
  const last = readNum(LS_LAST(shopId))
  if (last === null || Date.now() - last > EVERY_MS) return true
  // The device copy is fresh but the folder copy is not (folder just
  // reconnected, or added after today's run).
  const folderLast = readNum(LS_FOLDER_LAST(shopId))
  return state.folder?.permission === 'granted' && (folderLast === null || Date.now() - folderLast > EVERY_MS)
}

let inFlight: Promise<void> | null = null

/**
 * One automatic backup. `force` ignores the once-a-day rule (the "Sauvegarder
 * maintenant" button); `interactive` allows the folder permission prompt.
 */
export function runAutoBackup(opts: { force?: boolean; interactive?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    if (!hasShop() || !vaultSupported()) return
    if (state.shopId !== currentShopId()) await refreshAutoBackup()
    if (!opts.force && (!state.enabled || !due())) return
    const work = () => runOnce(!!opts.interactive)
    const locks = (navigator as Navigator & { locks?: LockManager }).locks
    // One tab only. A second tab finding the lock taken simply skips.
    if (locks) await locks.request('lib-auto-backup', { ifAvailable: true }, (lock) => (lock ? work() : undefined))
    else await work()
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runOnce(interactive: boolean) {
  const shopId = currentShopId()
  set({ running: true, lastError: null })
  try {
    void askPersistentStorage()
    const prev = await getMeta<Mirror>(mirrorKey(shopId))
    const sameShop = prev && prev.backup.shopId === shopId ? prev : undefined
    const { mirror, reads } = await syncFromServer(shopId, sameShop)
    if (currentShopId() !== shopId) return // logged out mid-run
    await putMeta(mirrorKey(shopId), mirror)
    await recordRestorePoint(mirror.backup, 'auto')
    set({ lastReads: reads })
    try {
      await copyLatestToFolder(shopId, interactive)
    } catch (err) {
      // The device copy succeeded; the folder (USB key pulled out…) did not.
      set({ lastError: `folder: ${(err as Error).message}` })
    }
  } catch (err) {
    set({ lastError: err instanceof Offline ? 'offline' : (err as Error).message })
  } finally {
    set({ running: false })
  }
}

let started = false

/** Called once by the app shell. Everything after that is automatic. */
export function startAutoBackup(): void {
  if (started || typeof window === 'undefined' || !vaultSupported()) return
  started = true
  const tick = () => {
    const run = () => void runAutoBackup()
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback
    if (idle) idle(run, { timeout: 10_000 })
    else run()
  }
  void refreshAutoBackup()
  setTimeout(tick, FIRST_RUN_DELAY_MS)
  setInterval(tick, TICK_MS)
  // The line came back after a failed attempt: try again soon, not in 30 min.
  window.addEventListener('online', () => {
    if (state.lastError === 'offline') setTimeout(tick, 20_000)
  })
}
