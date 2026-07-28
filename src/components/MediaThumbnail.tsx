import { useState } from 'react'

export type MediaSelection = {
  type: 'image' | 'video'
  src: string
  title: string
}

type MediaThumbnailProps = {
  imageUrl: string | null
  mediaUrl?: string | null
  title: string
  onOpen: (media: MediaSelection) => void
  className?: string
}

export function MediaThumbnail({ imageUrl, mediaUrl, title, onOpen, className }: MediaThumbnailProps) {
  const [isHovering, setIsHovering] = useState(false)

  if (!imageUrl && !mediaUrl) {
    return null
  }

  function handleOpen() {
    if (mediaUrl) {
      onOpen({ type: 'video', src: mediaUrl, title })
      return
    }

    if (imageUrl) {
      onOpen({ type: 'image', src: imageUrl, title })
    }
  }

  const showVideo = isHovering && Boolean(mediaUrl)

  return (
    <button
      type="button"
      className={className ? `project-image-link ${className}` : 'project-image-link'}
      onClick={handleOpen}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label={`Enlarge media for ${title}`}
    >
      {showVideo ? (
        <video className="project-image" src={mediaUrl ?? undefined} autoPlay muted loop playsInline />
      ) : (
        <img className="project-image" src={imageUrl ?? undefined} alt="" loading="lazy" />
      )}
      {mediaUrl ? (
        <span className="media-play-icon" aria-hidden="true">
          ▶
        </span>
      ) : null}
    </button>
  )
}
