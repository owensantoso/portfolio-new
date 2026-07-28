import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { ProjectCache, ProjectCardData } from './lib/projects'
import { PROJECT_CATEGORIES } from './data/site-content'
import { Hero } from './components/Hero'
import { Featured } from './components/Featured'
import { About } from './components/About'
import { Experience } from './components/Experience'
import { Skills } from './components/Skills'
import { ProjectGrid } from './components/ProjectGrid'
import { Footer } from './components/Footer'
import { type MediaSelection } from './components/MediaThumbnail'

function App() {
  const [projectCards, setProjectCards] = useState<ProjectCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection | null>(null)
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null)

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
        setSelectedMedia(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const bySearch = normalizedQuery
      ? projectCards.filter((project) => {
          const haystack = [project.title, project.description, project.repo, ...project.tags]
            .join(' ')
            .toLowerCase()

          return haystack.includes(normalizedQuery)
        })
      : projectCards

    if (activeTags.length === 0) {
      return bySearch
    }

    // AND, not OR: each extra chip narrows the list instead of widening it.
    const activeCategories = PROJECT_CATEGORIES.filter((category) => activeTags.includes(category.label))

    return bySearch.filter((project) =>
      activeCategories.every((category) => category.slugs.includes(project.slug)),
    )
  }, [projectCards, searchQuery, activeTags])

  function handleToggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((existing) => existing !== tag) : [...current, tag],
    )
  }

  function handleSelectProject(slug: string) {
    setSearchQuery('')
    setActiveTags([])
    setHighlightedSlug(slug)
  }

  useEffect(() => {
    if (!highlightedSlug) {
      return
    }

    const scrollTimeoutId = window.setTimeout(() => {
      document.getElementById(`project-${highlightedSlug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)

    const clearTimeoutId = window.setTimeout(() => setHighlightedSlug(null), 1800)

    return () => {
      window.clearTimeout(scrollTimeoutId)
      window.clearTimeout(clearTimeoutId)
    }
  }, [highlightedSlug])

  return (
    <main className="page-shell">
      <Hero />

      <Featured projects={projectCards} onOpenMedia={setSelectedMedia} />

      <About onSelectProject={handleSelectProject} />

      <Experience />

      <Skills />

      <ProjectGrid
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeTags={activeTags}
        onToggleTag={handleToggleTag}
        filteredProjects={filteredProjects}
        onOpenMedia={setSelectedMedia}
        highlightedSlug={highlightedSlug}
      />

      <Footer />

      {selectedMedia ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={selectedMedia.title}
          onClick={() => setSelectedMedia(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setSelectedMedia(null)}
            aria-label="Close enlarged media"
          >
            Close
          </button>
          {selectedMedia.type === 'video' ? (
            <video
              className="lightbox-image"
              src={selectedMedia.src}
              controls
              autoPlay
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              className="lightbox-image"
              src={selectedMedia.src}
              alt=""
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
      ) : null}
    </main>
  )
}

export default App
