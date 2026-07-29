import { useCallback, useEffect, useRef, useState } from 'react'
import './Featured.css'
import type { ProjectCardData } from '../lib/projects'
import { FEATURED_GROUPS, PROJECTS_URL, type FeaturedGroup } from '../data/site-content'
import { useDragScroll } from '../lib/useDragScroll'
import { LinkIcon, type LinkIconName } from './LinkIcon'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'

type FeaturedProps = {
  projects: ProjectCardData[]
  onOpenMedia: (media: MediaSelection) => void
}

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  prototype: 'Prototype',
  'in-development': 'In development',
}

const GROUP_KICKER: Record<FeaturedGroup['theme'], string> = {
  hardware: 'Physical world',
  language: 'Japan life',
  play: 'Just for fun',
}

function primaryLinkIcon(label: string): LinkIconName {
  const normalized = label.toLowerCase()

  if (normalized.includes('download')) return 'download'
  if (normalized.includes('store')) return 'store'
  if (normalized.includes('case study')) return 'resume'

  return 'external'
}

type LaneProps = {
  group: FeaturedGroup
  projects: ProjectCardData[]
  /** Even lanes put the media on the left, odd lanes on the right. */
  flipped: boolean
  onOpenMedia: (media: MediaSelection) => void
}

function FeaturedLane({ group, projects, flipped, onOpenMedia }: LaneProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const [canScrollBack, setCanScrollBack] = useState(false)
  const [canScrollForward, setCanScrollForward] = useState(false)

  useDragScroll(trackRef)

  const syncState = useCallback(() => {
    const track = trackRef.current

    if (!track) {
      return
    }

    const maxScrollLeft = track.scrollWidth - track.clientWidth
    setCanScrollBack(track.scrollLeft > 4)
    setCanScrollForward(track.scrollLeft < maxScrollLeft - 4)

    const slide = track.querySelector<HTMLElement>('.featured-band')
    const step = slide ? slide.offsetWidth + 20 : track.clientWidth
    setIndex(Math.min(projects.length - 1, Math.max(0, Math.round(track.scrollLeft / step))))
  }, [projects.length])

  useEffect(() => {
    const track = trackRef.current

    if (!track) {
      return
    }

    syncState()

    const observer = new ResizeObserver(syncState)
    observer.observe(track)
    track.addEventListener('scroll', syncState, { passive: true })

    return () => {
      observer.disconnect()
      track.removeEventListener('scroll', syncState)
    }
  }, [syncState])

  function page(direction: -1 | 1) {
    const track = trackRef.current

    if (!track) {
      return
    }

    const slide = track.querySelector<HTMLElement>('.featured-band')
    const step = slide ? slide.offsetWidth + 20 : track.clientWidth

    track.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const multiple = projects.length > 1

  return (
    <section className="featured-lane" data-flipped={flipped} aria-label={group.title}>
      <div className="featured-lane-header">
        <p className="featured-lane-kicker">{GROUP_KICKER[group.theme]}</p>
        <p className="featured-lane-blurb">{group.description}</p>

        {multiple ? (
          <div className="featured-lane-controls">
            <span className="featured-lane-count" aria-hidden="true">
              {index + 1}/{projects.length}
            </span>
            <button
              type="button"
              className="featured-arrow"
              onClick={() => page(-1)}
              disabled={!canScrollBack}
              aria-label={`Previous ${group.title} project`}
            >
              ←
            </button>
            <button
              type="button"
              className="featured-arrow"
              onClick={() => page(1)}
              disabled={!canScrollForward}
              aria-label={`Next ${group.title} project`}
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <div className="featured-viewport" data-back={canScrollBack} data-forward={canScrollForward}>
        <div className="featured-track" ref={trackRef}>
          {projects.map((project) => (
            <article className="featured-band" key={project.slug}>
              <div className="featured-media">
                {project.imageUrl || project.mediaUrl ? (
                  <MediaThumbnail
                    imageUrl={project.imageUrl}
                    mediaUrl={project.mediaUrl}
                    title={project.title}
                    onOpen={onOpenMedia}
                  />
                ) : (
                  <span className="featured-media-placeholder" aria-hidden="true">
                    {project.title.charAt(0)}
                  </span>
                )}
              </div>

              <div className="featured-content">
                <div className="featured-content-top">
                  <div className="featured-heading">
                    <h3>{project.title}</h3>
                    {project.status ? (
                      <span className="status-pill">
                        <span className="status-dot" data-status={project.status} />
                        {STATUS_LABEL[project.status]}
                      </span>
                    ) : null}
                  </div>

                  <p className="featured-description">{project.description}</p>

                  {project.tags.length > 0 ? (
                    <ul className="featured-tags" aria-label={`${project.title} tags`}>
                      {project.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="featured-actions">
                  {project.liveUrl ? (
                    <a
                      className="action-link action-link-primary"
                      href={project.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <LinkIcon name={primaryLinkIcon(project.liveLabel ?? 'Website')} />
                      {project.liveLabel ?? 'Website'}
                    </a>
                  ) : null}
                  {project.githubUrl ? (
                    <a className="action-link" href={project.githubUrl} target="_blank" rel="noreferrer">
                      <LinkIcon name="github" />
                      Source
                    </a>
                  ) : null}
                  <a className="featured-more" href={`${PROJECTS_URL}#project-${project.slug}`}>
                    Details
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Featured({ projects, onOpenMedia }: FeaturedProps) {
  const lanes = FEATURED_GROUPS.map((group) => ({
    group,
    resolved: group.slugs
      .map((slug) => projects.find((project) => project.slug === slug))
      .filter((project): project is ProjectCardData => Boolean(project)),
  })).filter(({ resolved }) => resolved.length > 0)

  if (lanes.length === 0) {
    return null
  }

  return (
    <section id="featured" className="featured-section" aria-label="Featured projects">
      <h2>Featured</h2>
      <p className="featured-intro">
        Three lanes of work: things that touch real hardware, tools shaped by living in Japan, and builds
        that were mostly just fun to make.
      </p>

      <div className="featured-lanes">
        {lanes.map(({ group, resolved }, laneIndex) => (
          <FeaturedLane
            key={group.theme}
            group={group}
            projects={resolved}
            flipped={laneIndex % 2 === 1}
            onOpenMedia={onOpenMedia}
          />
        ))}
      </div>
    </section>
  )
}
