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

Edit the curated project list in `src/data/projects.ts`. Each entry can provide local overrides for title, description, live URL, tags, and image URL. The site then enriches each card from GitHub in the browser and will try to use the first useful README image when no manual screenshot is supplied.

## Deployment

The repo includes `.github/workflows/deploy.yml` to build and deploy the site to GitHub Pages from the `main` branch using GitHub Actions.
