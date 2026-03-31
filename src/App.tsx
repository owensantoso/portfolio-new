import { useEffect, useState } from 'react'
import './App.css'
import type { ProjectCardData } from './lib/github'
import { resolveProject } from './lib/github'
import { projects } from './data/projects'

function App() {
  const [projectCards, setProjectCards] = useState<ProjectCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadProjects() {
      setIsLoading(true)
      setError(null)

      const results = await Promise.all(
        projects.map((project) =>
          resolveProject(project).catch(() => ({
            slug: project.slug,
            repo: project.repo,
            title: project.title ?? project.repo.split('/')[1],
            description: project.description ?? 'Project details unavailable.',
            imageUrl: project.imageUrl ?? null,
            liveUrl: project.liveUrl ?? null,
            githubUrl: project.githubUrl ?? `https://github.com/${project.repo}`,
            tags: project.tags ?? [],
            sortOrder: project.sortOrder ?? 999,
            sourceStatus: 'error' as const,
          })),
        ),
      )

      if (isCancelled) {
        return
      }

      setProjectCards(
        results.sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder
          }

          return left.title.localeCompare(right.title)
        }),
      )

      if (results.some((project) => project.sourceStatus === 'error')) {
        setError('Some GitHub details could not be loaded, so a few cards are using local fallback content.')
      }

      setIsLoading(false)
    }

    void loadProjects()

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Selected work</p>
        <h1>Recent projects, collected in one quiet place.</h1>
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
          <h2>Current projects</h2>
          <p>Curated manually, then enriched from GitHub when metadata is available.</p>
        </div>
        <div className="status-chip" aria-live="polite">
          {isLoading ? 'Loading GitHub data...' : `${projectCards.length} projects`}
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      <section className="project-grid" aria-label="Project list">
        {projectCards.map((project) => (
          <article className="project-card" key={project.slug}>
            {project.imageUrl ? (
              <a
                className="project-image-link"
                href={project.liveUrl ?? project.githubUrl}
                target="_blank"
                rel="noreferrer"
              >
                <img className="project-image" src={project.imageUrl} alt="" loading="lazy" />
              </a>
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
    </main>
  )
}

export default App
