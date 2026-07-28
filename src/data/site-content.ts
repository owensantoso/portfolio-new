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
