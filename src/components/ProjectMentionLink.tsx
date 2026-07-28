import type { ReactNode } from 'react'

type ProjectMentionLinkProps = {
  slug: string
  imageUrl: string
  mediaUrl?: string
  onSelect: (slug: string) => void
  children: ReactNode
}

export function ProjectMentionLink({ slug, imageUrl, mediaUrl, onSelect, children }: ProjectMentionLinkProps) {
  return (
    <a
      href={`#project-${slug}`}
      className="project-mention"
      onClick={(event) => {
        event.preventDefault()
        onSelect(slug)
      }}
    >
      {children}
      <span className="project-mention-preview" aria-hidden="true">
        {mediaUrl ? (
          <video src={mediaUrl} autoPlay muted loop playsInline />
        ) : (
          <img src={imageUrl} alt="" />
        )}
      </span>
    </a>
  )
}
