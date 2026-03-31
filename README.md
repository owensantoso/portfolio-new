# Owen Santoso Projects

A small React + Vite portfolio site for collecting recent projects in one place.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Content

Edit the curated project list in `src/data/project-config.json`. Each entry can provide local overrides for title, description, live URL, tags, and image URL.

Project metadata is generated into `public/data/projects-cache.json` by `npm run generate:projects`. The site reads that static cache at runtime, and the deploy workflow also refreshes it on each push plus once a day on a schedule.

## Deployment

The repo includes `.github/workflows/deploy.yml` to build and deploy the site to GitHub Pages from the `main` branch using GitHub Actions.
