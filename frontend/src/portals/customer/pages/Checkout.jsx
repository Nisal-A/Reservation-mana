import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  BedDouble,
  Calendar,
  Users,
  AlertCircle,
  Clock,
  FileText,
  Info,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { formatLKR, formatDate, todayISO } from '../../../utils/format';
import { siteContent } from '../../../config/siteContent';
import { Stepper, GoldDivider, Skeleton, Eyebrow } from '../../../components/UI';

const STEPS = ['Stay', 'Guest details', 'Review and confirm'];

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const today = todayISO();

  const queryRoomId = searchParams.get('room_id') || '';
  const initialCheckIn = searchParams.get('check_in') || '';
  const initialCheckOut = searchParams.get('check_out') || '';
  const initialGuests = searchParams.get('guests') || '1';

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);

  // Unsent booking guard
  const isBookingSubmitted = useRef(false);

  // Room data & Quote state
  const [room, setRoom] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState(null);

  // Step 1: Stay state
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);

  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const quoteTimerRef = useRef(null);

  // Step 2: Guest details state
  const [guestDetails, setGuestDetails] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [loadingGuest, setLoadingGuest] = useState(true);
  const [specialRequests, setSpecialRequests] = useState('');

  // Step 3: Review state
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Unsent booking warning: warn before leaving page with an unsent booking
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isBookingSubmitted.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Fetch Room data
  useEffect(() => {
    if (!queryRoomId) {
      setRoomError('No accommodation specified for checkout.');
      setLoadingRoom(false);
      return;
    }

    setLoadingRoom(true);
    api.get(`/public/rooms/${queryRoomId}`)
      .then((res) => {
        setRoom(res.data);
      })
      .catch((err) => {
        setRoomError(err.response?.data?.message || 'Failed to load suite details.');
      })
      .finally(() => setLoadingRoom(false));
  }, [queryRoomId]);

  // Fetch Customer profile for Step 2
  useEffect(() => {
    setLoadingGuest(true);
    api.get('/customers/me')
      .then((res) => {
        const c = res.data;
        setGuestDetails({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
        });
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => setLoadingGuest(false));
  }, []);

  // Quote calculation (debounced 400ms)
  const calculateQuote = useCallback(() => {
    if (!queryRoomId || !checkIn || !checkOut) {
      setQuote(null);
      setQuoteError('Please select valid check-in and check-out dates.');
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

    api.get(`/public/rooms/${queryRoomId}/quote`, {
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
  }, [queryRoomId, checkIn, checkOut, guests, today]);

  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => {
      calculateQuote();
    }, 400);

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, [calculateQuote]);

  // Handle Step 3 Submission
  const handleConfirmBooking = async () => {
    if (!policyAccepted || submitting) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        room_id: Number(queryRoomId),
        check_in_date: checkIn,
        check_out_date: checkOut,
        guests: Number(guests),
        remark: specialRequests.trim() || null,
      };

      const res = await api.post('/reservations', payload);
      isBookingSubmitted.current = true;
      toast.success('Reservation successfully confirmed!');
      navigate(`/booking/${res.data.booking_ref}/confirmation`, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Could not complete reservation.';
      
      // If 409 or 400: show message, go back to step 1, refresh quote
      if (status === 409 || status === 400) {
        toast.error(message);
        setSubmitError(message);
        setCurrentStep(0);
        calculateQuote();
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Error state for missing room
  if (roomError) {
    return (
      <div className="public-section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <div className="card-ui" style={{ maxWidth: 540, margin: '0 auto', padding: '48px 24px' }}>
            <AlertCircle size={44} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
            <h2 className="font-serif" style={{ color: 'var(--text)', marginBottom: 12 }}>Cannot Proceed to Checkout</h2>
            <p style={{ color: 'var(--text-body)', marginBottom: 24 }}>{roomError}</p>
            <Link to="/rooms" className="btn-ui btn-ui-primary btn-ui-md">
              <ArrowLeft size={16} />
              <span>Browse Available Suites</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading room skeleton
  if (loadingRoom) {
    return (
      <div className="public-section">
        <div className="public-container" style={{ maxWidth: 880 }}>
          <Skeleton height="40px" width="50%" style={{ margin: '0 auto 24px' }} />
          <Skeleton height="60px" style={{ marginBottom: 32 }} />
          <Skeleton height="360px" />
        </div>
      </div>
    );
  }

  const roomImage = room.images && room.images.length > 0 ? room.images[0] : (room.image_url || null);
  const checkInTime = siteContent.checkInTime || '13:00';
  const checkOutTime = siteContent.checkOutTime || '11:00';
  const bookingPolicyText =
    siteContent.bookingPolicy ||
    'Cancellations must be made at least 24 hours prior to check-in. Payment is settled upon arrival at the hotel. Government-issued photo identification is required at check-in.';

  return (
    <div className="public-section checkout-page">
      <div className="public-container" style={{ maxWidth: 880 }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Eyebrow text="RESERVATION CHECKOUT" />
          <h1 className="font-serif" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', color: 'var(--text)', marginTop: 8 }}>
            Complete Your Stay
          </h1>
          <GoldDivider />
        </div>

        {/* Stepper */}
        <div style={{ marginBottom: 40 }}>
          <Stepper
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={(stepIdx) => {
              // Only allow jumping back to earlier steps
              if (stepIdx < currentStep) setCurrentStep(stepIdx);
            }}
          />
        </div>

        {/* Global Submit Error (e.g. from 409 room conflict) */}
        {submitError && (
          <div className="checkout-alert-error" role="alert" style={{ marginBottom: 24 }}>
            <AlertCircle size={18} />
            <div>
              <strong>Reservation Alert:</strong> {submitError}
            </div>
          </div>
        )}

        {/* ─── STEP 1: STAY ────────────────────────────────────────────── */}
        {currentStep === 0 && (
          <div className="checkout-step-container">
            <div className="card-ui checkout-step-card">
              <h2 className="font-serif checkout-card-heading">1. Stay Information</h2>
              <p className="checkout-card-sub">
                Review and adjust your arrival and departure dates or guest count.
              </p>

              {/* Suite Summary Box */}
              <div className="checkout-suite-summary">
                <div className="checkout-suite-thumb">
                  {roomImage ? (
                    <img src={roomImage} alt={room.room_type} />
                  ) : (
                    <div className="checkout-thumb-placeholder">
                      <BedDouble size={28} style={{ color: 'var(--gold)', opacity: 0.7 }} />
                    </div>
                  )}
                </div>
                <div className="checkout-suite-info">
                  <span className="eyebrow" style={{ fontSize: '0.72rem' }}>{room.room_type}</span>
                  <h3 className="font-serif checkout-suite-name">{room.room_type} Suite</h3>
                  <p className="checkout-suite-specs">
                    Up to {room.capacity} Guests • {room.bed_type} Bed • {room.size_sqm} m² • {room.view_label}
                  </p>
                  <p className="checkout-suite-rate">
                    <strong style={{ color: 'var(--gold)' }}>{formatLKR(room.price_per_night)}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}> / night</span>
                  </p>
                </div>
              </div>

              {/* Editable Stay Controls */}
              <div className="checkout-controls-grid">
                <div className="form-field-wrapper">
                  <label className="form-field-label" htmlFor="checkout-check-in">
                    <Calendar size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                    <span>Check-In Date</span>
                  </label>
                  <input
                    id="checkout-check-in"
                    type="date"
                    className="input-ui"
                    min={today}
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                  />
                </div>

                <div className="form-field-wrapper">
                  <label className="form-field-label" htmlFor="checkout-check-out">
                    <Calendar size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                    <span>Check-Out Date</span>
                  </label>
                  <input
                    id="checkout-check-out"
                    type="date"
                    className="input-ui"
                    min={checkIn || today}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                  />
                </div>

                <div className="form-field-wrapper">
                  <label className="form-field-label" htmlFor="checkout-guests">
                    <Users size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                    <span>Guests</span>
                  </label>
                  <select
                    id="checkout-guests"
                    className="select-ui"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quote / Rate Breakdown Box */}
              <div className="checkout-quote-panel">
                {quoting && (
                  <p className="checkout-quote-status">Verifying rates & availability…</p>
                )}

                {!quoting && quote && quote.available && (
                  <div className="checkout-quote-details">
                    <div className="checkout-quote-row">
                      <span>
                        Nightly Rate × Nights ({quote.nights} {quote.nights === 1 ? 'night' : 'nights'})
                      </span>
                      <span>{formatLKR(quote.nightly_rate)} × {quote.nights}</span>
                    </div>
                    <div className="checkout-quote-divider" />
                    <div className="checkout-quote-row checkout-quote-total-row">
                      <span>Total Stay Price</span>
                      <span className="checkout-quote-total-val font-serif">{formatLKR(quote.total)}</span>
                    </div>
                  </div>
                )}

                {!quoting && quoteError && (
                  <div className="checkout-quote-alert" role="alert">
                    <AlertCircle size={16} />
                    <span>{quoteError}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="checkout-step-actions">
                <Link to={`/rooms/${queryRoomId}`} className="btn-ui btn-ui-secondary btn-ui-md">
                  <ArrowLeft size={16} />
                  <span>Return to Room</span>
                </Link>

                <button
                  type="button"
                  id="checkout-step1-continue"
                  className="btn-ui btn-ui-primary btn-ui-md"
                  disabled={!quote || !quote.available || quoting}
                  onClick={() => setCurrentStep(1)}
                >
                  <span>Continue to Guest Details</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 2: GUEST DETAILS ───────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="checkout-step-container">
            <div className="card-ui checkout-step-card">
              <h2 className="font-serif checkout-card-heading">2. Guest Details</h2>
              <p className="checkout-card-sub">
                Information loaded from your verified guest profile.
              </p>

              {loadingGuest ? (
                <div style={{ padding: '24px 0' }}>
                  <Skeleton height="36px" style={{ marginBottom: 16 }} />
                  <Skeleton height="36px" style={{ marginBottom: 16 }} />
                  <Skeleton height="36px" />
                </div>
              ) : (
                <div className="checkout-guest-form">
                  <div className="form-field-wrapper">
                    <label className="form-field-label" htmlFor="guest-name">
                      Full Name
                    </label>
                    <input
                      id="guest-name"
                      type="text"
                      className="input-ui"
                      value={guestDetails.name}
                      onChange={(e) => setGuestDetails({ ...guestDetails, name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>

                  <div className="form-field-wrapper">
                    <label className="form-field-label" htmlFor="guest-email">
                      Email Address (Account read-only)
                    </label>
                    <input
                      id="guest-email"
                      type="email"
                      className="input-ui"
                      value={guestDetails.email}
                      readOnly
                      disabled
                      style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-field-wrapper">
                    <label className="form-field-label" htmlFor="guest-phone">
                      Phone Number
                    </label>
                    <input
                      id="guest-phone"
                      type="tel"
                      className="input-ui"
                      value={guestDetails.phone}
                      onChange={(e) => setGuestDetails({ ...guestDetails, phone: e.target.value })}
                      placeholder="+94 77 123 4567"
                    />
                  </div>

                  {/* Special Requests (Limited to 500 characters) */}
                  <div className="form-field-wrapper" style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-field-label" htmlFor="checkout-special-requests">
                        Special Requests (Optional)
                      </label>
                      <span className="checkout-char-counter">
                        {500 - specialRequests.length} characters left
                      </span>
                    </div>
                    <textarea
                      id="checkout-special-requests"
                      className="textarea-ui"
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. Quiet room requested, early arrival alert, or dietary preferences..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="checkout-step-actions">
                <button
                  type="button"
                  className="btn-ui btn-ui-secondary btn-ui-md"
                  onClick={() => setCurrentStep(0)}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Stay</span>
                </button>

                <button
                  type="button"
                  id="checkout-step2-continue"
                  className="btn-ui btn-ui-primary btn-ui-md"
                  onClick={() => setCurrentStep(2)}
                >
                  <span>Review and Confirm</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: REVIEW AND CONFIRM ─────────────────────────────── */}
        {currentStep === 2 && (
          <div className="checkout-step-container">
            <div className="card-ui checkout-step-card">
              <h2 className="font-serif checkout-card-heading">3. Review and Confirm</h2>
              <p className="checkout-card-sub">
                Please verify your reservation details and acknowledge hotel policies before final submission.
              </p>

              {/* Summary Block */}
              <div className="checkout-review-summary-block">
                <div className="checkout-review-row">
                  <span className="review-label">Accommodation</span>
                  <span className="review-value font-serif" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                    {room.room_type} Suite
                  </span>
                </div>

                <div className="checkout-review-row">
                  <span className="review-label">Dates</span>
                  <span className="review-value">
                    {formatDate(checkIn)} to {formatDate(checkOut)} ({quote?.nights || 1} nights)
                  </span>
                </div>

                <div className="checkout-review-row">
                  <span className="review-label">Occupancy</span>
                  <span className="review-value">{guests} {Number(guests) === 1 ? 'Guest' : 'Guests'}</span>
                </div>

                <div className="checkout-review-row">
                  <span className="review-label">Guest</span>
                  <span className="review-value">{guestDetails.name} ({guestDetails.email})</span>
                </div>

                {specialRequests.trim() && (
                  <div className="checkout-review-row">
                    <span className="review-label">Special Requests</span>
                    <span className="review-value" style={{ fontStyle: 'italic', color: 'var(--text-body)' }}>
                      “{specialRequests.trim()}”
                    </span>
                  </div>
                )}
              </div>

              {/* Price Box with gold/8 background (rgba(200, 169, 106, 0.08)) */}
              <div className="checkout-price-box">
                <div className="checkout-price-box-header">
                  <span className="checkout-price-formula">
                    LKR {quote ? quote.nightly_rate : room.price_per_night} × {quote?.nights || 1} {quote?.nights === 1 ? 'night' : 'nights'}
                  </span>
                  <div className="checkout-price-total font-serif">
                    {formatLKR(quote ? quote.total : room.price_per_night)}
                  </div>
                </div>
                <div className="checkout-price-note">
                  All taxes & service fees included. Calculated strictly according to room nightly rate.
                </div>
              </div>

              {/* Hotel Timings & Policies */}
              <div className="checkout-policies-block">
                <div className="checkout-timings-grid">
                  <div className="checkout-timing-item">
                    <Clock size={16} className="checkout-timing-icon" />
                    <div>
                      <span className="checkout-timing-label">Check-In Time</span>
                      <strong className="checkout-timing-val">{checkInTime}</strong>
                    </div>
                  </div>

                  <div className="checkout-timing-item">
                    <Clock size={16} className="checkout-timing-icon" />
                    <div>
                      <span className="checkout-timing-label">Check-Out Time</span>
                      <strong className="checkout-timing-val">{checkOutTime}</strong>
                    </div>
                  </div>
                </div>

                <div className="checkout-policy-text-box">
                  <div className="checkout-policy-header">
                    <FileText size={15} style={{ color: 'var(--gold)' }} />
                    <span>Booking & Cancellation Policy</span>
                  </div>
                  <p className="checkout-policy-content">{bookingPolicyText}</p>
                </div>

                {/* Payment Notice */}
                <div className="checkout-payment-notice">
                  <Info size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <span>Payment is made at the hotel. Payment status: <strong>Unpaid</strong>.</span>
                </div>

                {/* Required Policy Checkbox */}
                <label className="checkout-policy-checkbox-label" htmlFor="accept-policy-checkbox">
                  <input
                    id="accept-policy-checkbox"
                    type="checkbox"
                    className="checkout-checkbox"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                  />
                  <span>I accept the booking policy and terms of stay.</span>
                </label>
              </div>

              {/* Actions */}
              <div className="checkout-step-actions">
                <button
                  type="button"
                  className="btn-ui btn-ui-secondary btn-ui-md"
                  onClick={() => setCurrentStep(1)}
                  disabled={submitting}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Guest Details</span>
                </button>

                <button
                  type="button"
                  id="confirm-booking-btn"
                  className="btn-ui btn-ui-primary btn-ui-lg"
                  disabled={!policyAccepted || submitting || !quote || !quote.available}
                  onClick={handleConfirmBooking}
                >
                  <ShieldCheck size={18} />
                  <span>{submitting ? 'Confirming Reservation…' : 'Confirm booking'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
