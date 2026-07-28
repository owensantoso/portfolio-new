export type ProjectStatus = 'live' | 'prototype' | 'in-development'

export type ProjectConfig = {
  slug: string
  repo?: string
  liveUrl?: string
  liveLabel?: string
  githubUrl?: string
  title?: string
  description?: string
  imageUrl?: string
  mediaUrl?: string
  tags?: string[]
  sortOrder?: number
  featured?: boolean
  status?: ProjectStatus
}

export type ProjectCardData = {
  slug: string
  repo: string
  title: string
  description: string
  imageUrl: string | null
  mediaUrl: string | null
  liveUrl: string | null
  liveLabel: string | null
  githubUrl: string | null
  tags: string[]
  sortOrder: number
  featured: boolean
  status: ProjectStatus | null
  /** 'stale' means a GitHub refresh failed but previously cached details were kept. */
  sourceStatus: 'ok' | 'error' | 'stale'
}

export type ProjectCache = {
  generatedAt: string
  projects: ProjectCardData[]
}
