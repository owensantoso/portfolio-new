export type ProjectConfig = {
  slug: string
  repo: string
  liveUrl?: string
  githubUrl?: string
  title?: string
  description?: string
  imageUrl?: string
  tags?: string[]
  sortOrder?: number
}

export type ProjectCardData = {
  slug: string
  repo: string
  title: string
  description: string
  imageUrl: string | null
  liveUrl: string | null
  githubUrl: string
  tags: string[]
  sortOrder: number
  sourceStatus: 'ok' | 'error'
}

export type ProjectCache = {
  generatedAt: string
  projects: ProjectCardData[]
}
