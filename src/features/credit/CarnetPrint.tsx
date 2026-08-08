import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Customer } from '@/types/models'
import type { LedgerRow, LedgerTotals } from './ledger'

/**
 * The printable relevé de compte — the client's page of the carnet, on paper.
 *
 * Rendered into #print-area, which src/index.css hides on screen and is the
 * only thing the print stylesheet reveals. Chakra styling does not reach the
 * print sheet, so everything here is a plain element with an inline style,
 * exactly like src/features/pos/Ticket.tsx.
 */
export function CarnetPrint({
  customer,
  rows,
  totals,
  shopName,
  symbol,
}: {
  customer: Customer
  /** Newest first, as shown on screen. Printed the other way round. */
  rows: LedgerRow[]
  totals: LedgerTotals
  shopName: string
  symbol: string
}) {
  const { t } = useTranslation()
  const money = (m: number) => formatMoney(m, { symbol })

  // On paper a statement reads downwards: the oldest line first, the balance
  // growing line by line, the closing balance at the foot.
  const chrono = [...rows].reverse()
  const owes = customer.balance > 0

  const cell = {
    padding: '4px 6px',
    borderBottom: '1px solid #999',
    verticalAlign: 'top' as const,
  }
  const head = {
    padding: '4px 6px',
    borderBottom: '2px solid #000',
    textAlign: 'start' as const,
    fontWeight: 700,
  }
  const num = { ...cell, textAlign: 'end' as const, whiteSpace: 'nowrap' as const }
  const numHead = { ...head, textAlign: 'end' as const }

  return (
    <div id="print-area" className="a4">
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '1.5em', fontWeight: 700 }}>{shopName}</div>
        <div style={{ fontSize: '1.2em', marginTop: 2 }}>{t('credit.statement')}</div>
        <div style={{ marginTop: 2 }}>{formatDateTime(Date.now())}</div>
      </div>

      <div
        style={{
          borderTop: '1px solid #000',
          borderBottom: '1px solid #000',
          padding: '6px 0',
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: '1.3em', fontWeight: 700 }}>{customer.name}</div>
        {customer.phone && <div>{customer.phone}</div>}
        {customer.note && <div>{customer.note}</div>}
        <div>{t('credit.since', { date: formatDate(customer.createdAt) })}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={head}>{t('common.date')}</th>
            <th style={head}>{t('credit.label')}</th>
            <th style={numHead}>{t('credit.out')}</th>
            <th style={numHead}>{t('credit.in')}</th>
            <th style={numHead}>{t('credit.runningBalance')}</th>
          </tr>
        </thead>
        <tbody>
          {chrono.length === 0 ? (
            <tr>
              <td style={cell} colSpan={5}>
                {t('credit.noEntries')}
              </td>
            </tr>
          ) : (
            chrono.map(({ entry, balance }) => {
              const isDebit = entry.type === 'debit'
              return (
                <tr key={entry.id}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {formatDate(entry.date)}
                  </td>
                  <td style={cell}>
                    {entry.label || (isDebit ? t('credit.debit') : t('credit.payment'))}
                    {entry.ticketNo && (
                      <span style={{ display: 'block', fontSize: '0.85em' }}>
                        {t('credit.fromTicket', { ref: entry.ticketNo })}
                      </span>
                    )}
                  </td>
                  <td style={num}>{isDebit ? money(entry.amount) : ''}</td>
                  <td style={num}>{isDebit ? '' : money(entry.amount)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{money(balance)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('credit.totalTaken')}</span>
          <span>{money(totals.taken)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('credit.totalPaid')}</span>
          <span>{money(totals.paid)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 700,
            fontSize: '1.35em',
            borderTop: '2px solid #000',
            marginTop: 6,
            paddingTop: 6,
          }}
        >
          <span>{t('customer.balance')}</span>
          <span>
            {owes
              ? money(customer.balance)
              : customer.balance < 0
                ? t('credit.creditor', { amount: money(-customer.balance) })
                : t('credit.settled')}
          </span>
        </div>
      </div>
    </div>
  )
}
