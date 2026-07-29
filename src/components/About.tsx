import { ABOUT_CLOSING, ABOUT_INTRO, ABOUT_MENTIONS, HERO_PHOTO_URL, INTEREST_CHIPS } from '../data/site-content'
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

        {HERO_PHOTO_URL ? (
          <div className="about-aside">
            <div className="about-polaroid-cluster">
              {/* Round emoji stickers, tucked behind the photo at rest and peeling out
                  to its corners on hover. Decorative, so hidden from assistive tech. */}
              <ul className="about-interest-chips" aria-hidden="true">
                {INTEREST_CHIPS.map((chip) => (
                  <li
                    className="about-interest-chip"
                    data-slot={chip.slot}
                    title={chip.label}
                    key={chip.label}
                  >
                    {chip.emoji}
                  </li>
                ))}
              </ul>

              <div className="about-polaroid">
                <img className="about-polaroid-image" src={HERO_PHOTO_URL} alt="Owen Santoso portrait" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
