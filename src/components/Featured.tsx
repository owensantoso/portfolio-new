import type { ProjectCardData } from '../lib/projects'
import { FEATURED_ORDER } from '../data/site-content'
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

export function Featured({ projects, onOpenMedia }: FeaturedProps) {
  const featured = FEATURED_ORDER.map((slug) => projects.find((project) => project.slug === slug)).filter(
    (project): project is ProjectCardData => Boolean(project),
  )

  if (featured.length === 0) {
    return null
  }

  return (
    <section className="featured-section" aria-label="Featured projects">
      <h2>Featured</h2>
      <div className="featured-grid">
        {featured.map((project) => (
          <article className="featured-card" key={project.slug}>
            <MediaThumbnail
              imageUrl={project.imageUrl}
              mediaUrl={project.mediaUrl}
              title={project.title}
              onOpen={onOpenMedia}
            />
            <div className="featured-body">
              {project.status ? (
                <span className="status-pill">
                  <span className="status-dot" data-status={project.status} />
                  {STATUS_LABEL[project.status]}
                </span>
              ) : null}
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              {project.tags.length > 0 ? (
                <ul className="tag-list" aria-label={`${project.title} tags`}>
                  {project.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
              <div className="project-links">
                {project.liveUrl ? (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    {project.liveLabel ?? 'Open website'}
                  </a>
                ) : null}
                {project.githubUrl ? (
                  <a href={project.githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
