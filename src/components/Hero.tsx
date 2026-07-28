import { CONTACT, HERO_ROLE, HERO_TAGLINE } from '../data/site-content'
import { LinkIcon } from './LinkIcon'

export function Hero() {
  return (
    <section className="hero">
      <p className="eyebrow">
        toso <span className="eyebrow-location">· {CONTACT.location}</span>
      </p>
      <div className="hero-main">
        <div className="hero-copy-block">
          <h1>{HERO_ROLE}</h1>
          <p className="hero-copy">{HERO_TAGLINE}</p>
          <div className="hero-buttons">
            <a className="profile-link" href="#featured">
              View projects
            </a>
            <a className="profile-link" href={CONTACT.github} target="_blank" rel="noreferrer">
              <LinkIcon name="github" />
              GitHub
            </a>
            <a className="profile-link" href={CONTACT.linkedin} target="_blank" rel="noreferrer">
              <LinkIcon name="linkedin" />
              LinkedIn
            </a>
            <a className="profile-link" href={CONTACT.resumeUrl} target="_blank" rel="noreferrer">
              <LinkIcon name="resume" />
              Résumé
            </a>
            <a className="profile-link" href={`mailto:${CONTACT.email}`}>
              <LinkIcon name="email" />
              Email
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
