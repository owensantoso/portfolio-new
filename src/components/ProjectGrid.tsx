import type { ProjectCardData } from '../lib/projects'
import { PROJECT_CATEGORIES } from '../data/site-content'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'

type ProjectGridProps = {
  isLoading: boolean
  error: string | null
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  activeTags: string[]
  onToggleTag: (tag: string) => void
  filteredProjects: ProjectCardData[]
  onOpenMedia: (media: MediaSelection) => void
  highlightedSlug: string | null
}

export function ProjectGrid({
  isLoading,
  error,
  searchQuery,
  onSearchQueryChange,
  activeTags,
  onToggleTag,
  filteredProjects,
  onOpenMedia,
  highlightedSlug,
}: ProjectGridProps) {
  return (
    <>
      <section className="content-header" aria-label="Project status">
        <div>
          <h2>Projects</h2>
          <p>Recent builds, extensions, and a few odd experiments.</p>
        </div>
        <div className="status-chip" aria-live="polite">
          {isLoading ? 'Loading project data...' : `${filteredProjects.length} projects`}
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      <div className="search-row">
        <input
          id="project-search"
          className="search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search by title, tag, repo, or description"
        />
        <div className="tag-filter-row" role="group" aria-label="Filter by category">
          {PROJECT_CATEGORIES.map((category) => {
            const isActive = activeTags.includes(category.label)
            return (
              <button
                key={category.label}
                type="button"
                className="tag-filter-chip"
                aria-pressed={isActive}
                data-active={isActive}
                onClick={() => onToggleTag(category.label)}
              >
                {category.label}
              </button>
            )
          })}
        </div>
      </div>

      <section id="projects" className="project-grid" aria-label="Project list">
        {filteredProjects.map((project) => (
          <article
            id={`project-${project.slug}`}
            className={`project-card${project.slug === highlightedSlug ? ' project-card-highlighted' : ''}`}
            key={project.slug}
          >
            <MediaThumbnail
              imageUrl={project.imageUrl}
              mediaUrl={project.mediaUrl}
              title={project.title}
              onOpen={onOpenMedia}
            />

            <div className="project-body">
              <div className="project-heading">
                <h3>{project.title}</h3>
                {project.tags.length > 0 ? (
                  <ul className="tag-list" aria-label={`${project.title} tags`}>
                    {project.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <p className="project-description">{project.description}</p>

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
      </section>

      {!isLoading && filteredProjects.length === 0 ? (
        <p className="empty-state">No projects match that search yet.</p>
      ) : null}
    </>
  )
}
