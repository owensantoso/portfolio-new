import type { NavSection } from './SiteNav';
import './SectionRail.css';

export function SectionRail({
  sections,
  activeId,
}: {
  sections: NavSection[];
  activeId: string | null;
}) {
  return (
    <nav className="section-rail" aria-label="Jump to section">
      <ol className="section-rail-list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className="section-rail-link"
              href={`#${section.id}`}
              data-active={section.id === activeId}
              aria-current={section.id === activeId ? 'true' : undefined}
            >
              <span className="section-rail-dot" />
              <span className="section-rail-label">{section.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
