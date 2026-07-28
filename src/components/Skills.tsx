import { useState } from 'react'
import { PROJECTS_URL, SKILL_SOURCES, SKILLS } from '../data/site-content'

export function Skills() {
  const [openSkill, setOpenSkill] = useState<string | null>(null)

  return (
    <section id="skills" className="skills-section" aria-label="Skills">
      <h2>Skills</h2>
      <p className="skills-hint">Pick one to see where it came from.</p>
      <div className="skills-grid">
        {SKILLS.map((group) => (
          <div className="skills-group" key={group.group}>
            <p className="skills-group-label">{group.group}</p>
            <ul className="skills-items">
              {group.items.map((item) => {
                const sources = SKILL_SOURCES[item]
                const isOpen = openSkill === item

                if (!sources) {
                  return (
                    <li key={item} className="skills-item">
                      <span className="skills-item-plain">{item}</span>
                    </li>
                  )
                }

                return (
                  <li key={item} className="skills-item">
                    <button
                      type="button"
                      className="skills-item-trigger"
                      aria-expanded={isOpen}
                      data-open={isOpen}
                      onClick={() => setOpenSkill(isOpen ? null : item)}
                    >
                      {item}
                    </button>

                    {isOpen ? (
                      <ul className="skills-sources">
                        {sources.map((source) => (
                          <li key={source.label}>
                            {source.kind === 'project' ? (
                              <a href={`${PROJECTS_URL}#project-${source.slug}`}>{source.label}</a>
                            ) : (
                              <a href="#experience">{source.label}</a>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
