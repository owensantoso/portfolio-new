import type { ReactElement } from 'react'

export type LaneTheme = 'language' | 'hardware' | 'music' | 'play'

const ICONS: Record<LaneTheme, ReactElement> = {
  language: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="5" x2="21" y2="5" />
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="7" y1="5" x2="7" y2="21" />
      <line x1="17" y1="5" x2="17" y2="21" />
    </svg>
  ),
  hardware: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="5" width="10" height="14" rx="2" />
      <line x1="3" y1="8" x2="7" y2="8" />
      <line x1="3" y1="12" x2="7" y2="12" />
      <line x1="3" y1="16" x2="7" y2="16" />
      <line x1="17" y1="8" x2="21" y2="8" />
      <line x1="17" y1="12" x2="21" y2="12" />
      <line x1="17" y1="16" x2="21" y2="16" />
    </svg>
  ),
  music: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="18" r="3" fill="currentColor" />
      <line x1="11" y1="18" x2="11" y2="5" />
      <path d="M11 5c4 0 6 2 6 5" />
    </svg>
  ),
  play: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
}

export function LaneIcon({ theme }: { theme: LaneTheme }) {
  return ICONS[theme] ?? null
}
