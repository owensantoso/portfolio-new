import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const configPath = path.join(rootDir, 'src', 'data', 'project-config.json')
const outputDir = path.join(rootDir, 'public', 'data')
const outputPath = path.join(outputDir, 'projects-cache.json')

const repoApiBase = 'https://api.github.com/repos'
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

function buildHeaders(extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'portfolio-new-cache-generator',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    ...extra,
  }
}

function parseRepo(repo) {
  const [owner, name] = repo.split('/')

  if (!owner || !name) {
    throw new Error(`Invalid repo format: ${repo}`)
  }

  return { owner, name }
}

function repoNameToTitle(repo) {
  const { name } = parseRepo(repo)
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildRawBase(repo, branch) {
  const { owner, name } = parseRepo(repo)
  return `https://raw.githubusercontent.com/${owner}/${name}/${branch}/`
}

function isLikelyUsefulImage(url) {
  return !/badge|shield|shields\.io|badge\.svg/i.test(url)
}

function normalizeImageUrl(candidate, repo, branch) {
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

function extractReadmeImage(readme, repo, branch) {
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

async function fetchJson(url) {
  const response = await fetch(url, { headers: buildHeaders() })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Request failed (${response.status}) for ${url}: ${message}`)
  }

  return response.json()
}

async function fetchReadme(repo) {
  const { owner, name } = parseRepo(repo)
  const response = await fetch(`${repoApiBase}/${owner}/${name}/readme`, {
    headers: buildHeaders({ Accept: 'application/vnd.github.raw+json' }),
  })

  if (!response.ok) {
    return null
  }

  return response.text()
}

async function resolveProject(project) {
  try {
    const { owner, name } = parseRepo(project.repo)
    const payload = await fetchJson(`${repoApiBase}/${owner}/${name}`)
    const readme = project.imageUrl ? null : await fetchReadme(project.repo)
    const readmeImage =
      readme && !project.imageUrl
        ? extractReadmeImage(readme, project.repo, payload.default_branch ?? 'main')
        : null

    return {
      slug: project.slug,
      repo: project.repo,
      title: project.title ?? repoNameToTitle(project.repo),
      description:
        project.description ??
        payload.description ??
        'A recent project with details pulled from GitHub when available.',
      imageUrl: project.imageUrl ?? readmeImage,
      liveUrl: project.liveUrl ?? payload.homepage ?? null,
      githubUrl: project.githubUrl ?? payload.html_url,
      tags: project.tags ?? [],
      sortOrder: project.sortOrder ?? 999,
      sourceStatus: 'ok',
    }
  } catch (error) {
    return {
      slug: project.slug,
      repo: project.repo,
      title: project.title ?? repoNameToTitle(project.repo),
      description: project.description ?? 'Project details unavailable.',
      imageUrl: project.imageUrl ?? null,
      liveUrl: project.liveUrl ?? null,
      githubUrl: project.githubUrl ?? `https://github.com/${project.repo}`,
      tags: project.tags ?? [],
      sortOrder: project.sortOrder ?? 999,
      sourceStatus: 'error',
      fetchError: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const projectConfig = JSON.parse(await readFile(configPath, 'utf8'))
  const resolvedProjects = await Promise.all(projectConfig.map(resolveProject))
  const payload = {
    generatedAt: new Date().toISOString(),
    projects: resolvedProjects,
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`Wrote ${resolvedProjects.length} projects to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
