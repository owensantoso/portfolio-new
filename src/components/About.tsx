import { ABOUT_TEXT } from '../data/site-content'

export function About() {
  return (
    <section className="about-section" aria-label="About">
      <h2>About</h2>
      <p>{ABOUT_TEXT}</p>
    </section>
  )
}
