import { useEffect, useMemo, useState } from 'react'
import '../App.css'
import { useProjects } from '../lib/useProjects'
import { HOME_URL, PROJECT_CATEGORIES } from '../data/site-content'
import { ProjectIndex } from '../components/ProjectIndex'
import { Footer } from '../components/Footer'
import { MediaLightbox } from '../components/MediaLightbox'
import { type MediaSelection } from '../components/MediaThumbnail'

export function ProjectsPage() {
  const { projects, isLoading, error } = useProjects()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection | null>(null)
  // Read once at mount: arriving from a prose mention or skill link (#project-<slug>).
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(() =>
    window.location.hash.startsWith('#project-') ? window.location.hash.slice('#project-'.length) : null,
  )

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const bySearch = normalizedQuery
      ? projects.filter((project) => {
          const haystack = [project.title, project.description, project.repo, ...project.tags]
            .join(' ')
            .toLowerCase()

          return haystack.includes(normalizedQuery)
        })
      : projects

    if (activeTags.length === 0) {
      return bySearch
    }

    // AND, not OR: each extra chip narrows the list instead of widening it.
    const activeCategories = PROJECT_CATEGORIES.filter((category) => activeTags.includes(category.label))

    return bySearch.filter((project) =>
      activeCategories.every((category) => category.slugs.includes(project.slug)),
    )
  }, [projects, searchQuery, activeTags])

  // Once the rows exist, scroll the flagged one into view and let the flag fade.
  useEffect(() => {
    if (!highlightedSlug || projects.length === 0) {
      return
    }

    const scrollTimeoutId = window.setTimeout(() => {
      document
        .getElementById(`project-${highlightedSlug}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)

    const clearTimeoutId = window.setTimeout(() => setHighlightedSlug(null), 2400)

    return () => {
      window.clearTimeout(scrollTimeoutId)
      window.clearTimeout(clearTimeoutId)
    }
  }, [highlightedSlug, projects.length])

  function handleToggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((existing) => existing !== tag) : [...current, tag],
    )
  }

  return (
    <main className="page-shell">
      <p className="page-back">
        <a href={HOME_URL}>Owen Santoso</a>
      </p>

      <ProjectIndex
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeTags={activeTags}
        onToggleTag={handleToggleTag}
        onClearFilters={() => {
          setSearchQuery('')
          setActiveTags([])
        }}
        filteredProjects={filteredProjects}
        totalCount={projects.length}
        onOpenMedia={setSelectedMedia}
        highlightedSlug={highlightedSlug}
      />

      <Footer />

      <MediaLightbox media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </main>
  )
}
