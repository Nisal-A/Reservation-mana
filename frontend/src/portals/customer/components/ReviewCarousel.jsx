import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote, RefreshCw } from 'lucide-react';
import api from '../../../api/axios';
import { SectionTitle } from '../../../components/UI';

export default function ReviewCarousel() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchReviews = () => {
    setLoading(true);
    setError(null);
    api.get('/public/testimonials')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setReviews(res.data);
        } else {
          setReviews([]);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load guest reviews');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Hide section when there are none (per prompt specification)
  if (!loading && !error && reviews.length === 0) {
    return null;
  }

  const prevReview = () => {
    setCurrentIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const nextReview = () => {
    setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
  };

  const current = reviews[currentIndex];

  return (
    <section className="public-section reviews-section" aria-label="Guest Testimonials">
      <div className="public-container">
        <SectionTitle
          eyebrow="Guest Impressions"
          title="Words From Our Guests"
          subtitle="Real memories and authentic experiences shared by travelers around the world."
        />

        {loading && (
          <div className="review-carousel-card skeleton-ui" style={{ height: 260 }} />
        )}

        {error && (
          <div className="error-state-ui" style={{ padding: '32px' }}>
            <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>
            <button
              type="button"
              className="btn-ui btn-ui-secondary btn-ui-sm"
              onClick={fetchReviews}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!loading && !error && current && (
          <div className="review-carousel-container">
            <div className="review-carousel-card">
              <Quote size={32} className="review-card-quote-icon" aria-hidden="true" />

              {/* 5 Gold Stars */}
              <div className="review-card-stars" aria-label={`${current.rating || 5} out of 5 stars`}>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    fill={i < (current.rating || 5) ? 'var(--gold)' : 'none'}
                    stroke="var(--gold)"
                  />
                ))}
              </div>

              {/* Italic Playfair Quote */}
              <blockquote className="review-card-text font-serif">
                “{current.text}”
              </blockquote>

              {/* Reviewer Details */}
              <div className="review-card-author">
                <span className="review-author-name">{current.customer_first_name}</span>
                {current.room_type && (
                  <span className="review-author-meta">• Stayed in {current.room_type}</span>
                )}
              </div>

              {/* Prev / Next controls */}
              {reviews.length > 1 && (
                <div className="review-carousel-controls">
                  <button
                    type="button"
                    className="review-arrow-btn"
                    onClick={prevReview}
                    aria-label="Previous review"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="review-arrow-btn"
                    onClick={nextReview}
                    aria-label="Next review"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Dots */}
            {reviews.length > 1 && (
              <div className="review-carousel-dots" role="tablist" aria-label="Review slider dots">
                {reviews.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`review-dot ${idx === currentIndex ? 'is-active' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Go to review ${idx + 1}`}
                    role="tab"
                    aria-selected={idx === currentIndex}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
