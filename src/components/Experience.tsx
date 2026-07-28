import { EXPERIENCE } from '../data/site-content'

export function Experience() {
  return (
    <section id="experience" className="experience-section" aria-label="Experience">
      <h2>Experience</h2>
      <ul className="experience-list">
        {EXPERIENCE.map((entry) => (
          <li className="experience-entry" key={entry.company}>
            <div className="experience-heading">
              <h3>
                {entry.company} — {entry.role}
              </h3>
              <p className="experience-dates">{entry.dates}</p>
            </div>
            <ul className="experience-bullets">
              {entry.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
