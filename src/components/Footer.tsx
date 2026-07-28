import { CONTACT } from '../data/site-content'
import { LinkIcon } from './LinkIcon'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="footer-links">
        <a href={`mailto:${CONTACT.email}`}>
          <LinkIcon name="email" />
          {CONTACT.email}
        </a>
        <a href={CONTACT.github} target="_blank" rel="noreferrer">
          <LinkIcon name="github" />
          GitHub
        </a>
        <a href={CONTACT.linkedin} target="_blank" rel="noreferrer">
          <LinkIcon name="linkedin" />
          LinkedIn
        </a>
        <a href={CONTACT.resumeUrl} target="_blank" rel="noreferrer">
          <LinkIcon name="resume" />
          Résumé
        </a>
        <span className="footer-location">{CONTACT.location}</span>
      </div>
      <p className="footer-copyright">© {year} Owen Santoso</p>
    </footer>
  )
}
