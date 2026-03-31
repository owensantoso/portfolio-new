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

type RepoMetadata = {
  description: string | null
  homepage: string | null
  htmlUrl: string
  defaultBranch: string
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

function parseRepo(repo: string) {
  const [owner, name] = repo.split('/')

  if (!owner || !name) {
    throw new Error(`Invalid repo format: ${repo}`)
  }

  return { owner, name }
}

function buildRawBase(repo: string, branch: string) {
  const { owner, name } = parseRepo(repo)
  return `https://raw.githubusercontent.com/${owner}/${name}/${branch}/`
}

function isLikelyUsefulImage(url: string) {
  return !/badge|shield|shields\.io|badge\.svg/i.test(url)
}

function normalizeImageUrl(candidate: string, repo: string, branch: string) {
  const trimmed = candidate.trim()

  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  if (trimmed.startsWith('/')) {
    const { owner, name } = parseRepo(repo)
    return `https://raw.githubusercontent.com/${owner}/${name}/${branch}${trimmed}`
  }

  return new URL(trimmed, buildRawBase(repo, branch)).toString()
}

export function extractReadmeImage(readme: string, repo: string, branch: string) {
  const markdownMatches = [...readme.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
  const htmlMatches = [...readme.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
  const candidates = [
    ...markdownMatches.map((match) => match[1]),
    ...htmlMatches.map((match) => match[1]),
  ]

  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate, repo, branch)

    if (normalized && isLikelyUsefulImage(normalized)) {
      return normalized
    }
  }

  return null
}

export async function fetchRepoMetadata(repo: string): Promise<RepoMetadata> {
  const { owner, name } = parseRepo(repo)
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`)

  if (!response.ok) {
    throw new Error(`GitHub repo request failed for ${repo}`)
  }

  const payload = await response.json()

  return {
    description: payload.description ?? null,
    homepage: payload.homepage ?? null,
    htmlUrl: payload.html_url,
    defaultBranch: payload.default_branch ?? 'main',
  }
}

async function fetchReadme(repo: string) {
  const { owner, name } = parseRepo(repo)
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
    },
  })

  if (!response.ok) {
    return null
  }

  return response.text()
}

function repoNameToTitle(repo: string) {
  const name = parseRepo(repo).name
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function resolveProject(project: ProjectConfig): Promise<ProjectCardData> {
  const metadata = await fetchRepoMetadata(project.repo)
  const readme = project.imageUrl ? null : await fetchReadme(project.repo)
  const readmeImage =
    readme && !project.imageUrl
      ? extractReadmeImage(project.repo === '' ? '' : readme, project.repo, metadata.defaultBranch)
      : null

  return {
    slug: project.slug,
    repo: project.repo,
    title: project.title ?? repoNameToTitle(project.repo),
    description:
      project.description ??
      metadata.description ??
      'A recent project with details pulled from GitHub when available.',
    imageUrl: project.imageUrl ?? readmeImage,
    liveUrl: project.liveUrl ?? metadata.homepage ?? null,
    githubUrl: project.githubUrl ?? metadata.htmlUrl,
    tags: project.tags ?? [],
    sortOrder: project.sortOrder ?? 999,
    sourceStatus: 'ok',
  }
}
