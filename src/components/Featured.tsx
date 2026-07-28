import './Featured.css'
import type { ProjectCardData } from '../lib/projects'
import { FEATURED_ORDER, PROJECTS_URL } from '../data/site-content'
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

function primaryLinkIcon(label: string): LinkIconName {
  const normalized = label.toLowerCase()

  if (normalized.includes('download')) return 'download'
  if (normalized.includes('store')) return 'store'
  if (normalized.includes('case study')) return 'resume'

  return 'external'
}

export function Featured({ projects, onOpenMedia }: FeaturedProps) {
  const featured = FEATURED_ORDER.map((slug) => projects.find((project) => project.slug === slug)).filter(
    (project): project is ProjectCardData => Boolean(project),
  )

  if (featured.length === 0) {
    return null
  }

  return (
    <section id="featured" className="featured-section" aria-label="Featured projects">
      <h2>Featured</h2>

      <div className="featured-bands">
        {featured.map((project) => (
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
                {project.status ? (
                  <span className="status-pill">
                    <span className="status-dot" data-status={project.status} />
                    {STATUS_LABEL[project.status]}
                  </span>
                ) : null}

                <h3>{project.title}</h3>
                <p className="featured-description">{project.description}</p>

                {project.tags.length > 0 ? (
                  <ul className="featured-tags" aria-label={`${project.title} tags`}>
                    {project.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {/* Pinned to the bottom of the column so actions line up across bands
                  no matter how long each description runs. */}
              <div className="featured-actions">
                {project.liveUrl ? (
                  <a
                    className="action-link action-link-primary"
                    href={project.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LinkIcon name={primaryLinkIcon(project.liveLabel ?? 'Open')} />
                    {project.liveLabel ?? 'Open'}
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
    </section>
  )
}
