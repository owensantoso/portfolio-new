import { useState } from 'react'
import '../App.css'
import { useProjects } from '../lib/useProjects'
import { PROJECTS_URL } from '../data/site-content'
import { Hero } from '../components/Hero'
import { Featured } from '../components/Featured'
import { About } from '../components/About'
import { Experience } from '../components/Experience'
import { Skills } from '../components/Skills'
import { Footer } from '../components/Footer'
import { SectionNav } from '../components/SectionNav'
import { MediaLightbox } from '../components/MediaLightbox'
import { type MediaSelection } from '../components/MediaThumbnail'

const HOME_SECTIONS = [
  { id: 'featured', label: 'Featured' },
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
]

export function HomePage() {
  const { projects } = useProjects()
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection | null>(null)

  return (
    <>
      <SectionNav sections={HOME_SECTIONS} />

      <main className="page-shell">
        <Hero />

        <Featured projects={projects} onOpenMedia={setSelectedMedia} />

        <About />

        <Experience />

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
