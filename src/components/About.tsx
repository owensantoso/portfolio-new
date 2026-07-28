import { ABOUT_CLOSING, ABOUT_INTRO, ABOUT_MENTIONS } from '../data/site-content'
import { ProjectMentionLink } from './ProjectMentionLink'

export function About() {
  return (
    <section id="about" className="about-section" aria-label="About">
      <h2>About</h2>
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
    </section>
  )
}
