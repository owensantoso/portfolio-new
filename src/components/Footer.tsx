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
