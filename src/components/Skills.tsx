import { SKILLS } from '../data/site-content'

export function Skills() {
  return (
    <section className="skills-section" aria-label="Skills">
      <h2>Skills</h2>
      <div className="skills-grid">
        {SKILLS.map((group) => (
          <div className="skills-group" key={group.group}>
            <p className="skills-group-label">{group.group}</p>
            <ul className="skills-items">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
