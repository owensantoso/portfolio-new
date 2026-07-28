import type { ReactElement } from 'react'

const ICONS: Record<string, ReactElement> = {
  Web: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a10 10 0 0 1 0 20" />
    </svg>
  ),
  'Maps & location': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  'AI & audio': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="14" x2="4" y2="10" />
      <line x1="12" y1="18" x2="12" y2="6" />
      <line x1="20" y1="14" x2="20" y2="10" />
    </svg>
  ),
  'Browser extensions': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="7" width="14" height="10" rx="1" />
      <line x1="5" y1="11" x2="19" y2="11" />
      <circle cx="8" cy="14" r="1" />
      <circle cx="12" cy="14" r="1" />
      <circle cx="16" cy="14" r="1" />
    </svg>
  ),
  Automation: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M22 12h-3M3 12H0M19.1 4.9l-2.1 2.1M7 17l-2.1 2.1M19.1 19.1l-2.1-2.1M7 7l-2.1-2.1" />
    </svg>
  ),
  'Hardware-adjacent': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="9" width="8" height="6" />
      <line x1="6" y1="10" x2="6" y2="14" />
      <line x1="18" y1="10" x2="18" y2="14" />
      <line x1="10" y1="7" x2="10" y2="7" />
      <line x1="14" y1="7" x2="14" y2="7" />
      <line x1="10" y1="17" x2="10" y2="17" />
      <line x1="14" y1="17" x2="14" y2="17" />
    </svg>
  ),
  Experiments: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2h4v2h-4V2z" />
      <path d="M10 4h4l2 12H8l2-12z" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  ),
}

export function CategoryIcon({ label }: { label: string }) {
  return ICONS[label] ?? null
}
