import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Calendar, Users, BedDouble, AlertCircle, HelpCircle, ArrowLeft, Bookmark } from 'lucide-react';
import api from '../../../api/axios';
import { formatLKR, formatDate, nightsBetween } from '../../../utils/format';
import { GoldDivider, Eyebrow, StatusText, Skeleton } from '../../../components/UI';

export default function BookingConfirmation() {
  const { ref } = useParams();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ref) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    api.get(`/reservations/my/${ref}`)
      .then((res) => {
        setReservation(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(err.response?.data?.message || 'Failed to retrieve reservation details.');
        }
      })
      .finally(() => setLoading(false));
  }, [ref]);

  // 404 Not Found view
  if (notFound) {
    return (
      <div className="public-section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <div className="card-ui" style={{ maxWidth: 540, margin: '0 auto', padding: '48px 24px' }}>
            <HelpCircle size={48} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.8 }} />
            <h1 className="font-serif" style={{ fontSize: '1.8rem', color: 'var(--text)', marginBottom: 12 }}>
              Reservation Not Found
            </h1>
            <p style={{ color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 28 }}>
              No reservation matching reference <strong>{ref}</strong> could be found under your customer account.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <Link to="/rooms" className="btn-ui btn-ui-primary btn-ui-md">
                <ArrowLeft size={16} />
                <span>Explore Rooms</span>
              </Link>
              <Link to="/" className="btn-ui btn-ui-secondary btn-ui-md">
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="public-section">
        <div className="public-container" style={{ maxWidth: 680, textAlign: 'center' }}>
          <Skeleton height="64px" width="64px" style={{ borderRadius: '50%', margin: '0 auto 20px' }} />
          <Skeleton height="24px" width="40%" style={{ margin: '0 auto 12px' }} />
          <Skeleton height="40px" width="70%" style={{ margin: '0 auto 24px' }} />
          <Skeleton height="320px" />
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
            <h2 className="font-serif" style={{ color: 'var(--text)', marginBottom: 12 }}>Unable to Load Reservation</h2>
            <p style={{ color: 'var(--text-body)', marginBottom: 24 }}>{error}</p>
            <button
              type="button"
              className="btn-ui btn-ui-primary btn-ui-sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roomData = reservation.room || {};
  const roomType = roomData.room_type || reservation.room_type || 'Suite';
  const nights =
    nightsBetween(reservation.check_in_date, reservation.check_out_date) ||
    billData.nights ||
    1;

  return (
    <div className="public-section confirmation-page">
      <div className="public-container" style={{ maxWidth: 720 }}>
        {/* Header Block: Gold check in a circle, eyebrow 'BOOKING RECEIVED', Playfair title, divider */}
        <div className="confirmation-header">
          <div className="confirmation-check-circle">
            <Check size={32} className="confirmation-check-icon" />
          </div>

          <Eyebrow text="BOOKING RECEIVED" />

          <h1 className="confirmation-title font-serif">
            Thank You for Your Reservation
          </h1>

          <p className="confirmation-subtitle">
            We are preparing to welcome you to an unforgettable luxury experience.
          </p>

          <GoldDivider />
        </div>

        {/* Detail Card */}
        <div className="card-ui confirmation-detail-card">
          {/* Reference & Status Header */}
          <div className="confirmation-card-top">
            <div>
              <span className="confirmation-meta-label">Booking Reference</span>
              <div className="confirmation-ref-code font-mono">
                {reservation.booking_ref}
              </div>
            </div>
            <div className="confirmation-status-box">
              <span className="confirmation-meta-label" style={{ textAlign: 'right' }}>Status</span>
              <StatusText status={reservation.status} />
            </div>
          </div>

          <div className="confirmation-card-divider" />

          {/* Stay Info Grid */}
          <div className="confirmation-grid">
            <div className="confirmation-grid-item">
              <span className="confirmation-grid-label">
                <BedDouble size={14} style={{ color: 'var(--gold)', marginRight: 5 }} />
                Accommodation
              </span>
              <strong className="confirmation-grid-val font-serif">
                {roomType} Suite
              </strong>
              {roomData.room_number && (
                <span className="confirmation-room-no">Room {roomData.room_number}</span>
              )}
            </div>

            <div className="confirmation-grid-item">
              <span className="confirmation-grid-label">
                <Users size={14} style={{ color: 'var(--gold)', marginRight: 5 }} />
                Guests
              </span>
              <strong className="confirmation-grid-val">
                {reservation.guests} {Number(reservation.guests) === 1 ? 'Guest' : 'Guests'}
              </strong>
            </div>

            <div className="confirmation-grid-item">
              <span className="confirmation-grid-label">
                <Calendar size={14} style={{ color: 'var(--gold)', marginRight: 5 }} />
                Check-In Date
              </span>
              <strong className="confirmation-grid-val">
                {formatDate(reservation.check_in_date)}
              </strong>
            </div>

            <div className="confirmation-grid-item">
              <span className="confirmation-grid-label">
                <Calendar size={14} style={{ color: 'var(--gold)', marginRight: 5 }} />
                Check-Out Date
              </span>
              <strong className="confirmation-grid-val">
                {formatDate(reservation.check_out_date)}
              </strong>
            </div>
          </div>

          <div className="confirmation-card-divider" />

          {/* Total Row */}
          <div className="confirmation-total-row">
            <div>
              <span className="confirmation-meta-label">Total Amount ({nights} {nights === 1 ? 'night' : 'nights'})</span>
              <span className="confirmation-payment-note">Payment is due upon arrival at reception.</span>
            </div>
            <div className="confirmation-total-amount font-serif">
              {formatLKR(reservation.total_amount)}
            </div>
          </div>

          {/* Explanation note that pending bookings are confirmed by the hotel */}
          <div className="confirmation-note-box">
            <Bookmark size={16} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
            <p className="confirmation-note-text">
              Your reservation has been recorded in our system. Pending bookings are reviewed and confirmed by our reception desk prior to or upon arrival. A confirmation record is available at all times in your customer portal.
            </p>
          </div>
        </div>

        {/* Buttons: 'View my bookings' and 'Back to home' */}
        <div className="confirmation-actions">
          <Link
            to="/account/bookings"
            className="btn-ui btn-ui-secondary btn-ui-md confirmation-action-btn"
            id="view-my-bookings-btn"
          >
            <span>View my bookings</span>
          </Link>

          <Link
            to="/"
            className="btn-ui btn-ui-primary btn-ui-md confirmation-action-btn"
            id="back-to-home-btn"
          >
            <span>Back to home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
