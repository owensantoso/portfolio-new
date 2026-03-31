import type { ProjectConfig } from '../lib/github'

export const projects: ProjectConfig[] = [
  {
    slug: 'grocery-price-map',
    repo: 'owensantoso/grocery-price-map',
    liveUrl: 'https://grocery-price-map.vercel.app',
    tags: ['Next.js', 'Supabase', 'Maps'],
    sortOrder: 1,
  },
  {
    slug: 'spotify-playlist-tracker',
    repo: 'owensantoso/spotify-playlist-tracker',
    liveUrl: 'https://spotify-playlist-tracker.vercel.app',
    tags: ['Spotify', 'Full stack'],
    sortOrder: 2,
  },
  {
    slug: 'big-2-stats',
    repo: 'owensantoso/big-2-stats',
    liveUrl: 'https://owensantoso.github.io/big-2-stats/',
    tags: ['Dashboard', 'Static site'],
    sortOrder: 3,
  },
  {
    slug: 'jmty-map-chrome-extension',
    repo: 'owensantoso/jmty-map-chrome-extension',
    liveUrl: 'https://chromewebstore.google.com/detail/jimoty-pickup-map/fpjalenbgdfpaghclllcilcaolphcjdo',
    title: 'Jimoty Pickup Map',
    tags: ['Chrome extension', 'Maps'],
    sortOrder: 4,
  },
  {
    slug: 'whisper-lecture-enhancer',
    repo: 'owensantoso/whisper-lecture-enhancer',
    tags: ['OpenAI', 'Transcription'],
    sortOrder: 5,
  },
  {
    slug: 'ar-spotify-lyrics',
    repo: 'owensantoso/AR-spotify-lyrics',
    title: 'AR Spotify Lyrics',
    tags: ['Wearables', 'Spotify'],
    sortOrder: 6,
  },
  {
    slug: 'big2-helper',
    repo: 'owensantoso/big2-helper',
    tags: ['Card game', 'Utility'],
    sortOrder: 7,
  },
]
