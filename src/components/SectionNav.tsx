import { useState, useEffect, useRef } from 'react';
import './SectionNav.css';

export type NavSection = { id: string; label: string };

export function SectionNav({ sections }: { sections: NavSection[] }) {
  const [activeId, setActiveId] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      const intersecting = entries.find((entry) => entry.isIntersecting);
      if (intersecting) {
        setActiveId(intersecting.target.id);
      }
    }, {
      rootMargin: '-45% 0px -50% 0px',
    });

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element && observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [sections]);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 320);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <nav className="section-nav" data-visible={isVisible} aria-label="Page sections">
      <ol className="section-nav-list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="section-nav-link"
              data-active={section.id === activeId}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
