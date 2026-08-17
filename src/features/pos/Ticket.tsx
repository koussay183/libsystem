import type { CSSProperties } from 'react'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import type { PosLine } from './usePosCart'
import type { PaymentMode, ShopSettings } from '@/types/models'

/**
 * Everything the receipt prints, captured at the moment the sale was rung up.
 *
 * There is deliberately no "not yet sent to the server" flag here. The sale is
 * durable on this machine before this component is ever rendered, but whether
 * the server has taken it is unknown at print time and will change after the
 * paper is already in the customer's hand — so a receipt claiming either thing
 * is a receipt that lies. The header sync badge owns that question.
 */
export interface TicketData {
  ticketNo: string
  date: number
  lines: PosLine[]
  subtotal: number
  discount: number
  total: number
  /** Applied to this ticket (never more than the total). */
  paid: number
  /** Cash actually handed over, so the receipt can print the change. */
  received: number
  mode: PaymentMode
  clientName?: string
}

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between' }

/**
 * The printable receipt. Rendered into #print-area, which is hidden on screen
 * and revealed by the print stylesheet (80mm thermal or A4). Chakra styling
 * does not reach the print sheet, so this component uses plain inline styles.
 */
export function Ticket({
  data,
  shop,
  symbol,
  paper,
}: {
  data: TicketData
  shop: ShopSettings
  symbol: string
  paper: 'thermal' | 'a4'
}) {
  const remaining = data.total - data.paid
  const change = Math.max(0, data.received - data.total)
  const money = (m: number) => formatMoney(m, { symbol })

  return (
    <div id="print-area" className={paper}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: '1.3em', fontWeight: 700 }}>{shop.name}</div>
        {shop.address && <div>{shop.address}</div>}
        {shop.phone && <div>Tél : {shop.phone}</div>}
        {shop.taxId && <div>MF : {shop.taxId}</div>}
        <div style={{ marginTop: 4 }}>Ticket {data.ticketNo}</div>
        <div>{formatDateTime(data.date)}</div>
        {data.clientName && <div>Client : {data.clientName}</div>}
      </div>

      <div
        style={{
          borderTop: '1px dashed #000',
          borderBottom: '1px dashed #000',
          padding: '4px 0',
        }}
      >
        {data.lines.map((l) => (
          <div key={l.id} style={{ marginBottom: 4 }}>
            <div>
              {l.name}
              {l.qty < 0 && <strong> (RETOUR)</strong>}
            </div>
            <div style={row}>
              <span>
                {l.qty} x {money(l.unitPrice)}
              </span>
              <span>{money(l.qty * l.unitPrice)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        {data.discount > 0 && (
          <>
            <div style={row}>
              <span>Sous-total</span>
              <span>{money(data.subtotal)}</span>
            </div>
            <div style={row}>
              <span>Remise</span>
              <span>-{money(data.discount)}</span>
            </div>
          </>
        )}
        <div style={{ ...row, fontWeight: 700, fontSize: '1.2em' }}>
          <span>{data.total < 0 ? 'À REMBOURSER' : 'TOTAL'}</span>
          <span>{money(Math.abs(data.total))}</span>
        </div>
        {data.received > 0 && data.total >= 0 && (
          <div style={row}>
            <span>Reçu</span>
            <span>{money(data.received)}</span>
          </div>
        )}
        {change > 0 && (
          <div style={{ ...row, fontWeight: 700 }}>
            <span>Rendu</span>
            <span>{money(change)}</span>
          </div>
        )}
        {remaining > 0 && (
          <div style={{ ...row, fontWeight: 700 }}>
            <span>Reste (crédit)</span>
            <span>{money(remaining)}</span>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        {shop.footer || 'Merci et à bientôt !'}
      </div>
    </div>
  )
}
