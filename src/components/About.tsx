import { ABOUT_CLOSING, ABOUT_INTRO, ABOUT_MENTIONS } from '../data/site-content'
import { ProjectMentionLink } from './ProjectMentionLink'

type AboutProps = {
  onSelectProject: (slug: string) => void
}

export function About({ onSelectProject }: AboutProps) {
  return (
    <section className="about-section" aria-label="About">
      <h2>About</h2>
      <p>{ABOUT_INTRO}</p>
      <p>
        Outside of work I build tools around problems I run into myself:{' '}
        <ProjectMentionLink
          slug={ABOUT_MENTIONS.jimoty.slug}
          imageUrl={ABOUT_MENTIONS.jimoty.imageUrl}
          onSelect={onSelectProject}
        >
          a Chrome extension that puts a map on Jimoty listings
        </ProjectMentionLink>
        ,{' '}
        <ProjectMentionLink
          slug={ABOUT_MENTIONS.spotifyTracker.slug}
          imageUrl={ABOUT_MENTIONS.spotifyTracker.imageUrl}
          onSelect={onSelectProject}
        >
          a page that tracks one Spotify playlist over time
        </ProjectMentionLink>
        ,{' '}
        <ProjectMentionLink
          slug={ABOUT_MENTIONS.arLyrics.slug}
          imageUrl={ABOUT_MENTIONS.arLyrics.imageUrl}
          onSelect={onSelectProject}
        >
          glasses that show synced lyrics
        </ProjectMentionLink>
        . {ABOUT_CLOSING}
      </p>
    </section>
  )
}
