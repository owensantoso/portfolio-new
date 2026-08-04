import '../App.css'
import './LifeLogPage.css'
import { CONTACT } from '../data/site-content'
import { Footer } from '../components/Footer'
import { SiteNav } from '../components/SiteNav'

export function LifeLogPage() {
  return (
    <>
      <SiteNav page="other" sectionLabel="Life Log" />

      <main className="page-shell life-log-page">
        <header className="life-log-hero">
          <p className="eyebrow">Personal iOS prototype</p>
          <h1>Life Log</h1>
          <p className="life-log-intro">
            A private timeline that brings voice notes, health, photos, GitHub activity,
            and music listening history into one calendar.
          </p>
          <p className="life-log-availability">Not currently available for public download.</p>
        </header>

        <section className="life-log-section" aria-labelledby="purpose-heading">
          <h2 id="purpose-heading">One place for the shape of a day</h2>
          <p>
            Life Log is an experimental iPhone app for reviewing personal activity in context.
            Recordings remain the primary journal, while optional data sources add useful context
            around when things happened.
          </p>
        </section>

        <section className="life-log-section" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Optional sources</h2>
          <ul className="life-log-source-grid">
            <li><strong>Voice</strong><span>Private recordings and on-device transcripts</span></li>
            <li><strong>Health</strong><span>Steps, sleep, and workouts from Apple Health</span></li>
            <li><strong>Media</strong><span>Photos and timestamped music listening history</span></li>
            <li><strong>Digital</strong><span>Personal GitHub contribution activity</span></li>
          </ul>
        </section>

        <section className="life-log-section life-log-privacy" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Private by design</h2>
          <p>
            Life Log has no account or hosted backend. Original recordings, imported history,
            and integration credentials stay on the user’s device. External services are contacted
            only when their optional source is connected or refreshed.
          </p>
        </section>

        <p className="life-log-contact">
          Questions about the prototype? <a href={`mailto:${CONTACT.email}`}>Contact Owen</a>.
        </p>

        <Footer />
      </main>
    </>
  )
}
