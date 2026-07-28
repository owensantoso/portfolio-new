import { EXPERIENCE } from '../data/site-content'

export function Experience() {
  return (
    <section id="experience" className="experience-section" aria-label="Experience">
      <h2>Experience</h2>
      <ul className="experience-list">
        {EXPERIENCE.map((entry) => (
          <li className="experience-entry" key={entry.company}>
            <div className="experience-heading">
              <div className="experience-title-block">
                <h3>
                  <a className="experience-company-link" href={entry.companyUrl} target="_blank" rel="noreferrer">
                    <span className="experience-company-mark" aria-hidden="true">
                      {entry.companyMark}
                    </span>
                    <span>{entry.company}</span>
                  </a>
                </h3>
                <p className="experience-role">{entry.role}</p>
              </div>
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
