import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SiteFooter, SiteHeader } from '../LandingPage'
import { LANDING_PATH } from '../copy'
import { DRAFT_NOTICE } from './content'
import type { Block, LegalDoc } from './content'

/**
 * One legal page, rendered to static HTML at build time only (prerender.tsx):
 * the app never routes here, so none of this reaches the till's bundle.
 */

/** Highlights each [to be completed] passage, so a draft can never pass for final. */
function text(s: string): ReactNode {
  const parts = s.split(/(\[[^\]]+\])/)
  if (parts.length === 1) return s
  return parts.map((p, i) =>
    p.startsWith('[') ? (
      <span className="mk-todo" key={i}>
        {p}
      </span>
    ) : (
      p
    ),
  )
}

function renderBlock(b: Block, i: number) {
  if (typeof b === 'string') return <p key={i}>{text(b)}</p>
  if ('list' in b)
    return (
      <ul key={i}>
        {b.list.map((li) => (
          <li key={li}>{text(li)}</li>
        ))}
      </ul>
    )
  if ('table' in b) {
    const [head, ...rows] = b.table
    return (
      <table key={i}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((cell, j) => (
                <td key={j}>{text(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  // Same hook as the footer's: static.ts reveals it when tracking is on.
  return (
    <p key={i}>
      <button type="button" className="mk-btn mk-btn-ghost mk-btn-sm" data-mk="consent" hidden>
        {b.manageCookies}
      </button>
    </p>
  )
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="mk" lang="fr">
      <SiteHeader lang="fr">
        <a href={LANDING_PATH.fr} className="mk-btn mk-btn-ghost mk-btn-sm">
          <ArrowLeft size={16} aria-hidden="true" className="mk-flip" />
          Mektebti.tn
        </a>
      </SiteHeader>
      <main className="mk-legal" id="contenu">
        <h1>{doc.title}</h1>
        <p className="mk-legal-draft" role="note">
          {DRAFT_NOTICE}
        </p>
        {doc.sections.map((s) => (
          <section key={s.title} id={s.id}>
            <h2>{s.title}</h2>
            {s.blocks.map(renderBlock)}
          </section>
        ))}
        <p className="mk-legal-updated">Dernière mise à jour : {doc.updated}</p>
      </main>
      <SiteFooter lang="fr" />
    </div>
  )
}
