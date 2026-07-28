import './SiteNav.css'
import { HOME_URL, PROJECTS_URL } from '../data/site-content'

export type NavSection = { id: string; label: string }

type SiteNavProps = {
  /** Which page this is, so the matching link reads as current. */
  page: 'home' | 'projects'
  /** Label of the section currently in view, or null when above the first one. */
  sectionLabel?: string | null
}

/**
 * Page-level navigation: always visible, never pops in, and always offers a route
 * to the other page. Section position is a separate concern (SectionRail); the only
 * thing that leaks across is the section label, which slides in beside the wordmark
 * as its heading scrolls up under the bar.
 */
export function SiteNav({ page, sectionLabel }: SiteNavProps) {
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <a className="site-nav-brand" href={HOME_URL}>
          toso
        </a>

        <span className="site-nav-section" aria-hidden="true" data-shown={Boolean(sectionLabel)}>
          <span className="site-nav-slash">/</span>
          <span className="site-nav-section-label" key={sectionLabel ?? 'none'}>
            {sectionLabel}
          </span>
        </span>

        <nav className="site-nav-pages" aria-label="Pages">
          <a href={HOME_URL} data-current={page === 'home'} aria-current={page === 'home' ? 'page' : undefined}>
            Home
          </a>
          <a
            href={PROJECTS_URL}
            data-current={page === 'projects'}
            aria-current={page === 'projects' ? 'page' : undefined}
          >
            Projects
          </a>
        </nav>
      </div>
    </header>
  )
}
