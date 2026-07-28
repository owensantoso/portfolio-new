import { useState } from 'react'
import '../App.css'
import { useProjects } from '../lib/useProjects'
import { useActiveSection } from '../lib/useActiveSection'
import { PROJECTS_URL } from '../data/site-content'
import { Hero } from '../components/Hero'
import { Featured } from '../components/Featured'
import { About } from '../components/About'
import { Experience } from '../components/Experience'
import { Education } from '../components/Education'
import { Skills } from '../components/Skills'
import { Footer } from '../components/Footer'
import { SiteNav, type NavSection } from '../components/SiteNav'
import { SectionRail } from '../components/SectionRail'
import { MediaLightbox } from '../components/MediaLightbox'
import { type MediaSelection } from '../components/MediaThumbnail'

// Module scope keeps the identity stable, so the observer is not rebuilt per render.
const HOME_SECTIONS: NavSection[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
]

export function HomePage() {
  const { projects } = useProjects()
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection | null>(null)
  const activeId = useActiveSection(HOME_SECTIONS)

  const activeLabel = HOME_SECTIONS.find((section) => section.id === activeId)?.label ?? null

  return (
    <>
      <SiteNav page="home" sectionLabel={activeLabel} />
      <SectionRail sections={HOME_SECTIONS} activeId={activeId} />

      <main className="page-shell">
        <Hero />

        <Featured projects={projects} onOpenMedia={setSelectedMedia} />

        <About />

        <Experience />

        <Education />

        <Skills />

        <p className="all-projects-cta">
          <a href={PROJECTS_URL}>See all projects</a>
        </p>

        <Footer />

        <MediaLightbox media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      </main>
    </>
  )
}
