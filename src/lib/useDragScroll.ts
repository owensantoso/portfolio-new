// Enables map-like mouse dragging on a horizontally scrollable element.
import { useEffect, useRef } from 'react'
import type React from 'react'

const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, video, [role="button"]'
const DRAG_THRESHOLD = 6

export function useDragScroll<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
): void {
  const dragStateRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startScrollLeft: 0,
    isDragging: false,
  })
  const clickSuppressorRef = useRef<((event: MouseEvent) => void) | null>(null)

  useEffect(() => {
    const container = ref.current

    if (!container) {
      return
    }

    const removeClickSuppressor = () => {
      if (clickSuppressorRef.current) {
        container.removeEventListener('click', clickSuppressorRef.current, true)
        clickSuppressorRef.current = null
      }
    }

    const suppressNextClick = () => {
      removeClickSuppressor()

      const suppressClick = (event: MouseEvent) => {
        event.stopPropagation()
        event.preventDefault()
        clickSuppressorRef.current = null
      }

      clickSuppressorRef.current = suppressClick
      container.addEventListener('click', suppressClick, {
        capture: true,
        once: true,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      // A drag does not always produce a trailing click. Drop any suppressor left
      // over from the previous gesture so it cannot swallow this one.
      removeClickSuppressor()

      if (event.pointerType !== 'mouse' || event.button !== 0) {
        return
      }

      if (
        event.target instanceof Element &&
        event.target.closest(INTERACTIVE_SELECTOR)
      ) {
        return
      }

      const state = dragStateRef.current
      state.pointerId = event.pointerId
      state.startX = event.clientX
      state.startScrollLeft = container.scrollLeft
      state.isDragging = false
      container.setPointerCapture?.(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current

      if (state.pointerId !== event.pointerId) {
        return
      }

      const deltaX = event.clientX - state.startX

      if (!state.isDragging && Math.abs(deltaX) <= DRAG_THRESHOLD) {
        return
      }

      if (!state.isDragging) {
        state.isDragging = true
        container.classList.add('is-dragging')
      }

      container.scrollLeft = state.startScrollLeft - deltaX
      event.preventDefault()
    }

    const handlePointerEnd = (event: PointerEvent) => {
      const state = dragStateRef.current

      if (state.pointerId !== event.pointerId) {
        return
      }

      if (state.isDragging) {
        suppressNextClick()
      }

      if (container.hasPointerCapture?.(event.pointerId)) {
        container.releasePointerCapture?.(event.pointerId)
      }

      state.pointerId = null
      state.isDragging = false
      container.classList.remove('is-dragging')
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', handlePointerEnd)
    container.addEventListener('pointercancel', handlePointerEnd)
    container.addEventListener('pointerleave', handlePointerEnd)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', handlePointerEnd)
      container.removeEventListener('pointercancel', handlePointerEnd)
      container.removeEventListener('pointerleave', handlePointerEnd)
      removeClickSuppressor()
      container.classList.remove('is-dragging')
    }
  }, [ref])
}
