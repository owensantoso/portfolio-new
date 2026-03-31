import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { ProjectCache, ProjectCardData } from './lib/projects'

function App() {
  const [projectCards, setProjectCards] = useState<ProjectCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedImage, setSelectedImage] = useState<{
    src: string
    title: string
  } | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadProjects() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/projects-cache.json`, {
          cache: 'no-cache',
        })

        if (!response.ok) {
          throw new Error('Project cache request failed')
        }

        const payload = (await response.json()) as ProjectCache

        if (isCancelled) {
          return
        }

        const sortedProjects = payload.projects.sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder
          }

          return left.title.localeCompare(right.title)
        })

        setProjectCards(sortedProjects)

        if (sortedProjects.some((project) => project.sourceStatus === 'error')) {
          setError('Some cached project details could not be refreshed from GitHub during the last update.')
        }
      } catch {
        if (isCancelled) {
          return
        }

        setError('Project data is temporarily unavailable.')
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedImage(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return projectCards
    }

    return projectCards.filter((project) => {
      const haystack = [
        project.title,
        project.description,
        project.repo,
        ...project.tags,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [projectCards, searchQuery])

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Selected work</p>
        <h1>Owen Santoso</h1>
        <p className="hero-copy">
          A small portfolio index for live apps, experiments, and tools. Each card links
          out to the project itself and the GitHub repo behind it.
        </p>
        <a
          className="profile-link"
          href="https://github.com/owensantoso"
          target="_blank"
          rel="noreferrer"
        >
          View GitHub profile
        </a>
      </section>

      <section className="content-header" aria-label="Project status">
        <div>
          <h2>Projects</h2>
          <p>Curated manually, then refreshed from GitHub on a scheduled cache update.</p>
        </div>
        <div className="status-chip" aria-live="polite">
          {isLoading ? 'Loading project data...' : `${filteredProjects.length} projects`}
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      <div className="search-row">
        <label className="search-label" htmlFor="project-search">
          Search projects
        </label>
        <input
          id="project-search"
          className="search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by title, tag, repo, or description"
        />
      </div>

      <section className="project-grid" aria-label="Project list">
        {filteredProjects.map((project) => (
          <article className="project-card" key={project.slug}>
            {project.imageUrl ? (
              <button
                type="button"
                className="project-image-link"
                onClick={() => setSelectedImage({ src: project.imageUrl!, title: project.title })}
                aria-label={`Enlarge image for ${project.title}`}
              >
                <img className="project-image" src={project.imageUrl} alt="" loading="lazy" />
              </button>
            ) : null}

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
                    Open project
                  </a>
                ) : null}
                <a href={project.githubUrl} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!isLoading && filteredProjects.length === 0 ? (
        <p className="empty-state">No projects match that search yet.</p>
      ) : null}

      {selectedImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title}
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setSelectedImage(null)}
            aria-label="Close enlarged image"
          >
            Close
          </button>
          <img
            className="lightbox-image"
            src={selectedImage.src}
            alt=""
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </main>
  )
}

export default App
