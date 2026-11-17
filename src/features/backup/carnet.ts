/**
 * The carnet de crédit, checked inside a backup.
 *
 * Of everything a librairie keeps, who owes what is the one list that exists
 * nowhere else — no supplier invoice, no receipt in a drawer can rebuild it.
 * So every backup, automatic or downloaded, is checked here before it is
 * trusted: each customer's stored balance must equal the sum of his ledger
 * lines (addCreditEntry and recordSale move both in one batch, so they can
 * only disagree through corruption or a half-restored file).
 *
 * Pure functions over a BackupFile: no Firestore, no React.
 */
import dayjs from 'dayjs'
import type { BackupFile, BackupRow } from './backupService'

export interface CarnetMismatch {
  id: string
  name: string
  /** What the customer document says, in millimes. */
  stored: number
  /** What his ledger lines add up to, in millimes. */
  ledger: number
}

export interface CarnetSummary {
  customers: number
  /** Customers who owe something right now. */
  debtors: number
  /** Total owed to the shop, in millimes. */
  outstanding: number
  entries: number
  /** Lines whose customer is not in the file. */
  orphanEntries: number
  mismatches: CarnetMismatch[]
}

const rows = (backup: BackupFile, name: string): BackupRow[] => {
  const r: unknown = backup.collections?.[name]
  return Array.isArray(r) ? (r as BackupRow[]) : []
}

const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

export function checkCarnet(backup: BackupFile): CarnetSummary {
  const customers = rows(backup, 'customers')
  const entries = rows(backup, 'credit_entries')
  const sums = new Map<string, number>()
  let orphanEntries = 0
  const known = new Set(customers.map((c) => c.id))
  for (const e of entries) {
    const cid = typeof e.customerId === 'string' ? e.customerId : ''
    if (!known.has(cid)) {
      orphanEntries += 1
      continue
    }
    const signed = e.type === 'debit' ? int(e.amount) : -int(e.amount)
    sums.set(cid, (sums.get(cid) ?? 0) + signed)
  }
  let debtors = 0
  let outstanding = 0
  const mismatches: CarnetMismatch[] = []
  for (const c of customers) {
    const stored = int(c.balance)
    const ledger = sums.get(c.id) ?? 0
    if (stored > 0) {
      debtors += 1
      outstanding += stored
    }
    if (stored !== ledger) {
      mismatches.push({ id: c.id, name: typeof c.name === 'string' ? c.name : c.id, stored, ledger })
    }
  }
  return {
    customers: customers.length,
    debtors,
    outstanding,
    entries: entries.length,
    orphanEntries,
    mismatches,
  }
}

const money = (m: number) => (m / 1000).toFixed(3).replace('.', ',')
const esc = (s: string) => {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * The carnet as a one-page spreadsheet a human can read with no app at all:
 * who, phone, what he owes, when he last bought or paid. Written next to every
 * folder backup so that on the worst day the shop can still chase its debts
 * from Excel. French Excel: ';' separators, decimal comma, UTF-8 BOM.
 */
export function carnetCsv(backup: BackupFile): string {
  const last = new Map<string, number>()
  for (const e of rows(backup, 'credit_entries')) {
    const cid = typeof e.customerId === 'string' ? e.customerId : ''
    const at = int(e.date) || int(e.createdAt)
    if (at > (last.get(cid) ?? 0)) last.set(cid, at)
  }
  const list = rows(backup, 'customers')
    .map((c) => ({
      name: typeof c.name === 'string' ? c.name : '',
      phone: typeof c.phone === 'string' ? c.phone : '',
      cin: typeof c.cin === 'string' ? c.cin : '',
      balance: int(c.balance),
      last: last.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  const head = ['Client', 'Téléphone', 'CIN', 'Solde dû (DT)', 'Dernière opération']
  const lines = list.map((c) =>
    [c.name, c.phone, c.cin, money(c.balance), c.last ? dayjs(c.last).format('DD/MM/YYYY') : '']
      .map(esc)
      .join(';'),
  )
  const total = list.reduce((n, c) => n + Math.max(0, c.balance), 0)
  lines.push(['TOTAL', '', '', money(total), ''].join(';'))
  return '﻿' + [head.join(';'), ...lines].join('\r\n')
}
