export const CONTACT = {
  email: 'nos.santoso@gmail.com',
  github: 'https://github.com/owensantoso',
  linkedin: 'https://www.linkedin.com/in/owen-santoso/',
  resumeUrl: `${import.meta.env.BASE_URL}resume.pdf`,
  location: 'Tokyo, Japan',
}

export const HOME_URL = import.meta.env.BASE_URL
export const PROJECTS_URL = `${import.meta.env.BASE_URL}projects/`

export const HERO_ROLE = 'Owen Santoso'

export const HERO_TAGLINE =
  "Software engineer in Tokyo. I build small tools for problems I run into personally, and take a few apart just to see how they work."

export const HERO_PHOTO_URL: string | null = '/data/owen-portrait.jpg'

export const ABOUT_INTRO =
  "I'm a software engineer based in Tokyo with a background in electrical and electronic engineering. Professionally I've worked across Java, Kotlin, React and SQL inside a ten-plus-year production codebase at LogicVein, shipping full-stack features and chasing down UI defects and race conditions."

export const ABOUT_CLOSING =
  "I like projects that force me to connect things that weren't built to talk to each other. Native English, JLPT N2 Japanese."

// Slugs referenced inline in About.tsx's second paragraph. Image paths mirror
// what's already in project-config.json for these three projects.
export const ABOUT_MENTIONS = {
  jimoty: {
    slug: 'jmty-map-chrome-extension',
    imageUrl: '/data/project-images/jmty-map-chrome-extension.png',
  },
  spotifyTracker: {
    slug: 'spotify-playlist-tracker',
    imageUrl: '/data/project-images/spotify-playlist-tracker.png',
  },
  arLyrics: {
    slug: 'ar-spotify-lyrics',
    imageUrl: '/data/AR-spotify-lyrics.png',
  },
}

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

export type SkillSource =
  | { kind: 'project'; label: string; slug: string }
  | { kind: 'role'; label: string }

/**
 * Where each skill actually came from. Only claims backed by the résumé or by a
 * real project in project-config.json. Skills with no entry here just don't expand.
 */
export const SKILL_SOURCES: Record<string, SkillSource[]> = {
  Java: [{ kind: 'role', label: 'LogicVein, backend features' }],
  Kotlin: [{ kind: 'role', label: 'LogicVein, backend features' }],
  JavaScript: [
    { kind: 'role', label: 'LogicVein, React frontend' },
    { kind: 'project', label: 'Guitar Chord Companion', slug: 'guitar-chord-companion' },
    { kind: 'project', label: 'Jimoty Pickup Map', slug: 'jmty-map-chrome-extension' },
    { kind: 'project', label: 'Subtitle Companion MVP', slug: 'subtitle-companion-mvp' },
  ],
  Python: [
    { kind: 'role', label: 'exida, safety-certificate automation' },
    { kind: 'project', label: 'SwitchBot Tools', slug: 'switchbot-tools' },
    { kind: 'project', label: 'Whisper Lecture Enhancer', slug: 'whisper-lecture-enhancer' },
  ],
  SQL: [
    { kind: 'role', label: 'LogicVein' },
    { kind: 'project', label: 'Grocery Price Map', slug: 'grocery-price-map' },
  ],
  C: [{ kind: 'project', label: 'XGIMI Projector Wake over BLE', slug: 'xgimi-elfin-ble-wake' }],
  React: [
    { kind: 'role', label: 'LogicVein, frontend features' },
    { kind: 'project', label: 'Grocery Price Map', slug: 'grocery-price-map' },
  ],
  Redux: [{ kind: 'role', label: 'LogicVein, application state' }],
  'REST APIs': [
    { kind: 'role', label: 'LogicVein, endpoint to UI integration' },
    { kind: 'project', label: 'Spotify Playlist Tracker', slug: 'spotify-playlist-tracker' },
    { kind: 'project', label: 'AR Spotify Lyrics', slug: 'ar-spotify-lyrics' },
  ],
  'HTML/CSS': [
    { kind: 'role', label: 'LogicVein, frontend features' },
    { kind: 'project', label: 'Big2 Helper', slug: 'big2-helper' },
    { kind: 'project', label: 'VGM Recordings Browser', slug: 'vgm-recordings-browser' },
  ],
  Git: [{ kind: 'role', label: 'LogicVein, and every project here' }],
  Linux: [
    { kind: 'role', label: 'LogicVein' },
    { kind: 'project', label: 'SwitchBot Tools', slug: 'switchbot-tools' },
  ],
  Docker: [{ kind: 'role', label: 'LogicVein' }],
  PostgreSQL: [{ kind: 'project', label: 'Grocery Price Map, via Supabase', slug: 'grocery-price-map' }],
  'Maps & geospatial': [
    { kind: 'project', label: 'Grocery Price Map', slug: 'grocery-price-map' },
    { kind: 'project', label: 'Jimoty Pickup Map', slug: 'jmty-map-chrome-extension' },
    { kind: 'project', label: 'Train Shade Seat', slug: 'train-shade-seat' },
  ],
  'Audio & signal processing': [
    { kind: 'project', label: 'Guitar Note Visualizer', slug: 'guitar-note-visualizer' },
    { kind: 'project', label: 'Whisper Lecture Enhancer', slug: 'whisper-lecture-enhancer' },
    { kind: 'project', label: 'VGM Recordings Browser', slug: 'vgm-recordings-browser' },
  ],
  'AI/LLM tooling': [
    { kind: 'project', label: 'Whisper Lecture Enhancer', slug: 'whisper-lecture-enhancer' },
    { kind: 'project', label: 'Aiko Dictionary', slug: 'aiko-dictionary' },
  ],
  'Hardware-adjacent (BLE, embedded)': [
    { kind: 'project', label: 'XGIMI Projector Wake over BLE', slug: 'xgimi-elfin-ble-wake' },
    { kind: 'project', label: 'SwitchBot Tools', slug: 'switchbot-tools' },
    { kind: 'project', label: 'AR Spotify Lyrics', slug: 'ar-spotify-lyrics' },
  ],
}

export type ProjectCategory = {
  label: string
  slugs: string[]
}

// Curated by hand on purpose (only a dozen or so projects) rather than keyword-matched against
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
    slugs: ['xgimi-elfin-ble-wake', 'ar-spotify-lyrics', 'train-shade-seat', 'aiko-dictionary'],
  },
]

export const FEATURED_ORDER = ['ar-spotify-lyrics', 'aiko-dictionary', 'train-shade-seat']
