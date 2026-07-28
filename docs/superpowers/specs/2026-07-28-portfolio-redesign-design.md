# Portfolio redesign — design spec

Date: 2026-07-28

## Goal

Current site (owensantoso.github.io/portfolio-new) is a single hero + searchable project grid. It doesn't answer who Owen is, what kind of engineer he is, which projects matter most, what his professional experience is, or how to contact/hire him. This spec covers a redesign that answers those while keeping the site's existing serif/sage personality and playful easter eggs.

Source material: résumé `Nathan Owen Santoso Resume - English Software 2026May13.pdf` (the authoritative, later of two versions supplied — see Resume notes below), existing repo content in `src/data/project-config.json` and `public/data/projects-cache.json`.

## Resume notes (flagged during brainstorming, resolved)

- Two résumé versions existed; the May13 one is authoritative. It shows LogicVein as **Mar 2025 – Oct 2025** (ended), not "Present" as in the older draft.
- Confirmed with Owen: he left LogicVein, currently job hunting. Site should read as an active professional identity (not "currently employed"), Experience section uses the exact Mar–Oct 2025 dates as-is.
- Skills not listed on résumé but confirmed real by Owen: Redux, PostgreSQL, Docker, Git, Linux. Safe to include in Skills section.
- Contact facts confirmed: email `nos.santoso@gmail.com`, LinkedIn `https://www.linkedin.com/in/owen-santoso/`, résumé = the May13 PDF as-is.

## Visual direction

Hybrid of two explored directions (see published mockup, both approved by Owen):

- **Base palette/type from "Field Notebook":** warm ivory paper, ink-indigo text, hanko-red accent, serif display/body (system stack: `"Iowan Old Style", "Palatino Linotype", Georgia, serif` for display, current `Newsreader` stays for body). Occasional (not universal) slight tag rotation as a quiet whimsical touch — not on every chip, not on hardware/technical project cards.
- **Status signal from "Schematic":** small dot + label (`● live`, `● prototype`, `● in development`) instead of a rotated stamp badge, so hardware/technical projects (BLE case study, SwitchBot Tools) read credible next to lighter projects (Big2 Helper, guitar tuner).
- Keep existing CSS custom-property system in `src/index.css`; extend tokens, don't replace the approach.
- Photo: small framed portrait in hero, mounted like a photo tucked into a notebook page — slight rotation, small drop shadow, torn-corner tab accent. File pending from Owen (placeholder slot until provided).

No dark mode (per original brief, not a priority). No large stock-illustration hero.

## Copy

**Hero tagline (selected):** "Software engineer in Tokyo. I build small tools for problems I run into personally, and take a few apart just to see how they work."

No "open to work" badge in the hero — kept understated per the brief's anti-corporate direction; Résumé/Email/LinkedIn buttons carry that signal implicitly. Easy to add a small status pill later if Owen wants it more explicit.

**About (~120 words):**
> I'm a software engineer based in Tokyo with a background in electrical and electronic engineering. Professionally I've worked across Java, Kotlin, React and SQL inside a ten-plus-year production codebase at LogicVein, shipping full-stack features and chasing down UI defects and race conditions. Outside of work I build tools around problems I run into myself: a Chrome extension that puts a map on Jimoty listings, a page that tracks one Spotify playlist over time, glasses that show synced lyrics. I like projects that force me to connect things that weren't built to talk to each other. Native English, JLPT N2 Japanese.

**Experience** (3 entries, dates/claims match résumé exactly):

- **LogicVein — Software Engineer, Mar 2025 – Oct 2025**
  - Built full-stack features across a Java/Kotlin backend and React frontend in a codebase over ten years old
  - Wired REST endpoints to UI, tracked down state/race-condition bugs
  - Worked in Japanese with QA to reproduce and verify fixes
- **Jacobs Engineering — Electrical Engineering Intern, Nov 2022 – Feb 2024**
  - Ran the data analysis behind a solar consultation that landed 15% cost and 20% energy savings
  - Built out electrical schedules for 50+ low-voltage circuits
- **exida — Engineering Risk Intern, Nov 2021 – Feb 2022**
  - Wrote Python automation that cut down the safety-certificate creation process
  - Supported IEC 61508/61511 safety training material for Rio Tinto

(UWAYE extracurricular role omitted from this section per original brief — resume-recap isn't the goal here.)

**Skills (grouped, not a logo cloud):**
- Languages: Java, Kotlin, JavaScript, Python, SQL, C
- Frontend: React, Redux, REST APIs, HTML/CSS
- Tooling: Git, Linux, Docker, PostgreSQL
- Other: Maps/geospatial, audio and signal processing, AI/LLM tooling, hardware-adjacent (BLE, embedded)

**Footer:** Email, GitHub, LinkedIn, Résumé, "Tokyo, Japan", small copyright line. No "Built with React" badge.

## Addendum (post-approval change)

Mid-implementation, Owen asked to drop Aiko Dictionary from being a hidden click-counter/search-omen easter egg and make it a real, always-visible featured project instead, swapped in for Jimoty Pickup Map. Implemented as:

- Removed the entire title-click-counter, number-flash, and "6"/"67" search-omen subsystem from `App.tsx` (it existed only to gate Aiko; with Aiko always visible it had nothing left to gate).
- Added `aiko-dictionary` as a normal entry in `project-config.json` (description: "A macOS dictionary app for Japanese learners, currently an early alpha build," using the existing `aiko.png` image and R2-hosted `.dmg` download link).
- `FEATURED_ORDER` is now `['ar-spotify-lyrics', 'aiko-dictionary', 'train-shade-seat']`. Jimoty Pickup Map is no longer featured but stays in the regular All-projects grid unchanged.
- The image-click lightbox still exists (generalized to support video per the Media hover/click section below) but is no longer tied to any unlock mechanic — every project's media just opens the lightbox directly.

## Featured projects (3, more space/detail than grid cards)

1. **AR Spotify Lyrics** — status: prototype. Real data already in `projects-cache.json:167-182`: "A personal MentraOS app that shows Spotify lyrics on Even Realities G1 glasses, with optional Chinese/Japanese/Korean romanization and live per-user settings." Has image + GitHub repo, no live URL (expected — wearable app, not web-hosted).
2. **Jimoty Pickup Map** — status: live (Chrome Web Store). Real data in `projects-cache.json:67-82`.
3. **Train Shade Seat** — status: in development. New entry, no repo/live URL. Concept line only: "Recommends which side of a train will get less direct sun, based on the line, direction of travel, time of day, and sun position." No screenshots, no fabricated links — placeholder card until Owen provides repo/screenshots.

## All-projects section

Keep existing search input and grid mechanics as-is. Add clickable tag-filter chips above/alongside search:

`Web` · `Maps & location` · `AI & audio` · `Browser extensions` · `Automation` · `Hardware-adjacent` · `Experiments`

Multi-tag: a project can belong to more than one category filter. Not every project forced into a category — a project with a weak fit just doesn't get that chip. Clicking a chip filters the grid the same way typing in search does (both operate on the existing `filteredProjects` logic in `App.tsx`).

Existing easter eggs preserved exactly: title 6/7-click Aiko unlock, "6"/"67" search omens, lightbox. No changes to that logic.

## Media hover/click interaction (new capability)

Per-project optional `mediaUrl` (mp4/webm/gif) in `project-config.json`, alongside existing `imageUrl` (used as poster/thumbnail).

- No `mediaUrl` → card behaves exactly as today (static image, click opens image lightbox).
- Has `mediaUrl` → poster gets a small play-icon overlay. Desktop hover autoplays a muted loop inline in the card (preview only, no controls, no sound). Click (any device, including touch where hover doesn't exist) opens the lightbox with the full video, controls, and sound.

No projects are wired to this yet — Owen will record clips and add `mediaUrl` per project later. This spec adds the schema and interaction, not the content.

Hosting: static, no backend/Vercel needed for this feature. New video files go under `public/data/project-media/`. If a clip is large, reuse the existing R2-bucket pattern already used for the Aiko `.dmg` download (`App.tsx:5-6`) rather than bloating the git repo.

## Data/schema changes

`src/data/project-config.json` (`ProjectConfig` type in `src/lib/projects.ts`) gains:
- `featured?: boolean`
- `status?: 'live' | 'prototype' | 'in-development'`
- `mediaUrl?: string`

`scripts/generate-project-cache.mjs` currently reconstructs each project object field-by-field in `resolveProject()` (all four return branches) — it does **not** pass through arbitrary extra config fields. Must explicitly add `featured`, `status`, and `mediaUrl` to all four branches, or they silently disappear from the generated cache on next `npm run generate:projects` run. This is a real bug risk if skipped.

`ProjectCardData` type in `src/lib/projects.ts` gains matching fields.

New `train-shade-seat` entry added to `project-config.json` with `repo: ""`, no `liveUrl`/`githubUrl`, `status: "in-development"`, `featured: true`.

## Component structure

`src/App.tsx` splits into:
- `src/components/Hero.tsx`
- `src/components/Featured.tsx`
- `src/components/About.tsx`
- `src/components/Experience.tsx`
- `src/components/Skills.tsx`
- `src/components/ProjectGrid.tsx` (existing search/grid/lightbox logic extracted, tag-filter chips added)
- `src/components/Footer.tsx`

Static copy (hero tagline, about paragraph, experience entries, skills groups) lives in a new `src/data/site-content.ts` rather than inline JSX, so Owen can edit text later without touching component code.

`src/App.css` extended with new section styles using the hybrid token system; existing tokens in `src/index.css` extended (not replaced) with the hanko-red accent and status-dot colors.

## Technical/metadata

- `index.html`: add Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) and Twitter card meta tags. Improve `<title>` and meta description (currently generic "A simple portfolio page collecting recent projects by toso.").
- OG image: recommend 1200×630px, filename `og-image.png`, placed in `public/`. Owen needs to supply this or approve a simple typographic placeholder generated from the same design tokens (no stock photo).
- Favicon: keep existing `favicon.svg`, add `apple-touch-icon.png` (180×180) referenced in `index.html`.
- `public/resume.pdf`: copy of the May13 PDF, linked from hero buttons and footer.
- Accessibility: buttons/links get accessible labels where icon-only; tag-filter chips are real `<button>` elements with `aria-pressed` state; keyboard focus states visible (currently relies on browser default — should get an explicit `:focus-visible` style matching the site's palette).
- Mobile: existing `@media (max-width: 720px)` breakpoint in `App.css` extended to cover new sections (Hero photo, Featured cards, Experience, Skills) — single-column stacking throughout.

## Open items (not blocking implementation start)

- Photo file: Owen to provide (path or drop into `public/`).
- OG image: Owen to provide, or approve generated placeholder.
- `mediaUrl` clips: none yet, added later per project.
- Train Shade Seat repo/screenshots: added later when the project exists.
