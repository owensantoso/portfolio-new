import type { ReactNode } from 'react'
import { PROJECTS_URL } from '../data/site-content'

type ProjectMentionLinkProps = {
  slug: string
  imageUrl: string
  mediaUrl?: string
  children: ReactNode
}

/**
 * Inline prose link to a project. Hovering shows a preview; clicking goes to the
 * projects page anchored at that project, which scrolls to and highlights it.
 */
export function ProjectMentionLink({ slug, imageUrl, mediaUrl, children }: ProjectMentionLinkProps) {
  return (
    <a href={`${PROJECTS_URL}#project-${slug}`} className="project-mention">
      {children}
      <span className="project-mention-preview" aria-hidden="true">
        {mediaUrl ? <video src={mediaUrl} autoPlay muted loop playsInline /> : <img src={imageUrl} alt="" />}
      </span>
    </a>
  )
}
