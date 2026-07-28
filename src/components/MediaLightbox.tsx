import { useEffect } from 'react'
import type { MediaSelection } from './MediaThumbnail'

type MediaLightboxProps = {
  media: MediaSelection | null
  onClose: () => void
}

export function MediaLightbox({ media, onClose }: MediaLightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!media) {
    return null
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={media.title} onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close enlarged media">
        Close
      </button>
      {media.type === 'video' ? (
        <video
          className="lightbox-image"
          src={media.src}
          controls
          autoPlay
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img className="lightbox-image" src={media.src} alt="" onClick={(event) => event.stopPropagation()} />
      )}
    </div>
  )
}
