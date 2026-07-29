import './Featured.css'
import type { ProjectCardData } from '../lib/projects'
import { FEATURED_GROUPS, PROJECTS_URL, type FeaturedGroup } from '../data/site-content'
import { LinkIcon, type LinkIconName } from './LinkIcon'
import { MediaThumbnail, type MediaSelection } from './MediaThumbnail'

type FeaturedProps = {
  projects: ProjectCardData[]
  onOpenMedia: (media: MediaSelection) => void
}

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  prototype: 'Prototype',
  'in-development': 'In development',
}

const GROUP_KICKER: Record<FeaturedGroup['theme'], string> = {
  hardware: 'Physical world',
  language: 'Japan life',
  play: 'Just for fun',
}

function primaryLinkIcon(label: string): LinkIconName {
  const normalized = label.toLowerCase()

  if (normalized.includes('download')) return 'download'
  if (normalized.includes('store')) return 'store'
  if (normalized.includes('case study')) return 'resume'

  return 'external'
}

export function Featured({ projects, onOpenMedia }: FeaturedProps) {
  const lanes = FEATURED_GROUPS.map((group) => {
    const resolved = group.slugs
      .map((slug) => projects.find((project) => project.slug === slug))
      .filter((project): project is ProjectCardData => Boolean(project))

    return { group, lead: resolved[0], rest: resolved.slice(1) }
  }).filter((lane): lane is { group: FeaturedGroup; lead: ProjectCardData; rest: ProjectCardData[] } =>
    Boolean(lane.lead),
  )

  if (lanes.length === 0) {
    return null
  }

  return (
    <section id="featured" className="featured-section" aria-label="Featured projects">
      <h2>Featured</h2>
      <p className="featured-intro">
        Three lanes of work: things that touch real hardware, tools shaped by living in Japan, and builds
        that were mostly just fun to make.
      </p>

      <div className="featured-bands">
        {lanes.map(({ group, lead, rest }) => (
          <article className="featured-band" key={group.theme}>
            <div className="featured-media">
              {lead.imageUrl || lead.mediaUrl ? (
                <MediaThumbnail
                  imageUrl={lead.imageUrl}
                  mediaUrl={lead.mediaUrl}
                  title={lead.title}
                  onOpen={onOpenMedia}
                />
              ) : (
                <span className="featured-media-placeholder" aria-hidden="true">
                  {lead.title.charAt(0)}
                </span>
              )}
            </div>

            <div className="featured-content">
              <div className="featured-content-top">
                <p className="featured-lane">{GROUP_KICKER[group.theme]}</p>

                <div className="featured-heading">
                  <h3>{lead.title}</h3>
                  {lead.status ? (
                    <span className="status-pill">
                      <span className="status-dot" data-status={lead.status} />
                      {STATUS_LABEL[lead.status]}
                    </span>
                  ) : null}
                </div>

                <p className="featured-description">{lead.description}</p>

                {lead.tags.length > 0 ? (
                  <ul className="featured-tags" aria-label={`${lead.title} tags`}>
                    {lead.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {/* Pinned to the bottom of the column so actions line up across bands
                  no matter how long each description runs. */}
              <div className="featured-actions">
                {lead.liveUrl ? (
                  <a
                    className="action-link action-link-primary"
                    href={lead.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LinkIcon name={primaryLinkIcon(lead.liveLabel ?? 'Website')} />
                    {lead.liveLabel ?? 'Website'}
                  </a>
                ) : null}
                {lead.githubUrl ? (
                  <a className="action-link" href={lead.githubUrl} target="_blank" rel="noreferrer">
                    <LinkIcon name="github" />
                    Source
                  </a>
                ) : null}
                <a className="featured-more" href={`${PROJECTS_URL}#project-${lead.slug}`}>
                  Details
                </a>
              </div>

              {/* The rest of the lane stays as quiet links, so all the work is reachable
                  without turning the section into a wall of cards. */}
              {rest.length > 0 ? (
                <p className="featured-alsoin">
                  <span>Also in this lane</span>
                  {rest.map((project) => (
                    <a key={project.slug} href={`${PROJECTS_URL}#project-${project.slug}`}>
                      {project.title}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
