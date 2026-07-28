import { CONTACT, HERO_PHOTO_URL, HERO_ROLE, HERO_TAGLINE } from '../data/site-content'

export function Hero() {
  return (
    <section className="hero">
      <p className="eyebrow">
        toso <span className="eyebrow-location">· {CONTACT.location}</span>
      </p>
      <div className="hero-main">
        {HERO_PHOTO_URL ? (
          <div className="hero-photo-frame">
            <img className="hero-photo" src={HERO_PHOTO_URL} alt={HERO_ROLE} />
          </div>
        ) : null}
        <div className="hero-copy-block">
          <h1>{HERO_ROLE}</h1>
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
