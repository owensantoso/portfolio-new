import { useEffect, useState } from 'react'
import type { NavSection } from '../components/SiteNav'

/**
 * Single source of truth for "which section am I in", shared by the top nav label
 * and the left section rail so the two can never disagree.
 *
 * Returns null while the reader is still above the first section, which is what
 * lets the nav's section label animate in rather than being there from the start.
 */
export function useActiveSection(sections: NavSection[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)

    if (elements.length === 0) {
      return
    }

    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id)
          } else {
            visible.delete(entry.target.id)
          }
        }

        // Keep document order rather than intersection order, so scrolling up and
        // down through the same boundary reports the same section.
        const current = sections.find((section) => visible.has(section.id))
        setActiveId(current ? current.id : null)
      },
      { rootMargin: '-72px 0px -55% 0px' },
    )

    for (const element of elements) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [sections])

  return activeId
}
