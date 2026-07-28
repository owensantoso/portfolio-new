import './ProjectIndex.css'
import type { ProjectCardData } from '../lib/projects'
import { PROJECT_CATEGORIES } from '../data/site-content'
import { CategoryIcon } from './CategoryIcon'
import { LinkIcon, type LinkIconName } from './LinkIcon'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'

type ProjectIndexProps = {
  isLoading: boolean
  error: string | null
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  activeTags: string[]
  onToggleTag: (tag: string) => void
  onClearFilters: () => void
  filteredProjects: ProjectCardData[]
  totalCount: number
  onOpenMedia: (media: MediaSelection) => void
  highlightedSlug: string | null
}

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  prototype: 'Prototype',
  'in-development': 'In development',
}

/** The primary link is not always a website, so let its label pick the icon. */
function primaryLinkIcon(label: string): LinkIconName {
  const normalized = label.toLowerCase()

  if (normalized.includes('download')) return 'download'
  if (normalized.includes('store')) return 'store'
  if (normalized.includes('case study')) return 'resume'

  return 'external'
}

export function ProjectIndex({
  isLoading,
  error,
  searchQuery,
  onSearchQueryChange,
  activeTags,
  onToggleTag,
  onClearFilters,
  filteredProjects,
  totalCount,
  onOpenMedia,
  highlightedSlug,
}: ProjectIndexProps) {
  const isFiltered = activeTags.length > 0 || searchQuery.trim() !== ''

  return (
    <>
      <header className="index-header">
        <h1>Projects</h1>
        <p>
          Everything I've built and kept around. Most of it started as a problem I had, a few as pure
          curiosity.
        </p>
      </header>

      {error ? <p className="notice">{error}</p> : null}

      <div className="index-controls">
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
                <CategoryIcon label={category.label} />
                {category.label}
              </button>
            )
          })}
        </div>

        <p className="index-count" aria-live="polite">
          {isLoading ? (
            'Loading projects...'
          ) : (
            <>
              <span>
                {filteredProjects.length} of {totalCount}
              </span>
              {isFiltered ? (
                <button type="button" className="index-clear" onClick={onClearFilters}>
                  Clear
                </button>
              ) : null}
            </>
          )}
        </p>
      </div>

      <ol className="project-index" aria-label="Project list">
        {filteredProjects.map((project) => (
          <li
            id={`project-${project.slug}`}
            className="index-row"
            data-highlighted={project.slug === highlightedSlug}
            key={project.slug}
          >
            <div className="index-thumb">
              {project.imageUrl || project.mediaUrl ? (
                <MediaThumbnail
                  imageUrl={project.imageUrl}
                  mediaUrl={project.mediaUrl}
                  title={project.title}
                  onOpen={onOpenMedia}
                />
              ) : (
                <span className="index-thumb-placeholder" aria-hidden="true">
                  {project.title.charAt(0)}
                </span>
              )}
            </div>

            <div className="index-body">
              <div className="index-row-heading">
                <h2>{project.title}</h2>
                {project.status ? (
                  <span className="status-pill">
                    <span className="status-dot" data-status={project.status} />
                    {STATUS_LABEL[project.status]}
                  </span>
                ) : null}
              </div>

              <p className="index-description">{project.description}</p>

              {project.tags.length > 0 ? (
                <ul className="index-tags" aria-label={`${project.title} tags`}>
                  {project.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="index-links">
              {project.liveUrl ? (
                <a className="index-link index-link-primary" href={project.liveUrl} target="_blank" rel="noreferrer">
                  <LinkIcon name={primaryLinkIcon(project.liveLabel ?? 'Open')} />
                  {project.liveLabel ?? 'Open'}
                </a>
              ) : null}
              {project.githubUrl ? (
                <a className="index-link" href={project.githubUrl} target="_blank" rel="noreferrer">
                  <LinkIcon name="github" />
                  Source
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {!isLoading && filteredProjects.length === 0 ? (
        <p className="empty-state">Nothing matches those filters. {isFiltered ? 'Try clearing them.' : ''}</p>
      ) : null}
    </>
  )
}
