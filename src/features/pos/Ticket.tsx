import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
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

  const a4 = paper === 'a4'

  /*
    ONE SHEET, WHICH IS WHAT THE CUSTOMER IS HANDED.

    A4 at the ordinary size fits about 22 lines with the letterhead, the totals
    panel and the signatures. Past that the sheet spills onto a second page for
    the sake of two or three articles — and a two-page invoice for a school
    satchel's worth of exercise books is not a document anybody wants to hold.
    So a long ticket tightens instead of overflowing: same layout, smaller type,
    still comfortably legible at arm's length.

    It is a floor, not a trick: past ~40 articles it stops shrinking and lets the
    sheet break properly, with the table header repeating (src/index.css). An
    invoice nobody can read is worse than an invoice on two pages.
  */
  const density = !a4 ? '' : data.lines.length > 40 ? ' dense' : data.lines.length > 22 ? ' tight' : ''

  /*
    TWO LAYOUTS, BECAUSE THEY ARE TWO DIFFERENT OBJECTS.

    The thermal roll is 74mm of monospace torn off and handed over; a stacked
    name-then-quantity block is the right shape for it and always was.

    A4 is an invoice. It is read across a counter, filed, and argued over — and
    when it runs to forty lines it runs to three sheets. A stack of flex rows
    gives the printer nothing to repeat at the top of sheet two, so the customer
    gets a page of numbers with no idea which column is which. A real table does:
    thead is `display: table-header-group` in the print sheet, so the header rides
    every page. See src/index.css.
  */
  const lines = a4 ? (
    <table>
      <thead>
        <tr>
          <th style={{ width: '6%' }}>#</th>
          <th>Désignation</th>
          <th style={{ width: '10%', textAlign: 'end' }}>Qté</th>
          <th style={{ width: '18%', textAlign: 'end' }}>P.U.</th>
          <th style={{ width: '20%', textAlign: 'end' }}>Montant</th>
        </tr>
      </thead>
      <tbody>
        {data.lines.map((l, i) => (
          <tr key={l.id}>
            <td>{i + 1}</td>
            <td>
              {l.name}
              {l.qty < 0 && <strong> (RETOUR)</strong>}
            </td>
            <td style={{ textAlign: 'end' }}>{l.qty}</td>
            <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>{money(l.unitPrice)}</td>
            <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
              {money(l.qty * l.unitPrice)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div
      style={{
        borderTop: '1px dashed #000',
        borderBottom: '1px dashed #000',
        padding: '4px 0',
      }}
    >
      {data.lines.map((l) => (
        <div key={l.id} className="print-row" style={{ marginBottom: 4 }}>
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
  )

  /*
    Portalled to <body> rather than rendered where it sits.

    The print sheet removes every OTHER child of <body>. That only works if this
    is a child of <body> — nested inside the app it would be removed along with
    its parents, and the old workaround (hide the app with visibility, drag this
    out with position:absolute) is what broke multi-page printing. See the long
    note at the top of src/index.css.
  */
  /*
    THE A4 HEAD IS A LETTERHEAD, NOT A CENTRED TILL RECEIPT.

    A4 is the sheet the customer walks out with and files. Centring the shop's
    name over a monospace column made it look like a till roll photocopied onto
    a big page — the shop on the left where a letterhead belongs, the invoice's
    own identity boxed on the right where anybody filing it will look for the
    number and the date.
  */
  const a4Head = (
    <div className="print-header" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div style={{ fontSize: '1.7em', fontWeight: 700, lineHeight: 1.15 }}>{shop.name}</div>
          {shop.address && <div>{shop.address}</div>}
          {shop.phone && <div>Tél : {shop.phone}</div>}
          {shop.taxId && <div>MF : {shop.taxId}</div>}
        </div>
        <div
          style={{
            border: '1px solid #000',
            padding: '6px 10px',
            minWidth: '46mm',
            textAlign: 'end',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.15em' }}>FACTURE</div>
          <div style={{ marginTop: 2 }}>N° {data.ticketNo}</div>
          <div>{formatDateTime(data.date)}</div>
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          paddingTop: 6,
          borderTop: '2px solid #000',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong>Client : </strong>
          {data.clientName || 'Comptoir'}
        </div>
        <div>
          {data.lines.length} article{data.lines.length > 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )

  return createPortal(
    <div id="print-area" className={paper + density}>
      {a4 ? (
        a4Head
      ) : (
        <div className="print-header" style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '1.3em', fontWeight: 700 }}>{shop.name}</div>
          {shop.address && <div>{shop.address}</div>}
          {shop.phone && <div>Tél : {shop.phone}</div>}
          {shop.taxId && <div>MF : {shop.taxId}</div>}
          <div style={{ marginTop: 4 }}>Ticket {data.ticketNo}</div>
          <div>{formatDateTime(data.date)}</div>
          {data.clientName && <div>Client : {data.clientName}</div>}
        </div>
      )}

      {lines}

      <div
        className="print-keep"
        style={
          a4
            ? {
                marginTop: 12,
                marginInlineStart: 'auto',
                width: '78mm',
                border: '1px solid #000',
                padding: '8px 10px',
              }
            : { marginTop: 8 }
        }
      >
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

      {a4 && (
        /* Somewhere to sign, because this sheet is handed over and sometimes
           comes back as the proof that it was. */
        <div
          className="print-keep"
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, gap: 24 }}
        >
          <div style={{ fontSize: '0.9em' }}>
            <div>Signature du client</div>
            <div style={{ borderBottom: '1px solid #000', width: '52mm', marginTop: 16 }} />
          </div>
          <div style={{ fontSize: '0.9em', textAlign: 'end' }}>
            <div>Cachet et signature</div>
            <div style={{ borderBottom: '1px solid #000', width: '52mm', marginTop: 16 }} />
          </div>
        </div>
      )}

      <div
        className="print-keep"
        style={{
          textAlign: 'center',
          marginTop: a4 ? 14 : 10,
          ...(a4 ? { borderTop: '1px solid #999', paddingTop: 6, fontSize: '0.9em' } : {}),
        }}
      >
        {shop.footer || 'Merci et à bientôt !'}
      </div>
    </div>,
    document.body,
  )
}
