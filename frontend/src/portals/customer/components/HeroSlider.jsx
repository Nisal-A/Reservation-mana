import { useState, useEffect, useRef } from 'react';
import { siteContent } from '../../../config/siteContent';

export default function HeroSlider({ children }) {
  const slides = siteContent.heroSlides || [];
  const hasSlides = slides.length > 0;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 6 second auto-rotation
  useEffect(() => {
    if (!hasSlides || slides.length <= 1 || isPaused || reducedMotion) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasSlides, slides.length, isPaused, reducedMotion]);

  // Split headline for: second line in italic gold
  const headlineParts = siteContent.heroHeadline
    ? siteContent.heroHeadline.split('\n')
    : [];

  return (
    <section
      className="hero-slider-section"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      aria-label="Welcome Showcase"
    >
      {/* Background Slides */}
      {hasSlides ? (
        <div className="hero-slides-track">
          {slides.map((slide, idx) => {
            const webp = typeof slide === 'string' ? slide : slide.webp;
            const jpg = typeof slide === 'string' ? slide : slide.jpg;
            const alt = typeof slide === 'object' && slide.alt ? slide.alt : `Hero slide ${idx + 1}`;
            const isFirst = idx === 0;

            return (
              <div
                key={idx}
                className={`hero-slide-item ${idx === currentIndex ? 'is-active' : ''}`}
                style={{
                  transition: reducedMotion ? 'none' : 'opacity 1s ease-in-out',
                }}
              >
                <picture className="hero-slide-picture">
                  {webp && <source srcSet={webp} type="image/webp" />}
                  <img
                    src={jpg}
                    alt={alt}
                    loading={isFirst ? 'eager' : 'lazy'}
                    fetchPriority={isFirst ? 'high' : 'auto'}
                    className="hero-slide-img"
                  />
                </picture>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="hero-fallback-bg" />
      )}

      {/* 65% Black Overlay */}
      <div className="hero-black-overlay" />

      {/* Hero Content */}
      <div className="hero-content-container">
        {siteContent.tagline && (
          <span className="eyebrow hero-eyebrow">
            {siteContent.tagline}
          </span>
        )}

        {headlineParts.length > 0 && (
          <h1 className="hero-headline font-serif">
            <span>{headlineParts[0]}</span>
            {headlineParts[1] && (
              <>
                <br />
                <span className="hero-headline-gold-italic">
                  {headlineParts[1]}
                </span>
              </>
            )}
          </h1>
        )}

        {siteContent.heroSubtitle && (
          <p className="hero-subtitle">
            {siteContent.heroSubtitle}
          </p>
        )}

        {/* Embedded Children (e.g. SearchBar) */}
        {children && <div className="hero-children-wrapper">{children}</div>}

        {/* Bouncing Gold Line */}
        <div className="hero-scroll-indicator" aria-hidden="true">
          <div className="hero-bouncing-line" />
        </div>
      </div>

      {/* Slide Navigation Dots (when multiple slides exist) */}
      {hasSlides && slides.length > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Hero slider dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`hero-dot ${idx === currentIndex ? 'is-active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-selected={idx === currentIndex}
              role="tab"
            />
          ))}
        </div>
      )}
    </section>
  );
}
