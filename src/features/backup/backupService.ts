import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { shopPath } from '@/lib/tenant'

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
  version: 1
  exportedAt: string
  collections: Record<string, BackupRow[]>
}

/** Reads every collection into a single portable object. */
export async function exportAll(): Promise<BackupFile> {
  const collections: Record<string, BackupRow[]> = {}
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, shopPath(name)))
    collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BackupRow)
  }
  return {
    app: 'lib-manager',
    version: 1,
    exportedAt: new Date().toISOString(),
    collections,
  }
}

export function countDocs(backup: BackupFile): number {
  return Object.values(backup.collections).reduce((n, rows) => n + rows.length, 0)
}

/** One line per collection, so a restore can be checked before it happens. */
export function summarise(backup: BackupFile): { name: string; count: number }[] {
  return BACKUP_COLLECTIONS.map((name) => ({
    name,
    count: backup.collections[name]?.length ?? 0,
  }))
}

/**
 * When a backup was last downloaded, remembered on this machine. A shop that
 * has never been backed up should be told so, loudly and often — the whole
 * point of the feature is the day the account is lost.
 */
const LAST_BACKUP_KEY = 'backup.lastAt'

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

export function writeLastBackupAt(at: number) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(at))
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

export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<BackupFile>
  return v.app === 'lib-manager' && typeof v.collections === 'object' && !!v.collections
}

/**
 * Writes a backup back into Firestore. Documents keep their original ids, so a
 * restore overwrites same-id documents and leaves anything else untouched.
 * Chunked to stay under Firestore's 500-writes-per-batch limit.
 */
export async function restoreAll(backup: BackupFile): Promise<number> {
  let written = 0
  const CHUNK = 400
  for (const [name, rows] of Object.entries(backup.collections)) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const batch = writeBatch(db)
      for (const row of slice) {
        const { id, ...data } = row
        if (!id) continue
        batch.set(doc(db, shopPath(name), id), data)
      }
      await batch.commit()
      written += slice.length
    }
  }
  return written
}
