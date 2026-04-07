import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { ProjectCache, ProjectCardData } from './lib/projects'

const AIKO_DOWNLOAD_URL =
  'https://pub-2ebc7f4f20ce4f678a9dc932b1f9830e.r2.dev/downloads/Aiko-0.1.1-alpha-arm64.dmg'
const AIKO_IMAGE_URL = `${import.meta.env.BASE_URL}data/aiko.png`

function App() {
  const [projectCards, setProjectCards] = useState<ProjectCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const titleClickCountRef = useRef(0)
  const [isAikoUnlocked, setIsAikoUnlocked] = useState(false)
  const [animateAikoCard, setAnimateAikoCard] = useState(false)
  const [flashNumber, setFlashNumber] = useState<'6' | '7' | null>(null)
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

  useEffect(() => {
    if (!animateAikoCard) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setAnimateAikoCard(false)
    }, 1400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [animateAikoCard])

  useEffect(() => {
    if (!flashNumber) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFlashNumber(null)
    }, 950)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [flashNumber])

  useEffect(() => {
    if (searchQuery.trim() === '67') {
      setAnimateAikoCard(true)
    }
  }, [searchQuery])

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

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const showSixPrompt = normalizedQuery === '6'
  const showAikoFromSearch = normalizedQuery === '67'
  const showOnlyAiko = isAikoUnlocked && !showAikoFromSearch
  const showAikoCard =
    showAikoFromSearch ||
    (isAikoUnlocked &&
      (normalizedQuery === '' ||
        'aiko dictionary alpha release download'.includes(normalizedQuery)))

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Selected work</p>
        <button
          type="button"
          className="title-trigger"
          onClick={() => {
            if (isAikoUnlocked) {
              return
            }

            const nextCount = titleClickCountRef.current + 1
            titleClickCountRef.current = nextCount

            if (nextCount === 6) {
              setFlashNumber('6')
            }

            if (nextCount >= 7) {
              setFlashNumber('7')
              setIsAikoUnlocked(true)
              setAnimateAikoCard(true)
              titleClickCountRef.current = 7
            }
          }}
          aria-label="toso"
        >
          <h1>toso</h1>
        </button>
        <p className="hero-copy">
          Some stuff I've made.
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
          <p>How many projects are there? Minus 1 is...</p>
        </div>
        <div className="status-chip" aria-live="polite">
          {isLoading ? 'Loading project data...' : `${filteredProjects.length} projects`}
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      {flashNumber ? (
        <div className="number-flash" aria-hidden="true">
          <span key={flashNumber} className="number-flash-value">
            {flashNumber}
          </span>
        </div>
      ) : null}

      <div className="search-row">
        <input
          id="project-search"
          className="search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by title, tag, repo, or description"
        />
      </div>

      {showSixPrompt ? (
        <div className="search-omen" aria-live="polite">
          <span className="search-omen-copy">what comes after 6..?</span>
        </div>
      ) : null}

      <section
        className={`project-grid${showAikoCard ? ' project-grid-reveal' : ''}${showOnlyAiko ? ' project-grid-solo' : ''}`}
        aria-label="Project list"
      >
        {!showOnlyAiko
          ? filteredProjects.map((project) => (
              <article
                className={`project-card${showAikoFromSearch ? ' project-card-fading' : ''}`}
                key={project.slug}
              >
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
                        Open website
                      </a>
                    ) : null}
                    <a href={project.githubUrl} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  </div>
                </div>
              </article>
            ))
          : null}

        {showAikoCard ? (
          <article
            className={`project-card easter-egg-card${animateAikoCard ? ' is-revealed' : ''}${showOnlyAiko ? ' easter-egg-card-solo' : ''}`}
            key="aiko-dictionary-alpha-release"
          >
            <button
              type="button"
              className="project-image-link"
              onClick={() =>
                setSelectedImage({
                  src: AIKO_IMAGE_URL,
                  title: 'Aiko Dictionary Alpha Release',
                })
              }
              aria-label="Enlarge image for Aiko Dictionary Alpha Release"
            >
              <img
                className="project-image"
                src={AIKO_IMAGE_URL}
                alt=""
                loading="lazy"
              />
            </button>

            <div className="project-body">
              <div className="project-heading">
                <h3>Aiko Dictionary Alpha Release</h3>
                <ul className="tag-list" aria-label="Aiko Dictionary Alpha Release tags">
                  <li>Hidden</li>
                  <li>Alpha</li>
                </ul>
              </div>

              <p className="project-description">
                A tiny hidden drop for anyone who knows where to look.
              </p>

              <div className="project-links">
                <a
                  className="download-link"
                  href={AIKO_DOWNLOAD_URL}
                  download
                >
                  Download
                </a>
              </div>
            </div>
          </article>
        ) : null}
      </section>

      {!isLoading && filteredProjects.length === 0 && !showAikoCard && !showOnlyAiko ? (
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
