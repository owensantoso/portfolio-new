import {
  ABOUT_ASIDE_FACTS,
  ABOUT_CLOSING,
  ABOUT_INTRO,
  ABOUT_MENTIONS,
  HERO_PHOTO_URL,
  INTEREST_CHIPS,
} from '../data/site-content'
import { ProjectMentionLink } from './ProjectMentionLink'

export function About() {
  return (
    <section id="about" className="about-section" aria-label="About">
      <h2>About</h2>
      <div className="about-grid">
        <div className="about-copy">
          <p>{ABOUT_INTRO}</p>
          <p>
            Outside of work I build tools around problems I run into myself:{' '}
            <ProjectMentionLink slug={ABOUT_MENTIONS.jimoty.slug} imageUrl={ABOUT_MENTIONS.jimoty.imageUrl}>
              a Chrome extension that puts a map on Jimoty listings
            </ProjectMentionLink>
            ,{' '}
            <ProjectMentionLink
              slug={ABOUT_MENTIONS.spotifyTracker.slug}
              imageUrl={ABOUT_MENTIONS.spotifyTracker.imageUrl}
            >
              a page that tracks one Spotify playlist over time
            </ProjectMentionLink>
            ,{' '}
            <ProjectMentionLink slug={ABOUT_MENTIONS.arLyrics.slug} imageUrl={ABOUT_MENTIONS.arLyrics.imageUrl}>
              glasses that show synced lyrics
            </ProjectMentionLink>
            . {ABOUT_CLOSING}
          </p>
        </div>

        <aside className="about-aside" aria-label="About details">
          {HERO_PHOTO_URL ? (
            <div className="about-polaroid-cluster">
              <div className="about-polaroid">
                <img className="about-polaroid-image" src={HERO_PHOTO_URL} alt="Owen Santoso portrait" />
              </div>
              <ul className="about-interest-chips" aria-hidden="true">
                {INTEREST_CHIPS.map((chip) => (
                  <li className="about-interest-chip" data-slot={chip.slot} key={chip.label}>
                    <span>{chip.emoji}</span>
                    <span>{chip.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="about-facts">
            {ABOUT_ASIDE_FACTS.map((fact) => (
              <div className="about-fact" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  )
}
