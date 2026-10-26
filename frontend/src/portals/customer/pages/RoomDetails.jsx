import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Calendar,
  Users,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import { formatLKR, formatDate, todayISO } from '../../../utils/format';
import { GoldDivider, RatingStars, Skeleton } from '../../../components/UI';

export default function RoomDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = todayISO();

  // Query params
  const initialCheckIn = searchParams.get('check_in') || '';
  const initialCheckOut = searchParams.get('check_out') || '';
  const initialGuests = searchParams.get('guests') || '1';

  // Room data state
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  // Gallery active index
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const thumbnailsRef = useRef([]);

  // Booking Card state
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);

  // Quote calculation state
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const quoteTimerRef = useRef(null);

  // Fetch Room Details
  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setError(null);

    const roomId = Number(id);
    if (!roomId || isNaN(roomId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    api.get(`/public/rooms/${roomId}`)
      .then((res) => {
        setRoom(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 404 || err.response?.status === 400) {
          setNotFound(true);
        } else {
          setError(err.response?.data?.message || 'Failed to load suite details.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Debounced quote calculation (400ms)
  const calculateQuote = useCallback(() => {
    if (!checkIn || !checkOut) {
      setQuote(null);
      setQuoteError('');
      return;
    }

    if (checkIn < today) {
      setQuote(null);
      setQuoteError('Check-in date cannot be in the past.');
      return;
    }

    if (checkOut <= checkIn) {
      setQuote(null);
      setQuoteError('Check-out date must be strictly after check-in date.');
      return;
    }

    setQuoting(true);
    setQuoteError('');

    api.get(`/public/rooms/${id}/quote`, {
      params: {
        check_in: checkIn,
        check_out: checkOut,
        guests,
      },
    })
      .then((res) => {
        setQuote(res.data);
        if (!res.data.available) {
          setQuoteError(res.data.reason || 'This suite is not available for the selected dates.');
        } else {
          setQuoteError('');
        }
      })
      .catch((err) => {
        setQuote(null);
        setQuoteError(err.response?.data?.message || 'Could not verify rate.');
      })
      .finally(() => setQuoting(false));
  }, [id, checkIn, checkOut, guests, today]);

  useEffect(() => {
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current);
    }
    quoteTimerRef.current = setTimeout(() => {
      calculateQuote();
    }, 400);

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, [calculateQuote]);

  // Keyboard navigation for gallery thumbnails
  const handleThumbKeyDown = (e, idx, total) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveImgIndex(idx);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % total;
      setActiveImgIndex(next);
      thumbnailsRef.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + total) % total;
      setActiveImgIndex(prev);
      thumbnailsRef.current[prev]?.focus();
    }
  };

  // Primary action: 'Reserve this suite'
  const handleReserve = () => {
    if (!quote || !quote.available) return;

    const params = new URLSearchParams({
      room_id: String(id),
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
    });

    const checkoutUrl = `/checkout?${params.toString()}`;

    if (!user) {
      navigate(`/login?next=${encodeURIComponent(checkoutUrl)}`);
    } else {
      navigate(checkoutUrl);
    }
  };

  // Not Found view
  if (notFound) {
    return (
      <div className="public-section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <div className="card-ui" style={{ maxWidth: 540, margin: '0 auto', padding: '48px 24px' }}>
            <HelpCircle size={48} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.8 }} />
            <h1 className="font-serif" style={{ fontSize: '1.8rem', color: 'var(--text)', marginBottom: 12 }}>
              Suite Not Found
            </h1>
            <p style={{ color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 28 }}>
              The accommodation you are looking for does not exist or is currently retired from our public collection.
            </p>
            <Link to="/rooms" className="btn-ui btn-ui-primary btn-ui-md">
              <ArrowLeft size={16} />
              <span>Back to all rooms</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading view
  if (loading) {
    return (
      <div className="room-details-page">
        <div className="room-details-hero skeleton-ui" />
        <div className="public-container" style={{ maxWidth: 960 }}>
          <div className="room-details-card card-ui">
            <Skeleton height="20px" width="30%" style={{ marginBottom: 16 }} />
            <Skeleton height="40px" width="70%" style={{ marginBottom: 20 }} />
            <Skeleton height="18px" width="90%" style={{ marginBottom: 32 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
              <div>
                <Skeleton height="160px" style={{ marginBottom: 20 }} />
                <Skeleton height="100px" />
              </div>
              <Skeleton height="320px" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error view
  if (error) {
    return (
      <div className="public-section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <div className="card-ui" style={{ maxWidth: 540, margin: '0 auto', padding: '40px 24px' }}>
            <AlertCircle size={44} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
            <h2 className="font-serif" style={{ color: 'var(--text)', marginBottom: 12 }}>Unable to Load Suite</h2>
            <p style={{ color: 'var(--text-body)', marginBottom: 24 }}>{error}</p>
            <Link to={`/rooms${location.search}`} className="btn-ui btn-ui-secondary btn-ui-sm">
              <ArrowLeft size={16} />
              <span>Return to Rooms</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const images = room.images || [];
  const currentImg = images[activeImgIndex] || null;
  const amenities = room.amenities || [];
  const reviews = room.reviews || [];

  return (
    <div className="room-details-page">
      {/* Hero Image Section: 288px mobile, 384px desktop */}
      <section className="room-details-hero-section" aria-label="Suite Visual Gallery">
        {currentImg ? (
          <img
            src={currentImg}
            alt={`${room.room_type} Suite Photo ${activeImgIndex + 1}`}
            className="room-details-hero-img"
          />
        ) : (
          <div className="room-details-hero-placeholder">
            <BedDouble size={56} style={{ color: 'var(--gold)', opacity: 0.5, marginBottom: 12 }} />
            <span className="font-serif room-hero-placeholder-type">{room.room_type}</span>
          </div>
        )}

        <div className="room-details-hero-overlay" />

        {/* Back Link to /rooms keeping the query string */}
        <Link
          to={`/rooms${location.search}`}
          className="room-details-back-btn"
          aria-label="Back to rooms list"
        >
          <ArrowLeft size={16} />
          <span>Back to Rooms</span>
        </Link>
      </section>

      {/* Content Card overlapping image by 64px, max width 896px */}
      <div className="public-container" style={{ maxWidth: 896 }}>
        <div className="room-details-content-card card-ui">
          {/* Header Block: Eyebrow, 48px Playfair Title, Specs line, Right-aligned price */}
          <div className="room-details-header">
            <div className="room-details-title-group">
              <span className="eyebrow room-details-eyebrow">
                {room.room_type}
              </span>
              <h1 className="room-details-title font-serif">
                {room.room_type} Suite
              </h1>
              <p className="room-details-specs">
                Up to {room.capacity} Guests • {room.bed_type} Bed • {room.size_sqm} m² • {room.view_label}
              </p>
            </div>

            <div className="room-details-price-box">
              <span className="room-details-price-val font-serif">
                {formatLKR(room.price_per_night)}
              </span>
              <span className="room-details-price-unit">/ night</span>
            </div>
          </div>

          <GoldDivider />

          {/* Gallery Thumbnails (below hero) */}
          {images.length > 1 && (
            <div className="room-thumbnails-row" role="region" aria-label="Photo Thumbnails">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  ref={(el) => (thumbnailsRef.current[idx] = el)}
                  type="button"
                  className={`room-thumbnail-btn ${idx === activeImgIndex ? 'is-active' : ''}`}
                  onClick={() => setActiveImgIndex(idx)}
                  onKeyDown={(e) => handleThumbKeyDown(e, idx, images.length)}
                  aria-label={`View photo ${idx + 1} of ${images.length}`}
                  aria-current={idx === activeImgIndex}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* Main Layout Grid: Description & Amenities on Left, Booking Card Sticky on Right */}
          <div className="room-details-grid">
            <div className="room-details-main-info">
              {/* Description */}
              <div className="room-description-block">
                <h2 className="room-section-heading font-serif">About This Suite</h2>
                <p className="room-description-text">
                  {room.description ||
                    'Designed with warm textures, hand-finished woodwork, and quiet palettes. Featuring generous natural lighting, bespoke linens, and private lounging areas.'}
                </p>
              </div>

              {/* Amenities: 4-column checklist with gold check icons (1 col on mobile) */}
              {amenities.length > 0 && (
                <div className="room-amenities-block">
                  <h2 className="room-section-heading font-serif">Suite Amenities</h2>
                  <div className="room-amenities-grid-4">
                    {amenities.map((item, idx) => (
                      <div key={idx} className="amenity-item">
                        <Check size={16} className="amenity-check-icon" />
                        <span className="amenity-label">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guest Reviews Section (Average rating with RatingStars and up to 10 reviews) */}
              {reviews.length > 0 && (
                <div className="room-reviews-block">
                  <div className="room-reviews-header">
                    <div>
                      <h2 className="room-section-heading font-serif">Guest Reviews</h2>
                      <p className="room-reviews-sub">
                        {room.average_rating > 0 ? (
                          <>
                            <strong style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>
                              {room.average_rating}
                            </strong>{' '}
                            out of 5 • Based on {room.review_count} verified guest stay{room.review_count !== 1 ? 's' : ''}
                          </>
                        ) : (
                          'Verified reviews from past guests'
                        )}
                      </p>
                    </div>
                    {room.average_rating > 0 && (
                      <RatingStars value={room.average_rating} readOnly size={18} />
                    )}
                  </div>

                  <div className="room-reviews-list">
                    {reviews.map((rev, idx) => (
                      <div key={idx} className="room-review-item">
                        <div className="room-review-item-header">
                          <span className="room-reviewer-name">{rev.customer_first_name}</span>
                          <span className="room-review-date">{formatDate(rev.date)}</span>
                        </div>
                        <div style={{ margin: '6px 0 10px' }}>
                          <RatingStars value={rev.rating} readOnly size={14} />
                        </div>
                        <p className="room-review-text">“{rev.text}”</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Booking Card: Sticky on Desktop at Right, Below description on Mobile */}
            <aside className="room-booking-sidebar">
              <div className="room-booking-card card-ui">
                <div className="booking-card-header">
                  <span className="booking-card-price-val font-serif">
                    {formatLKR(room.price_per_night)}
                  </span>
                  <span className="booking-card-price-unit">/ night</span>
                </div>

                <div className="gold-divider-ui" style={{ margin: '14px 0 18px' }}>
                  <div className="gold-divider-line" />
                  <div className="gold-divider-dot" />
                  <div className="gold-divider-line" />
                </div>

                <form onSubmit={(e) => e.preventDefault()} className="booking-card-form">
                  {/* Check-In */}
                  <div className="form-field-wrapper">
                    <label className="form-field-label" htmlFor="booking-check-in">
                      <Calendar size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                      <span>Check-In</span>
                    </label>
                    <input
                      id="booking-check-in"
                      type="date"
                      className="input-ui"
                      min={today}
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                    />
                  </div>

                  {/* Check-Out */}
                  <div className="form-field-wrapper">
                    <label className="form-field-label" htmlFor="booking-check-out">
                      <Calendar size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                      <span>Check-Out</span>
                    </label>
                    <input
                      id="booking-check-out"
                      type="date"
                      className="input-ui"
                      min={checkIn || today}
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </div>

                  {/* Guests */}
                  <div className="form-field-wrapper">
                    <label className="form-field-label" htmlFor="booking-guests">
                      <Users size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                      <span>Guests</span>
                    </label>
                    <select
                      id="booking-guests"
                      className="select-ui"
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num}>
                          {num} {num === 1 ? 'Guest' : 'Guests'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quote Output or Error Feedback */}
                  <div className="booking-quote-box">
                    {quoting && (
                      <p className="booking-quote-status">Verifying rates & availability…</p>
                    )}

                    {!quoting && quote && quote.available && (
                      <div className="booking-quote-breakdown">
                        <div className="booking-quote-line">
                          <span>
                            {formatLKR(quote.nightly_rate)} × {quote.nights}{' '}
                            {quote.nights === 1 ? 'night' : 'nights'}
                          </span>
                          <span>{formatLKR(quote.total)}</span>
                        </div>
                        <div className="gold-divider-ui" style={{ margin: '8px 0' }}>
                          <div className="gold-divider-line" />
                          <div className="gold-divider-dot" />
                          <div className="gold-divider-line" />
                        </div>
                        <div className="booking-quote-total">
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Stay Total</span>
                          <span className="booking-quote-total-val font-serif">
                            {formatLKR(quote.total)}
                          </span>
                        </div>
                      </div>
                    )}

                    {!quoting && quoteError && (
                      <div className="booking-quote-alert" role="alert">
                        <AlertCircle size={15} />
                        <span>{quoteError}</span>
                      </div>
                    )}

                    {!quoting && !quote && !quoteError && (
                      <p className="booking-quote-hint">
                        Select check-in and check-out dates to calculate total stay price.
                      </p>
                    )}
                  </div>

                  {/* Reserve Primary Button */}
                  <button
                    type="button"
                    className="btn-ui btn-ui-primary btn-ui-lg booking-reserve-btn"
                    disabled={!quote || !quote.available || quoting}
                    onClick={handleReserve}
                    id="reserve-suite-btn"
                  >
                    <span>Reserve this suite</span>
                  </button>

                  <p className="booking-card-fineprint">
                    No immediate credit card charge. Instant booking confirmation.
                  </p>
                </form>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
