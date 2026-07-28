# Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-hero/project-grid portfolio into a full site (Hero, Featured projects, About, Experience, Skills, filterable All-projects grid, Footer) per `docs/superpowers/specs/2026-07-28-portfolio-redesign-design.md`, plus a reusable image/video hover-and-click media interaction on project cards.

**Architecture:** `App.tsx` stays the single state owner (fetch effect, easter-egg state, search/tag-filter state, lightbox/media state) and composes new presentational components under `src/components/`. Static copy moves to `src/data/site-content.ts`. Shared media (poster image + optional hover video + click-to-open) is one component (`MediaThumbnail`) used by both the Featured section and the All-projects grid, to avoid duplicating hover/video logic.

**Tech Stack:** React 19 + TypeScript + Vite (existing). No test framework exists in this repo (no vitest/jest) — do not add one as a side effect of this work. No new runtime dependencies needed for any task below.

## Addendum (applied during implementation)

Mid-implementation, Owen asked to promote Aiko Dictionary out of the hidden easter-egg mechanic into a real featured project, swapped in for Jimoty Pickup Map. This plan's tasks were written before that change; the actual implementation deviates as follows:

- Task 6 (lightbox generalization), Task 12 (Hero), and Task 13 (ProjectGrid) no longer carry any `titleClickCountRef` / `isAikoUnlocked` / `animateAikoCard` / `flashNumber` / `showSixPrompt` / `showAikoFromSearch` / `showOnlyAiko` / `showAikoCard` state or props — that entire subsystem was deleted from `App.tsx` rather than threaded through the split components, since it existed solely to gate Aiko and had nothing left to gate once Aiko became a normal project.
- `Hero.tsx` has no `onTitleClick` prop; the title is a plain (non-interactive) heading.
- `ProjectGrid.tsx` has no special-cased Aiko `<article>` block or `aikoImageUrl` prop; Aiko flows through the normal per-project map like everything else, sourced from `project-config.json`.
- Task 1/2 data changes additionally include a new `aiko-dictionary` entry (not just `train-shade-seat`), and `jmty-map-chrome-extension` was left without `featured`/`status` fields (not marked featured).
- Dead CSS tied to the removed subsystem (`.easter-egg-card*`, `.number-flash*`, `.search-omen*`, `.project-grid-reveal`, `.project-grid-solo`, `.project-card-fading`, `.card-fallaway`, `.reveal-haze`, `.title-trigger`, `.download-link`) was removed from `App.css` rather than kept.

Everything else in this plan (schema, cache generator passthrough, design tokens, site-content module, MediaThumbnail, Featured/About/Experience/Skills/Footer components, tag-filter chips, metadata/résumé task) was implemented as written.

## Global Constraints

- No dark mode (not a priority per spec).
- No stock-photo/illustration hero.
- No em dashes in any site copy; write plainly (standing user preference, applies to all prose in this repo).
- No fabricated links, screenshots, or claims — Train Shade Seat ships with no repo/live URL and status `in-development`.
- Existing easter eggs (6/7-click Aiko unlock on the title, "6"/"67" search omens, image lightbox) must keep working exactly as before after every refactor task.
- Verification throughout is `npm run lint`, `npm run build` (runs `generate:projects` + `tsc -b` + `vite build`), and manual checks via `npm run dev` — there is no unit test suite to run instead.
- Static hosting only (GitHub Pages). No server/Vercel dependency introduced by this plan.
- Keep the existing CSS custom-property token system in `src/index.css`; extend it, never replace it.
- Hybrid visual direction locked in the design spec: warm ivory/ink-indigo/hanko-red base ("Field Notebook") + small dot-and-label status indicators ("Schematic"). No dark-PCB palette, no rotated stamp badges on every tag.

---

### Task 1: Extend project data schema

**Files:**
- Modify: `src/lib/projects.ts`
- Modify: `src/data/project-config.json`

**Interfaces:**
- Produces: `ProjectConfig.featured?: boolean`, `ProjectConfig.status?: 'live' | 'prototype' | 'in-development'`, `ProjectConfig.mediaUrl?: string`; `ProjectCardData.featured: boolean`, `ProjectCardData.status: 'live' | 'prototype' | 'in-development' | null`, `ProjectCardData.mediaUrl: string | null`

- [ ] **Step 1: Add the new fields to both types**

In `src/lib/projects.ts`, replace the file contents with:

```ts
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
  sourceStatus: 'ok' | 'error'
}

export type ProjectCache = {
  generatedAt: string
  projects: ProjectCardData[]
}
```

- [ ] **Step 2: Mark the two existing featured projects and add Train Shade Seat**

In `src/data/project-config.json`, update the `jmty-map-chrome-extension` entry (it has a live Chrome Web Store listing) by adding `"featured": true` and `"status": "live"`:

```json
    {
      "slug": "jmty-map-chrome-extension",
      "repo": "owensantoso/jmty-map-chrome-extension",
      "title": "Jimoty Pickup Map",
      "tags": ["Chrome extension", "Maps"],
      "sortOrder": 5,
      "featured": true,
      "status": "live"
    },
```

Update the `ar-spotify-lyrics` entry (personal build, no live web URL by nature) by adding `"featured": true` and `"status": "prototype"`:

```json
    {
      "slug": "ar-spotify-lyrics",
      "repo": "owensantoso/AR-spotify-lyrics",
      "title": "AR Spotify Lyrics",
      "imageUrl": "/portfolio-new/data/AR-spotify-lyrics.png",
      "tags": ["Wearables", "Spotify"],
      "sortOrder": 11,
      "featured": true,
      "status": "prototype"
    },
```

Add a new entry at the end of the array (after `big2-helper`, before the closing `]`) for the in-development project:

```json
    {
      "slug": "train-shade-seat",
      "repo": "",
      "title": "Train Shade Seat",
      "description": "Recommends which side of a train will get less direct sun, based on the line, direction of travel, time of day, and sun position.",
      "tags": ["Maps", "Experiment"],
      "sortOrder": 13,
      "featured": true,
      "status": "in-development"
    }
```

Remember to add a comma after the `big2-helper` entry's closing `}` since it's no longer the last element.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc -b`
Expected: no output, exit code 0 (the cache JSON isn't type-checked, only `.ts` files, so this just confirms `projects.ts` itself is valid).

- [ ] **Step 4: Commit**

```bash
git add src/lib/projects.ts src/data/project-config.json
git commit -m "Add featured/status/mediaUrl fields to project schema"
```

---

### Task 2: Pass new fields through the cache generator

**Files:**
- Modify: `scripts/generate-project-cache.mjs`
- Modify (generated): `public/data/projects-cache.json`

**Interfaces:**
- Consumes: `ProjectConfig` fields from Task 1 (`featured`, `status`, `mediaUrl`)
- Produces: generated `public/data/projects-cache.json` objects carrying `featured`, `status`, `mediaUrl` (this file currently reconstructs each project object field-by-field and silently drops anything not explicitly listed)

- [ ] **Step 1: Add the fields to all four `resolveProject` return branches**

In `scripts/generate-project-cache.mjs`, the no-repo branch (currently lines 190-204) becomes:

```js
  if (!project.repo) {
    return {
      slug: project.slug,
      repo: '',
      title: manualTitle(project),
      description:
        project.description ??
        'A recent project with details maintained directly in this portfolio.',
      imageUrl: project.imageUrl ?? null,
      mediaUrl: project.mediaUrl ?? null,
      liveUrl: project.liveUrl ?? null,
      liveLabel: project.liveLabel ?? null,
      githubUrl: project.githubUrl ?? null,
      tags: project.tags ?? [],
      sortOrder: project.sortOrder ?? 999,
      featured: project.featured ?? false,
      status: project.status ?? null,
      sourceStatus: 'ok',
    }
  }
```

The image-error branch (currently lines 219-237) becomes:

```js
    try {
      imageUrl = await resolveImageUrl(project, project.imageUrl ?? readmeImage)
    } catch (imageError) {
      return {
        slug: project.slug,
        repo: project.repo,
        title: project.title ?? repoNameToTitle(project.repo),
        description:
          project.description ??
          payload.description ??
          'A recent project with details pulled from GitHub when available.',
        imageUrl: null,
        mediaUrl: project.mediaUrl ?? null,
        liveUrl: project.liveUrl ?? payload.homepage ?? null,
        liveLabel: project.liveLabel ?? null,
        githubUrl: project.githubUrl ?? payload.html_url,
        tags: project.tags ?? [],
        sortOrder: project.sortOrder ?? 999,
        featured: project.featured ?? false,
        status: project.status ?? null,
        sourceStatus: 'error',
        fetchError: imageError instanceof Error ? imageError.message : String(imageError),
      }
    }
```

The success branch (currently lines 239-254) becomes:

```js
    return {
      slug: project.slug,
      repo: project.repo,
      title: project.title ?? repoNameToTitle(project.repo),
      description:
        project.description ??
        payload.description ??
        'A recent project with details pulled from GitHub when available.',
      imageUrl,
      mediaUrl: project.mediaUrl ?? null,
      liveUrl: project.liveUrl ?? payload.homepage ?? null,
      liveLabel: project.liveLabel ?? null,
      githubUrl: project.githubUrl ?? payload.html_url,
      tags: project.tags ?? [],
      sortOrder: project.sortOrder ?? 999,
      featured: project.featured ?? false,
      status: project.status ?? null,
      sourceStatus: 'ok',
    }
```

The outer catch branch (currently lines 256-270) becomes:

```js
  } catch (error) {
    return {
      slug: project.slug,
      repo: project.repo,
      title: project.title ?? repoNameToTitle(project.repo),
      description: project.description ?? 'Project details unavailable.',
      imageUrl: project.imageUrl ?? null,
      mediaUrl: project.mediaUrl ?? null,
      liveUrl: project.liveUrl ?? null,
      liveLabel: project.liveLabel ?? null,
      githubUrl: project.githubUrl ?? `https://github.com/${project.repo}`,
      tags: project.tags ?? [],
      sortOrder: project.sortOrder ?? 999,
      featured: project.featured ?? false,
      status: project.status ?? null,
      sourceStatus: 'error',
      fetchError: error instanceof Error ? error.message : String(error),
    }
  }
```

- [ ] **Step 2: Regenerate the cache**

Run: `npm run generate:projects`
Expected: `Wrote 13 projects to .../public/data/projects-cache.json` (13, not 12, since Train Shade Seat was added in Task 1).

- [ ] **Step 3: Verify the new fields landed**

Run: `grep -A2 '"train-shade-seat"' public/data/projects-cache.json`
Expected output includes `"featured": true` and `"status": "in-development"` somewhere in that object (exact line wrap may vary since it's pretty-printed JSON — check by eye if grep context doesn't capture it: `python3 -c "import json; d=json.load(open('public/data/projects-cache.json')); p=[x for x in d['projects'] if x['slug']=='train-shade-seat'][0]; print(p['featured'], p['status'], p['repo'])"` should print `True in-development` — note Python bool renders `True`, this is just a sanity read, not asserting on Python's own casing).

Also check the two existing featured projects:
Run: `python3 -c "import json; d=json.load(open('public/data/projects-cache.json')); [print(p['slug'], p['featured'], p['status']) for p in d['projects'] if p['slug'] in ('ar-spotify-lyrics','jmty-map-chrome-extension')]"`
Expected: `ar-spotify-lyrics True prototype` and `jmty-map-chrome-extension True live`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-project-cache.mjs public/data/projects-cache.json
git commit -m "Pass featured/status/mediaUrl through the project cache generator"
```

---

### Task 3: Add design tokens for the hybrid visual direction

**Files:**
- Modify: `src/index.css:1-21`

**Interfaces:**
- Produces: CSS custom properties `--accent-hanko`, `--tape`, `--status-live`, `--status-prototype`, `--status-dev`, `--photo-frame-bg`, `--photo-frame-shadow` available globally

- [ ] **Step 1: Add the new tokens to `:root`**

In `src/index.css`, within the existing `:root { ... }` block (after the existing `--border-strong: rgba(36, 49, 38, 0.22);` line), add:

```css
  --accent-hanko: #b23a2e;
  --tape: rgba(178, 58, 46, 0.1);
  --status-live: #3f8f5f;
  --status-prototype: #b8862c;
  --status-dev: #8a8f86;
  --photo-frame-bg: #fffcf4;
  --photo-frame-shadow: 0 10px 24px rgba(36, 49, 38, 0.18);
```

- [ ] **Step 2: Verify the build still compiles CSS cleanly**

Run: `npm run build`
Expected: succeeds (`vite build` step completes, no CSS parse errors). Since nothing references these tokens yet, this only proves the syntax is valid.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Add hybrid design tokens (hanko accent, status colors, photo frame)"
```

---

### Task 4: Site content data module

**Files:**
- Create: `src/data/site-content.ts`

**Interfaces:**
- Produces: `CONTACT`, `HERO_ROLE`, `HERO_TAGLINE`, `HERO_PHOTO_URL`, `ABOUT_TEXT`, `EXPERIENCE`, `SKILLS`, `PROJECT_CATEGORIES`, `FEATURED_ORDER` — all imported by later component tasks.

- [ ] **Step 1: Create the file**

```ts
export const CONTACT = {
  email: 'nos.santoso@gmail.com',
  github: 'https://github.com/owensantoso',
  linkedin: 'https://www.linkedin.com/in/owen-santoso/',
  resumeUrl: `${import.meta.env.BASE_URL}resume.pdf`,
  location: 'Tokyo, Japan',
}

export const HERO_ROLE = 'Owen Santoso'

export const HERO_TAGLINE =
  "Software engineer in Tokyo. I build small tools for problems I run into personally, and take a few apart just to see how they work."

// Pending: drop a portrait file into public/ and set this to its path
// (e.g. "/portfolio-new/data/owen-portrait.jpg"). Hero renders no photo frame while this is null.
export const HERO_PHOTO_URL: string | null = null

export const ABOUT_TEXT =
  "I'm a software engineer based in Tokyo with a background in electrical and electronic engineering. Professionally I've worked across Java, Kotlin, React and SQL inside a ten-plus-year production codebase at LogicVein, shipping full-stack features and chasing down UI defects and race conditions. Outside of work I build tools around problems I run into myself: a Chrome extension that puts a map on Jimoty listings, a page that tracks one Spotify playlist over time, glasses that show synced lyrics. I like projects that force me to connect things that weren't built to talk to each other. Native English, JLPT N2 Japanese."

export type ExperienceEntry = {
  company: string
  role: string
  dates: string
  bullets: string[]
}

export const EXPERIENCE: ExperienceEntry[] = [
  {
    company: 'LogicVein',
    role: 'Software Engineer',
    dates: 'Mar 2025 – Oct 2025',
    bullets: [
      'Built full-stack features across a Java/Kotlin backend and React frontend in a codebase over ten years old',
      'Wired REST endpoints to UI, tracked down state and race-condition bugs',
      'Worked in Japanese with QA to reproduce and verify fixes',
    ],
  },
  {
    company: 'Jacobs Engineering',
    role: 'Electrical Engineering Intern',
    dates: 'Nov 2022 – Feb 2024',
    bullets: [
      'Ran the data analysis behind a solar consultation that landed 15% cost and 20% energy savings',
      'Built out electrical schedules for 50+ low-voltage circuits',
    ],
  },
  {
    company: 'exida',
    role: 'Engineering Risk Intern',
    dates: 'Nov 2021 – Feb 2022',
    bullets: [
      'Wrote Python automation that cut down the safety-certificate creation process',
      'Supported IEC 61508/61511 safety training material for Rio Tinto',
    ],
  },
]

export type SkillGroup = {
  group: string
  items: string[]
}

export const SKILLS: SkillGroup[] = [
  { group: 'Languages', items: ['Java', 'Kotlin', 'JavaScript', 'Python', 'SQL', 'C'] },
  { group: 'Frontend', items: ['React', 'Redux', 'REST APIs', 'HTML/CSS'] },
  { group: 'Tooling', items: ['Git', 'Linux', 'Docker', 'PostgreSQL'] },
  {
    group: 'Other',
    items: ['Maps & geospatial', 'Audio & signal processing', 'AI/LLM tooling', 'Hardware-adjacent (BLE, embedded)'],
  },
]

export type ProjectCategory = {
  label: string
  slugs: string[]
}

// Curated by hand on purpose (only ~13 projects) rather than keyword-matched against
// free-form tags, so a weak-fit project just doesn't get a chip instead of being forced in.
export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    label: 'Web',
    slugs: ['grocery-price-map', 'spotify-playlist-tracker', 'subtitle-companion-mvp', 'vgm-recordings-browser', 'big2-helper'],
  },
  {
    label: 'Maps & location',
    slugs: ['grocery-price-map', 'jmty-map-chrome-extension', 'train-shade-seat'],
  },
  {
    label: 'AI & audio',
    slugs: ['guitar-note-visualizer', 'whisper-lecture-enhancer', 'vgm-recordings-browser'],
  },
  {
    label: 'Browser extensions',
    slugs: ['guitar-chord-companion', 'jmty-map-chrome-extension'],
  },
  {
    label: 'Automation',
    slugs: ['switchbot-tools', 'whisper-lecture-enhancer'],
  },
  {
    label: 'Hardware-adjacent',
    slugs: ['xgimi-elfin-ble-wake', 'switchbot-tools', 'ar-spotify-lyrics'],
  },
  {
    label: 'Experiments',
    slugs: ['xgimi-elfin-ble-wake', 'ar-spotify-lyrics', 'train-shade-seat'],
  },
]

export const FEATURED_ORDER = ['ar-spotify-lyrics', 'jmty-map-chrome-extension', 'train-shade-seat']
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/data/site-content.ts
git commit -m "Add site-content data module for hero/about/experience/skills copy"
```

---

### Task 5: Shared MediaThumbnail component

**Files:**
- Create: `src/components/MediaThumbnail.tsx`
- Modify: `src/App.css` (append new rules, don't touch existing ones)

**Interfaces:**
- Consumes: nothing from earlier tasks except React itself
- Produces: `export type MediaSelection = { type: 'image' | 'video'; src: string; title: string }`, `export function MediaThumbnail(props: MediaThumbnailProps)` where `MediaThumbnailProps = { imageUrl: string | null; mediaUrl?: string | null; title: string; onOpen: (media: MediaSelection) => void; className?: string }`. Task 6 and later tasks (Featured, ProjectGrid) both consume this.

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Add supporting CSS**

Append to `src/App.css`:

```css
.media-play-icon {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(20, 26, 20, 0.55);
  color: #fff;
  font-size: 0.7rem;
  pointer-events: none;
}

.project-image-link {
  position: relative;
}
```

Note: `.project-image-link` already has positioning rules elsewhere in `App.css` (display/width/aspect-ratio) — this second declaration only adds `position: relative` so the play icon can be absolutely positioned inside it; it does not conflict with the existing block.

- [ ] **Step 3: Verify the build**

Run: `npx tsc -b && npm run build`
Expected: succeeds. `MediaThumbnail` isn't imported anywhere yet, so an unused-file is fine (TypeScript doesn't error on unimported files).

- [ ] **Step 4: Commit**

```bash
git add src/components/MediaThumbnail.tsx src/App.css
git commit -m "Add shared MediaThumbnail component for hover/click media preview"
```

---

### Task 6: Generalize the lightbox to support video

**Files:**
- Modify: `src/App.tsx:18-21` (state type), `src/App.tsx:246-336` (the two `setSelectedImage` call sites), `src/App.tsx:343-366` (lightbox render block)

**Interfaces:**
- Consumes: `MediaSelection` type from Task 5 (`src/components/MediaThumbnail.tsx`)
- Produces: `selectedMedia: MediaSelection | null` state and `setSelectedMedia` setter, replacing the old `selectedImage` state. Later tasks (Featured, ProjectGrid) receive `setSelectedMedia` as an `onOpenMedia` prop.

This task only touches `App.tsx` — no new components yet — so the existing single-file behavior can be verified unchanged before the file gets split apart in later tasks.

- [ ] **Step 1: Replace the `selectedImage` state with `selectedMedia`**

In `src/App.tsx`, replace:

```tsx
  const [selectedImage, setSelectedImage] = useState<{
    src: string
    title: string
  } | null>(null)
```

with:

```tsx
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection | null>(null)
```

and add the import at the top of the file (alongside the existing `import type { ProjectCache, ProjectCardData } from './lib/projects'`):

```tsx
import type { MediaSelection } from './components/MediaThumbnail'
```

- [ ] **Step 2: Update the two click handlers that open the lightbox**

Replace:

```tsx
                    onClick={() => setSelectedImage({ src: project.imageUrl!, title: project.title })}
```

with:

```tsx
                    onClick={() => setSelectedMedia({ type: 'image', src: project.imageUrl!, title: project.title })}
```

Replace:

```tsx
              onClick={() =>
                setSelectedImage({
                  src: AIKO_IMAGE_URL,
                  title: 'Aiko Dictionary Alpha Release',
                })
              }
```

with:

```tsx
              onClick={() =>
                setSelectedMedia({
                  type: 'image',
                  src: AIKO_IMAGE_URL,
                  title: 'Aiko Dictionary Alpha Release',
                })
              }
```

- [ ] **Step 3: Update the lightbox render block to handle video**

Replace the existing block:

```tsx
      {selectedImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title}
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setSelectedImage(null)}
            aria-label="Close enlarged image"
          >
            Close
          </button>
          <img
            className="lightbox-image"
            src={selectedImage.src}
            alt=""
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
```

with:

```tsx
      {selectedMedia ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={selectedMedia.title}
          onClick={() => setSelectedMedia(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setSelectedMedia(null)}
            aria-label="Close enlarged media"
          >
            Close
          </button>
          {selectedMedia.type === 'video' ? (
            <video
              className="lightbox-image"
              src={selectedMedia.src}
              controls
              autoPlay
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              className="lightbox-image"
              src={selectedMedia.src}
              alt=""
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
      ) : null}
```

- [ ] **Step 4: Verify nothing broke**

Run: `npx tsc -b`
Expected: no output, exit code 0.

Run: `npm run dev`, open the site, click a project image.
Expected: lightbox still opens showing the image exactly as before (the `type: 'image'` path renders the same `<img>` element). Press Escape or click outside to close — still works (existing `keydown` effect wasn't touched).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "Generalize lightbox state to support image or video media"
```

---

### Task 7: Footer component

**Files:**
- Create: `src/components/Footer.tsx`
- Modify: `src/App.tsx` (render the footer inside `<main className="page-shell">`, after the closing lightbox block, before `</main>`)
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `CONTACT` from `src/data/site-content.ts` (Task 4)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Create the component**

```tsx
import { CONTACT } from '../data/site-content'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="footer-links">
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        <a href={CONTACT.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={CONTACT.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a href={CONTACT.resumeUrl} target="_blank" rel="noreferrer">
          Résumé
        </a>
        <span className="footer-location">{CONTACT.location}</span>
      </div>
      <p className="footer-copyright">© {year} Owen Santoso</p>
    </footer>
  )
}
```

- [ ] **Step 2: Wire it into `App.tsx`**

Add the import near the top:

```tsx
import { Footer } from './components/Footer'
```

Add `<Footer />` immediately before the closing `</main>` tag at the end of the returned JSX (after the lightbox conditional block from Task 6).

- [ ] **Step 3: Add CSS**

Append to `src/App.css`:

```css
.site-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 56px;
  padding-top: 28px;
  border-top: 1px solid var(--border);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
}

.footer-links a {
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.footer-links a:hover {
  border-color: currentColor;
}

.footer-location {
  color: var(--muted);
  margin-left: auto;
}

.footer-copyright {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run build`
Expected: succeeds.

Run: `npm run dev`, scroll to the bottom of the page.
Expected: footer shows email/GitHub/LinkedIn/Résumé links, "Tokyo, Japan", and a copyright line under a thin top border.

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx src/App.tsx src/App.css
git commit -m "Add Footer section with contact links"
```

---

### Task 8: About component

**Files:**
- Create: `src/components/About.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `ABOUT_TEXT` from `src/data/site-content.ts`

- [ ] **Step 1: Create the component**

```tsx
import { ABOUT_TEXT } from '../data/site-content'

export function About() {
  return (
    <section className="about-section" aria-label="About">
      <h2>About</h2>
      <p>{ABOUT_TEXT}</p>
    </section>
  )
}
```

- [ ] **Step 2: Wire it in**

Add the import: `import { About } from './components/About'`

Render `<About />` in `App.tsx` — placement will be finalized once Featured (Task 11) exists, but for now render it directly after the closing `</section>` of the existing hero block (so the order reads Hero → About temporarily; Task 11 will insert Featured between them).

- [ ] **Step 3: Add CSS**

Append to `src/App.css`:

```css
.about-section {
  display: grid;
  gap: 16px;
  padding: 40px 0;
  border-top: 1px solid var(--border);
  max-width: 62ch;
}

.about-section p {
  line-height: 1.65;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run build`, then `npm run dev` and confirm the About paragraph renders under the hero.

- [ ] **Step 5: Commit**

```bash
git add src/components/About.tsx src/App.tsx src/App.css
git commit -m "Add About section"
```

---

### Task 9: Experience component

**Files:**
- Create: `src/components/Experience.tsx`
- Modify: `src/App.tsx` (render `<Experience />` after `<About />`)
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `EXPERIENCE`, `ExperienceEntry` from `src/data/site-content.ts`

- [ ] **Step 1: Create the component**

```tsx
import { EXPERIENCE } from '../data/site-content'

export function Experience() {
  return (
    <section className="experience-section" aria-label="Experience">
      <h2>Experience</h2>
      <ul className="experience-list">
        {EXPERIENCE.map((entry) => (
          <li className="experience-entry" key={entry.company}>
            <div className="experience-heading">
              <h3>
                {entry.company} — {entry.role}
              </h3>
              <p className="experience-dates">{entry.dates}</p>
            </div>
            <ul className="experience-bullets">
              {entry.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: Wire it in**

Add `import { Experience } from './components/Experience'`, render `<Experience />` right after `<About />`.

- [ ] **Step 3: Add CSS**

Append to `src/App.css`:

```css
.experience-section {
  padding: 40px 0;
  border-top: 1px solid var(--border);
}

.experience-list {
  list-style: none;
  margin: 20px 0 0;
  padding: 0;
  display: grid;
  gap: 28px;
}

.experience-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.experience-heading h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 400;
}

.experience-dates {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  white-space: nowrap;
}

.experience-bullets {
  margin: 10px 0 0;
  padding-left: 1.2em;
  display: grid;
  gap: 6px;
  color: var(--muted);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run build`, then `npm run dev` and confirm three experience entries render with company/role/dates and bullets.

- [ ] **Step 5: Commit**

```bash
git add src/components/Experience.tsx src/App.tsx src/App.css
git commit -m "Add Experience section"
```

---

### Task 10: Skills component

**Files:**
- Create: `src/components/Skills.tsx`
- Modify: `src/App.tsx` (render `<Skills />` after `<Experience />`)
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `SKILLS`, `SkillGroup` from `src/data/site-content.ts`

- [ ] **Step 1: Create the component**

```tsx
import { SKILLS } from '../data/site-content'

export function Skills() {
  return (
    <section className="skills-section" aria-label="Skills">
      <h2>Skills</h2>
      <div className="skills-grid">
        {SKILLS.map((group) => (
          <div className="skills-group" key={group.group}>
            <p className="skills-group-label">{group.group}</p>
            <ul className="skills-items">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire it in**

Add `import { Skills } from './components/Skills'`, render `<Skills />` right after `<Experience />`.

- [ ] **Step 3: Add CSS**

Append to `src/App.css`:

```css
.skills-section {
  padding: 40px 0;
  border-top: 1px solid var(--border);
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-top: 20px;
}

.skills-group-label {
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.72rem;
  color: var(--muted);
}

.skills-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run build`, then `npm run dev` and confirm four skill groups render in a responsive grid.

- [ ] **Step 5: Commit**

```bash
git add src/components/Skills.tsx src/App.tsx src/App.css
git commit -m "Add Skills section"
```

---

### Task 11: Featured projects component

**Files:**
- Create: `src/components/Featured.tsx`
- Modify: `src/App.tsx` (render `<Featured projects={projectCards} onOpenMedia={setSelectedMedia} />` between the hero section and `<About />`)
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `ProjectCardData` type (`src/lib/projects.ts`), `FEATURED_ORDER` (`src/data/site-content.ts`), `MediaThumbnail`/`MediaSelection` (`src/components/MediaThumbnail.tsx`, Task 5)
- Produces: `FeaturedProps = { projects: ProjectCardData[]; onOpenMedia: (media: MediaSelection) => void }`

- [ ] **Step 1: Create the component**

```tsx
import type { ProjectCardData } from '../lib/projects'
import { FEATURED_ORDER } from '../data/site-content'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'

type FeaturedProps = {
  projects: ProjectCardData[]
  onOpenMedia: (media: MediaSelection) => void
}

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  prototype: 'Prototype',
  'in-development': 'In development',
}

export function Featured({ projects, onOpenMedia }: FeaturedProps) {
  const featured = FEATURED_ORDER.map((slug) => projects.find((project) => project.slug === slug)).filter(
    (project): project is ProjectCardData => Boolean(project),
  )

  if (featured.length === 0) {
    return null
  }

  return (
    <section className="featured-section" aria-label="Featured projects">
      <h2>Featured</h2>
      <div className="featured-grid">
        {featured.map((project) => (
          <article className="featured-card" key={project.slug}>
            <MediaThumbnail
              imageUrl={project.imageUrl}
              mediaUrl={project.mediaUrl}
              title={project.title}
              onOpen={onOpenMedia}
            />
            <div className="featured-body">
              {project.status ? (
                <span className="status-pill" data-status={project.status}>
                  <span className="status-dot" data-status={project.status} />
                  {STATUS_LABEL[project.status]}
                </span>
              ) : null}
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              {project.tags.length > 0 ? (
                <ul className="tag-list" aria-label={`${project.title} tags`}>
                  {project.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
              <div className="project-links">
                {project.liveUrl ? (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    {project.liveLabel ?? 'Open website'}
                  </a>
                ) : null}
                {project.githubUrl ? (
                  <a href={project.githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
```

Note: when a project has no `imageUrl` and no `mediaUrl` (won't happen for the three current featured projects, but guards the general case), `MediaThumbnail` returns `null` and the card just shows text — same graceful behavior as the existing grid cards.

- [ ] **Step 2: Wire it into `App.tsx`**

Add `import { Featured } from './components/Featured'`.

Render `<Featured projects={projectCards} onOpenMedia={setSelectedMedia} />` immediately after the closing `</section>` of the hero block and before `<About />`.

- [ ] **Step 3: Add CSS**

Append to `src/App.css`:

```css
.featured-section {
  padding: 40px 0 8px;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 26px;
  margin-top: 20px;
}

.featured-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: clip;
  box-shadow: 0 18px 45px rgba(16, 24, 19, 0.06);
}

.featured-card .project-image-link {
  display: block;
  width: 100%;
  border: 0;
  padding: 0;
  aspect-ratio: 16 / 10;
  background: linear-gradient(135deg, rgba(205, 220, 208, 0.8), rgba(249, 250, 247, 0.8));
  cursor: pointer;
}

.featured-body {
  display: grid;
  gap: 12px;
  padding: 22px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  font-size: 0.76rem;
  letter-spacing: 0.04em;
  color: var(--muted);
  text-transform: uppercase;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--status-dev);
}

.status-dot[data-status='live'] {
  background: var(--status-live);
}

.status-dot[data-status='prototype'] {
  background: var(--status-prototype);
}

.status-dot[data-status='in-development'] {
  background: var(--status-dev);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run build`, then `npm run dev`.
Expected: a "Featured" section renders between the hero and About, showing AR Spotify Lyrics, Jimoty Pickup Map, and Train Shade Seat as larger cards, each with a status dot + label. Train Shade Seat's card has no image (MediaThumbnail returns null there) and no links (both are `null` in its config) — confirm it still renders title/description/tags without crashing.

- [ ] **Step 5: Commit**

```bash
git add src/components/Featured.tsx src/App.tsx src/App.css
git commit -m "Add Featured projects section"
```

---

### Task 12: Hero component

**Files:**
- Create: `src/components/Hero.tsx`
- Modify: `src/App.tsx` (remove the inline hero JSX, replace with `<Hero ... />`)
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `HERO_ROLE`, `HERO_TAGLINE`, `HERO_PHOTO_URL`, `CONTACT` from `src/data/site-content.ts`
- Produces: `HeroProps = { onTitleClick: () => void }` (the click-counter logic that unlocks the Aiko easter egg stays as state in `App.tsx`; `Hero` just calls the callback on each click)

- [ ] **Step 1: Create the component**

```tsx
import { CONTACT, HERO_PHOTO_URL, HERO_ROLE, HERO_TAGLINE } from '../data/site-content'

type HeroProps = {
  onTitleClick: () => void
}

export function Hero({ onTitleClick }: HeroProps) {
  return (
    <section className="hero">
      <p className="eyebrow">toso</p>
      <div className="hero-main">
        {HERO_PHOTO_URL ? (
          <div className="hero-photo-frame">
            <img className="hero-photo" src={HERO_PHOTO_URL} alt={HERO_ROLE} />
          </div>
        ) : null}
        <div className="hero-copy-block">
          <button type="button" className="title-trigger" onClick={onTitleClick} aria-label={HERO_ROLE}>
            <h1>{HERO_ROLE}</h1>
          </button>
          <p className="hero-copy">{HERO_TAGLINE}</p>
          <div className="hero-buttons">
            <a className="profile-link" href="#projects">
              View projects
            </a>
            <a className="profile-link" href={CONTACT.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="profile-link" href={CONTACT.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a className="profile-link" href={CONTACT.resumeUrl} target="_blank" rel="noreferrer">
              Résumé
            </a>
            <a className="profile-link" href={`mailto:${CONTACT.email}`}>
              Email
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Replace the inline hero block in `App.tsx`**

Remove the existing:

```tsx
      <section className="hero">
        <p className="eyebrow">Selected work</p>
        <button
          type="button"
          className="title-trigger"
          onClick={() => {
            if (isAikoUnlocked) {
              return
            }

            const nextCount = titleClickCountRef.current + 1
            titleClickCountRef.current = nextCount

            if (nextCount === 6) {
              setFlashNumber('6')
            }

            if (nextCount >= 7) {
              setFlashNumber('7')
              setIsAikoUnlocked(true)
              setAnimateAikoCard(true)
              titleClickCountRef.current = 7
            }
          }}
          aria-label="toso"
        >
          <h1>toso</h1>
        </button>
        <p className="hero-copy">
          Some stuff I've made.
        </p>
        <a
          className="profile-link"
          href="https://github.com/owensantoso"
          target="_blank"
          rel="noreferrer"
        >
          View GitHub profile
        </a>
      </section>
```

Replace it with:

```tsx
      <Hero
        onTitleClick={() => {
          if (isAikoUnlocked) {
            return
          }

          const nextCount = titleClickCountRef.current + 1
          titleClickCountRef.current = nextCount

          if (nextCount === 6) {
            setFlashNumber('6')
          }

          if (nextCount >= 7) {
            setFlashNumber('7')
            setIsAikoUnlocked(true)
            setAnimateAikoCard(true)
            titleClickCountRef.current = 7
          }
        }}
      />
```

Add `import { Hero } from './components/Hero'` near the top of `App.tsx`.

Also add `id="projects"` to the existing `<section className="project-grid...">` element (or its nearest wrapping section once Task 13 extracts `ProjectGrid`) so the hero's "View projects" link has something to scroll to — for now, add the id directly to the current grid `<section>` in `App.tsx`.

- [ ] **Step 3: Add CSS**

Append to `src/App.css`:

```css
.hero-main {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.hero-photo-frame {
  flex: 0 0 auto;
  width: 132px;
  padding: 8px 8px 20px;
  background: var(--photo-frame-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: var(--photo-frame-shadow);
  transform: rotate(-2deg);
}

.hero-photo {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 2px;
}

.hero-copy-block {
  display: grid;
  gap: 18px;
  flex: 1 1 320px;
}

.hero-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
```

Note: the existing `.profile-link` rule (in `App.css`) already styles pill buttons — `.hero-buttons` just lays several of them out in a row, replacing the old single-link usage.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run build`, then `npm run dev`.
Expected: hero shows "Owen Santoso" as the clickable title (no photo yet, since `HERO_PHOTO_URL` is `null`), the new tagline, and five pill buttons (Projects/GitHub/LinkedIn/Résumé/Email). Click the title 7 times fast — Aiko easter egg still unlocks exactly as before (flash numbers, revealed card in the grid).

- [ ] **Step 5: Commit**

```bash
git add src/components/Hero.tsx src/App.tsx src/App.css
git commit -m "Add Hero section with contact buttons and photo-frame slot"
```

---

### Task 13: ProjectGrid component with tag filters

**Files:**
- Create: `src/components/ProjectGrid.tsx`
- Modify: `src/App.tsx` (remove the inline search/grid JSX, replace with `<ProjectGrid ... />`; add `activeTags` state and category-filter logic)
- Modify: `src/App.css` (append)

**Interfaces:**
- Consumes: `ProjectCardData` (`src/lib/projects.ts`), `PROJECT_CATEGORIES` (`src/data/site-content.ts`), `MediaThumbnail`/`MediaSelection` (Task 5)
- Produces: `ProjectGridProps` (listed in Step 1) — this is the last extraction, so after this task `App.tsx` is a thin composition of `Hero`, `Featured`, `About`, `Experience`, `Skills`, `ProjectGrid`, `Footer`.

- [ ] **Step 1: Add tag-filter state and derived filtering logic in `App.tsx`**

Add new state near the existing `searchQuery` state:

```tsx
  const [activeTags, setActiveTags] = useState<string[]>([])
```

Add the import: `import { PROJECT_CATEGORIES } from './data/site-content'`

Replace the existing `filteredProjects` memo:

```tsx
  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return projectCards
    }

      return projectCards.filter((project) => {
        const haystack = [
          project.title,
          project.description,
          project.repo,
        ...project.tags,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [projectCards, searchQuery])
```

with a version that also applies the active category filters (union across selected categories — picking more than one chip broadens results, matching how the search box already works alongside it):

```tsx
  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const bySearch = normalizedQuery
      ? projectCards.filter((project) => {
          const haystack = [project.title, project.description, project.repo, ...project.tags]
            .join(' ')
            .toLowerCase()

          return haystack.includes(normalizedQuery)
        })
      : projectCards

    if (activeTags.length === 0) {
      return bySearch
    }

    const activeSlugs = new Set(
      PROJECT_CATEGORIES.filter((category) => activeTags.includes(category.label)).flatMap(
        (category) => category.slugs,
      ),
    )

    return bySearch.filter((project) => activeSlugs.has(project.slug))
  }, [projectCards, searchQuery, activeTags])
```

Add a toggle handler near the other handlers:

```tsx
  function handleToggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((existing) => existing !== tag) : [...current, tag],
    )
  }
```

- [ ] **Step 2: Create `ProjectGrid.tsx`**

```tsx
import type { ProjectCardData } from '../lib/projects'
import { PROJECT_CATEGORIES } from '../data/site-content'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'

const AIKO_DOWNLOAD_URL =
  'https://pub-2ebc7f4f20ce4f678a9dc932b1f9830e.r2.dev/downloads/Aiko-0.1.1-alpha-arm64.dmg'

type ProjectGridProps = {
  isLoading: boolean
  error: string | null
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  activeTags: string[]
  onToggleTag: (tag: string) => void
  filteredProjects: ProjectCardData[]
  showSixPrompt: boolean
  showAikoCard: boolean
  showOnlyAiko: boolean
  showAikoFromSearch: boolean
  animateAikoCard: boolean
  aikoImageUrl: string
  onOpenMedia: (media: MediaSelection) => void
}

export function ProjectGrid({
  isLoading,
  error,
  searchQuery,
  onSearchQueryChange,
  activeTags,
  onToggleTag,
  filteredProjects,
  showSixPrompt,
  showAikoCard,
  showOnlyAiko,
  showAikoFromSearch,
  animateAikoCard,
  aikoImageUrl,
  onOpenMedia,
}: ProjectGridProps) {
  return (
    <>
      <section className="content-header" aria-label="Project status">
        <div>
          <h2>Projects</h2>
          <p>How many projects are there? Minus 1 is...</p>
        </div>
        <div className="status-chip" aria-live="polite">
          {isLoading ? 'Loading project data...' : `${filteredProjects.length} projects`}
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      <div className="search-row">
        <input
          id="project-search"
          className="search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search by title, tag, repo, or description"
        />
        <div className="tag-filter-row" role="group" aria-label="Filter by category">
          {PROJECT_CATEGORIES.map((category) => {
            const isActive = activeTags.includes(category.label)
            return (
              <button
                key={category.label}
                type="button"
                className="tag-filter-chip"
                aria-pressed={isActive}
                data-active={isActive}
                onClick={() => onToggleTag(category.label)}
              >
                {category.label}
              </button>
            )
          })}
        </div>
      </div>

      {showSixPrompt ? (
        <div className="search-omen" aria-live="polite">
          <span className="search-omen-copy">what comes after 6..?</span>
        </div>
      ) : null}

      <section
        id="projects"
        className={`project-grid${showAikoCard ? ' project-grid-reveal' : ''}${showOnlyAiko ? ' project-grid-solo' : ''}`}
        aria-label="Project list"
      >
        {!showOnlyAiko
          ? filteredProjects.map((project) => (
              <article
                className={`project-card${showAikoFromSearch ? ' project-card-fading' : ''}`}
                key={project.slug}
              >
                <MediaThumbnail
                  imageUrl={project.imageUrl}
                  mediaUrl={project.mediaUrl}
                  title={project.title}
                  onOpen={onOpenMedia}
                />

                <div className="project-body">
                  <div className="project-heading">
                    <h3>{project.title}</h3>
                    {project.tags.length > 0 ? (
                      <ul className="tag-list" aria-label={`${project.title} tags`}>
                        {project.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <p className="project-description">{project.description}</p>

                  <div className="project-links">
                    {project.liveUrl ? (
                      <a href={project.liveUrl} target="_blank" rel="noreferrer">
                        {project.liveLabel ?? 'Open website'}
                      </a>
                    ) : null}
                    {project.githubUrl ? (
                      <a href={project.githubUrl} target="_blank" rel="noreferrer">
                        GitHub
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          : null}

        {showAikoCard ? (
          <article
            className={`project-card easter-egg-card${animateAikoCard ? ' is-revealed' : ''}${showOnlyAiko ? ' easter-egg-card-solo' : ''}`}
            key="aiko-dictionary-alpha-release"
          >
            <button
              type="button"
              className="project-image-link"
              onClick={() =>
                onOpenMedia({
                  type: 'image',
                  src: aikoImageUrl,
                  title: 'Aiko Dictionary Alpha Release',
                })
              }
              aria-label="Enlarge image for Aiko Dictionary Alpha Release"
            >
              <img className="project-image" src={aikoImageUrl} alt="" loading="lazy" />
            </button>

            <div className="project-body">
              <div className="project-heading">
                <h3>Aiko Dictionary Alpha Release</h3>
                <ul className="tag-list" aria-label="Aiko Dictionary Alpha Release tags">
                  <li>Hidden</li>
                  <li>Alpha</li>
                </ul>
              </div>

              <p className="project-description">A tiny hidden drop for anyone who knows where to look.</p>

              <div className="project-links">
                <a className="download-link" href={AIKO_DOWNLOAD_URL} download>
                  Download
                </a>
              </div>
            </div>
          </article>
        ) : null}
      </section>

      {!isLoading && filteredProjects.length === 0 && !showAikoCard && !showOnlyAiko ? (
        <p className="empty-state">No projects match that search yet.</p>
      ) : null}
    </>
  )
}
```

Note: `AIKO_DOWNLOAD_URL` moves here since only this component uses it now; `AIKO_IMAGE_URL` stays computed in `App.tsx` (it depends on `import.meta.env.BASE_URL`, still needed there for the effect-free constant) and is passed down as `aikoImageUrl`.

- [ ] **Step 3: Replace the inline grid JSX in `App.tsx`**

Remove the existing `<section className="content-header">...` through the `<p className="empty-state">...` block (everything between the closing hero/search-omen area and the lightbox block), replacing it with:

```tsx
      <ProjectGrid
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeTags={activeTags}
        onToggleTag={handleToggleTag}
        filteredProjects={filteredProjects}
        showSixPrompt={showSixPrompt}
        showAikoCard={showAikoCard}
        showOnlyAiko={showOnlyAiko}
        showAikoFromSearch={showAikoFromSearch}
        animateAikoCard={animateAikoCard}
        aikoImageUrl={AIKO_IMAGE_URL}
        onOpenMedia={setSelectedMedia}
      />
```

Add `import { ProjectGrid } from './components/ProjectGrid'`.

Remove the now-unused `AIKO_DOWNLOAD_URL` constant from `App.tsx` (moved into `ProjectGrid.tsx` in Step 2).

Since `ProjectGrid` now renders the `id="projects"` section internally, remove the `id="projects"` you added directly to the grid `<section>` in Task 12 Step 2 if it's still there as a separate edit (it should already be part of the JSX being replaced in this step, so just confirm the replacement block above keeps `id="projects"` on the `<section className="project-grid...">` — it does).

- [ ] **Step 4: Add tag-filter chip CSS**

Append to `src/App.css`:

```css
.tag-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-filter-chip {
  font-size: 0.84rem;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
}

.tag-filter-chip:hover {
  border-color: var(--border-strong);
}

.tag-filter-chip[data-active='true'] {
  border-color: var(--accent-hanko);
  color: var(--accent-hanko);
  background: var(--tape);
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run build`
Expected: succeeds with no unused-variable errors (confirms the `AIKO_DOWNLOAD_URL` move was clean).

Run: `npm run dev`.
Expected: search box still filters as before; tag-filter chips appear below it, clicking one filters the grid to matching slugs (per the `PROJECT_CATEGORIES` mapping from Task 4), clicking it again clears that filter; typing "6" still shows the search-omen; typing "67" (or unlocking via 7 title clicks) still reveals the Aiko card and its download link; clicking any project image still opens the lightbox.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProjectGrid.tsx src/App.tsx src/App.css
git commit -m "Extract ProjectGrid component and add tag-filter chips"
```

---

### Task 14: Metadata, résumé asset, and mobile pass

**Files:**
- Modify: `index.html`
- Create: `public/resume.pdf` (binary copy)
- Modify: `src/App.css:499-518` (existing mobile media query)

**Interfaces:** none (leaf task)

- [ ] **Step 1: Update `index.html` head**

Replace the existing `<head>` contents:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="A simple portfolio page collecting recent projects by toso."
    />
    <title>toso</title>
  </head>
```

with:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Owen Santoso, software engineer in Tokyo. Practical tools, browser extensions, and a few odd interfaces."
    />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Owen Santoso" />
    <meta
      property="og:description"
      content="Software engineer in Tokyo. Practical tools, browser extensions, and a few odd interfaces."
    />
    <meta property="og:image" content="/portfolio-new/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>Owen Santoso</title>
  </head>
```

Note on `apple-touch-icon`: pointing it at the existing SVG is a stopgap (Apple devices technically expect PNG) — flagged as an open item in the spec; fine to leave as-is until Owen supplies a PNG icon.

Note on `og:image`: `/portfolio-new/og-image.png` does not exist yet — this is a genuine pending external asset (like the hero photo), not a code placeholder. Social platforms that can't fetch it simply show no preview image, which is a safe degrade. Owen needs to add a 1200×630 PNG at `public/og-image.png` (using the same ivory/ink-indigo/hanko-red tokens from Task 3 for visual consistency) before this tag does anything.

- [ ] **Step 2: Copy the résumé into `public/`**

```bash
cp "/Users/macintoso/Documents/VSCode/LOGICVEIN CODEX/Nathan Owen Santoso Resume - English Software 2026May13.pdf" "/Users/macintoso/Documents/VSCode/portfolio-new/public/resume.pdf"
```

This is the file `CONTACT.resumeUrl` (Task 4) already points at via `${import.meta.env.BASE_URL}resume.pdf`.

- [ ] **Step 3: Extend the mobile breakpoint for the new sections**

In `src/App.css`, the existing `@media (max-width: 720px) { ... }` block (currently around lines 499-518) gets these additions appended inside it (before the closing `}`):

```css
  .hero-main {
    flex-direction: column;
  }

  .hero-photo-frame {
    width: 108px;
  }

  .featured-grid {
    grid-template-columns: 1fr;
  }

  .experience-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .footer-location {
    margin-left: 0;
  }
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds, and `dist/resume.pdf` exists after the build (`ls dist/resume.pdf`).

Run: `npm run dev`, resize the browser to a narrow width (or use device toolbar at ~375px).
Expected: hero stacks vertically, featured cards go single-column, experience entries stack their date under the role, footer location no longer pins to the right edge.

- [ ] **Step 5: Commit**

```bash
git add index.html public/resume.pdf src/App.css
git commit -m "Add OG/meta tags, resume asset, and mobile styles for new sections"
```

---

## Post-implementation notes for Owen (not tasks, just context)

- `HERO_PHOTO_URL` in `src/data/site-content.ts` is `null`. Drop your portrait at e.g. `public/data/owen-portrait.jpg`, then set `HERO_PHOTO_URL = '/portfolio-new/data/owen-portrait.jpg'`.
- `og-image.png` doesn't exist yet — add a 1200×630 PNG at `public/og-image.png` whenever you want link previews to show an image.
- No project has `mediaUrl` set yet. Once you record a clip for a project, add `"mediaUrl": "/portfolio-new/data/project-media/<file>.mp4"` to that project's entry in `src/data/project-config.json`, drop the file at `public/data/project-media/<file>.mp4`, and run `npm run generate:projects` to pick it up.
- Train Shade Seat has no repo/live URL by design. Once it exists, give it `repo`, `liveUrl`, and `imageUrl` in `project-config.json` and flip its `status` to `prototype` or `live`.
