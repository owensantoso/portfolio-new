import { EDUCATION } from '../data/site-content'

export function Education() {
  return (
    <section id="education" className="education-section" aria-label="Education">
      <h2>Education</h2>

      <div className="education-stack">
        {EDUCATION.map((school) => (
          <article key={school.school}>
            <header className="education-header">
              <h3>{school.school}</h3>
              <p className="education-dates">{school.dates}</p>
            </header>

            <div className="education-entries">
              {school.entries.map((entry) => (
                <section className="education-entry" key={entry.degree}>
                  <div className="education-entry-heading">
                    <h4>{entry.degree}</h4>
                    <p>{entry.emphasis}</p>
                  </div>
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
