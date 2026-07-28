import { useEffect, useRef, useState } from 'react'
import type { ProjectCardData } from '../lib/projects'
import { FEATURED_GROUPS, PROJECTS_URL, type FeaturedGroup } from '../data/site-content'
import { LinkIcon, type LinkIconName } from './LinkIcon'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'
import './Featured.css'

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

type FeaturedRowProps = {
  group: FeaturedGroup
  projects: ProjectCardData[]
  onOpenMedia: (media: MediaSelection) => void
}

function FeaturedRow({ group, projects, onOpenMedia }: FeaturedRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollBack, setCanScrollBack] = useState(false)
  const [canScrollForward, setCanScrollForward] = useState(false)

  useEffect(() => {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    const updateScrollState = () => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth - 4
      setCanScrollBack(scroller.scrollLeft > 4)
      setCanScrollForward(scroller.scrollLeft < maxScrollLeft)
    }

    updateScrollState()

    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(scroller)
    scroller.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      resizeObserver.disconnect()
      scroller.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [])

  function scrollByCard(direction: -1 | 1) {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    const firstCard = scroller.querySelector<HTMLElement>('.featured-card')
    const scrollAmount = firstCard ? firstCard.offsetWidth + 20 : 360

    scroller.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <section className="featured-row" data-theme={group.theme} aria-label={group.title}>
      <div className="featured-row-header">
        <div>
          <p className="featured-row-kicker">{GROUP_KICKER[group.theme]}</p>
          <h3>{group.title}</h3>
        </div>
        <p className="featured-row-description">{group.description}</p>
      </div>

      <div className="featured-carousel">
        <button
          type="button"
          className="featured-arrow featured-arrow-left"
          onClick={() => scrollByCard(-1)}
          aria-label={`Scroll ${group.title} projects left`}
          disabled={!canScrollBack}
        >
          ←
        </button>

        <div className="featured-viewport" data-back={canScrollBack} data-forward={canScrollForward}>
          <div className="featured-scroller" ref={scrollerRef}>
            {projects.map((project) => (
              <article className="featured-card" key={project.slug}>
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
                    {project.status ? (
                      <span className="status-pill">
                        <span className="status-dot" data-status={project.status} />
                        {STATUS_LABEL[project.status]}
                      </span>
                    ) : null}

                    <h4>{project.title}</h4>
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

        <button
          type="button"
          className="featured-arrow featured-arrow-right"
          onClick={() => scrollByCard(1)}
          aria-label={`Scroll ${group.title} projects right`}
          disabled={!canScrollForward}
        >
          →
        </button>
      </div>
    </section>
  )
}

export function Featured({ projects, onOpenMedia }: FeaturedProps) {
  const groups = FEATURED_GROUPS.map((group) => ({
    group,
    projects: group.slugs
      .map((slug) => projects.find((project) => project.slug === slug))
      .filter((project): project is ProjectCardData => Boolean(project)),
  })).filter(({ projects: featuredProjects }) => featuredProjects.length > 0)

  if (groups.length === 0) {
    return null
  }

  return (
    <section id="featured" className="featured-section" aria-label="Featured projects">
      <div className="featured-section-heading">
        <div>
          <h2>Featured</h2>
        </div>
        <p className="featured-section-description">
          A few different lanes of projects: hardware-adjacent experiments, Japanese-study tools, and
          hobby builds that were just fun to make.
        </p>
      </div>

      <div className="featured-rows">
        {groups.map(({ group, projects: featuredProjects }) => (
          <FeaturedRow group={group} projects={featuredProjects} onOpenMedia={onOpenMedia} key={group.title} />
        ))}
      </div>
    </section>
  )
}
