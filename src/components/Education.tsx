import { EDUCATION } from '../data/site-content'

export function Education() {
  return (
    <section id="education" className="education-section" aria-label="Education">
      <h2>Education</h2>

      <div className="education-stack">
        {EDUCATION.map((school) => (
          <article className="education-card" key={school.school}>
            <header className="education-header">
              <div>
                <h3>{school.school}</h3>
              </div>
              <p className="education-dates">{school.dates}</p>
            </header>

            <div className="education-entries">
              {school.entries.map((entry) => (
                <section className="education-entry" key={entry.degree}>
                  <div className="education-entry-heading">
                    <h4>{entry.degree}</h4>
                    <p>{entry.emphasis}</p>
                  </div>
                  <p className="education-entry-dates">{entry.dates}</p>
                  <ul className="education-bullets">
                    {entry.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
