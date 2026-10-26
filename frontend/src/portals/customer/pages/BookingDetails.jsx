import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  CreditCard,
  ArrowLeft,
  AlertCircle,
  Phone,
  BedDouble,
  FileText,
  Star,
  CheckCircle2,
} from 'lucide-react';
import api from '../../../api/axios';
import { formatLKR, formatDate, formatDateTime, nightsBetween } from '../../../utils/format';
import siteContent from '../../../config/siteContent';
import {
  StatusText,
  Button,
  GoldDivider,
  ConfirmModal,
  EmptyState,
  Skeleton,
  Eyebrow,
} from '../../../components/UI';
import toast from 'react-hot-toast';

export default function BookingDetails() {
  const { ref } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [hasReview, setHasReview] = useState(false);

  const fetchBooking = useCallback(async () => {
    if (!ref) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/reservations/my/${ref}`);
      setBooking(res.data);

      // Check if this reservation has already been reviewed
      try {
        const revRes = await api.get('/reviews');
        const reviewed = Array.isArray(revRes.data) && revRes.data.some(
          (r) => r.reservation_id === res.data.reservation_id
        );
        setHasReview(reviewed);
      } catch {
        setHasReview(false);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Reservation not found. Please verify your booking reference or check your bookings list.');
      } else {
        setError(err.response?.data?.message || 'Failed to load booking details.');
      }
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await api.patch(`/reservations/${booking.booking_ref}/cancel`);
      toast.success('Reservation cancelled successfully.');
      setShowCancelModal(false);
      await fetchBooking();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel reservation.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="public-section">
        <div className="public-container" style={{ maxWidth: 1040 }}>
          <div style={{ marginBottom: 24 }}>
            <Skeleton height={20} width={160} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            <Skeleton height={200} />
            <Skeleton height={320} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="public-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
        <div className="public-container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <EmptyState
            icon={<AlertCircle size={48} style={{ color: 'var(--danger)' }} />}
            title="Reservation Not Found"
            message={error || 'We could not locate this reservation under your account.'}
            action={
              <Link to="/account/bookings" className="btn-ui btn-ui-primary">
                <ArrowLeft size={16} />
                <span>Return to My Bookings</span>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  const totalAmount = booking.bill?.total_amount ?? booking.total_amount;
  const paidAmount = booking.bill?.paid_amount ?? 0;
  const balance = booking.bill?.balance ?? 0;
  const paymentStatus = booking.bill?.payment_status ?? booking.payment_status;
  const payments = booking.bill?.payments ?? [];

  return (
    <div className="public-section booking-details-page">
      <div className="public-container" style={{ maxWidth: 1040 }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: 28 }}>
          <Link
            to="/account/bookings"
            className="btn-ui btn-ui-ghost btn-ui-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}
          >
            <ArrowLeft size={16} />
            <span>Back to My Bookings</span>
          </Link>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <Eyebrow text="RESERVATION DETAILS" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                <h1
                  className="font-serif"
                  style={{
                    fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
                    color: 'var(--text)',
                    margin: 0,
                  }}
                >
                  Stay in {booking.room_type}
                </h1>
                <StatusText status={booking.status} />
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                Reference:{' '}
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--gold)',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}
                >
                  {booking.booking_ref}
                </span>{' '}
                · Booked on {formatDate(booking.created_at)}
              </p>
            </div>

            {/* Top action: Write a review if checked out & unreviewed */}
            {booking.status === 'checked_out' && !hasReview && (
              <Link
                to={`/account/reviews?reservation_id=${booking.reservation_id}`}
                className="btn-ui btn-ui-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Star size={16} />
                <span>Write a Review</span>
              </Link>
            )}
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="booking-details-grid">
          {/* Main Info Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Stay Timeline & Room Info */}
            <div className="lux-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <BedDouble size={20} style={{ color: 'var(--gold)' }} />
                <h3 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                  Room & Stay Overview
                </h3>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  padding: '16px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  marginBottom: 20,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                    Room Type
                  </span>
                  <div style={{ color: 'var(--text)', fontWeight: 600, marginTop: 4, fontSize: 15 }}>
                    {booking.room_type}
                  </div>
                  {booking.room_number && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Room {booking.room_number}
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                    Guests
                  </span>
                  <div style={{ color: 'var(--text)', fontWeight: 600, marginTop: 4, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={16} style={{ color: 'var(--gold)' }} />
                    {booking.guests} {booking.guests === 1 ? 'Guest' : 'Guests'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                    Duration
                  </span>
                  <div style={{ color: 'var(--text)', fontWeight: 600, marginTop: 4, fontSize: 15 }}>
                    {nights} {nights === 1 ? 'Night' : 'Nights'}
                  </div>
                </div>
              </div>

              {/* Check-In / Check-Out Schedule Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Calendar size={16} style={{ color: 'var(--gold)' }} />
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                      Check-In
                    </span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    {formatDate(booking.check_in_date)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gold)' }}>
                    <Clock size={14} />
                    <span>From {siteContent.checkInTime}</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Calendar size={16} style={{ color: 'var(--gold)' }} />
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                      Check-Out
                    </span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    {formatDate(booking.check_out_date)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gold)' }}>
                    <Clock size={14} />
                    <span>By {siteContent.checkOutTime}</span>
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <FileText size={15} style={{ color: 'var(--muted)' }} />
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                    Special Requests
                  </span>
                </div>
                <div
                  style={{
                    padding: 14,
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    color: booking.remark ? 'var(--text)' : 'var(--muted)',
                    fontSize: 14,
                    fontStyle: booking.remark ? 'normal' : 'italic',
                  }}
                >
                  {booking.remark || 'No special requests submitted for this stay.'}
                </div>
              </div>
            </div>

            {/* Post-Stay Review Promo */}
            {booking.status === 'checked_out' && (
              <div
                className="lux-card"
                style={{
                  padding: 24,
                  border: '1px solid var(--border-strong)',
                  background: 'linear-gradient(135deg, rgba(200, 169, 106, 0.08) 0%, rgba(20, 20, 20, 0.95) 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Star size={20} style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />
                  <h3 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                    Guest Experience & Feedback
                  </h3>
                </div>
                {hasReview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)' }}>
                    <CheckCircle2 size={18} />
                    <span>You have shared a review for this stay. Thank you for your feedback!</span>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: '0 0 16px', color: 'var(--text-body)', fontSize: 14 }}>
                      We hope you enjoyed your time at LuxeStay. Your review helps us continuously elevate our service and helps future travellers.
                    </p>
                    <Link
                      to={`/account/reviews?reservation_id=${booking.reservation_id}`}
                      className="btn-ui btn-ui-primary btn-ui-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Star size={16} />
                      <span>Write a Review</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Billing & Cancellation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Billing Summary Card */}
            <div className="lux-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <CreditCard size={20} style={{ color: 'var(--gold)' }} />
                <h3 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                  Billing & Folio
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>Nightly Rate</span>
                  <span style={{ color: 'var(--text)' }}>
                    {formatLKR(booking.nightly_rate || booking.room_price || 0)} / night
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>Duration</span>
                  <span style={{ color: 'var(--text)' }}>{nights} nights</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 15,
                    fontWeight: 600,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>Total Stay</span>
                  <span className="font-serif" style={{ color: 'var(--gold)', fontSize: 17 }}>
                    {formatLKR(totalAmount)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>Paid</span>
                  <span style={{ color: 'var(--success)' }}>{formatLKR(paidAmount)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>Balance Due</span>
                  <span style={{ color: balance > 0 ? 'var(--warning)' : 'var(--text)' }}>
                    {formatLKR(balance)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 10,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                    Payment Status
                  </span>
                  <StatusText status={paymentStatus} />
                </div>
              </div>

              <GoldDivider style={{ margin: '20px 0' }} />

              {/* Payment transactions history */}
              <div>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--muted)',
                    display: 'block',
                    marginBottom: 10,
                  }}
                >
                  Payment Records
                </span>

                {payments.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                    No payments recorded yet. Payment is settled at the hotel upon arrival.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {payments.map((p, idx) => (
                      <div
                        key={p.payment_id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'var(--bg)',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>
                            {p.kind === 'refund' ? 'Refund' : p.method || 'Payment'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {formatDateTime(p.created_at)}
                          </div>
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: p.kind === 'refund' ? 'var(--danger)' : 'var(--gold)',
                          }}
                        >
                          {p.kind === 'refund' ? '-' : ''}
                          {formatLKR(p.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cancellation Policy & Action Card */}
            <div className="lux-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <AlertCircle size={18} style={{ color: 'var(--gold)' }} />
                <h3 className="font-serif" style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
                  Cancellation Policy
                </h3>
              </div>

              {/* Case 1: Can cancel (pending or confirmed before deadline) */}
              {booking.can_cancel ? (
                <div>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-body)' }}>
                    Free cancellation until{' '}
                    <strong style={{ color: 'var(--gold)' }}>
                      {formatDate(booking.cancel_deadline)}
                    </strong>
                    . You may cancel this booking with no cancellation penalty.
                  </p>
                  <Button
                    variant="danger"
                    outline
                    className="w-full"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Booking
                  </Button>
                </div>
              ) : ['pending', 'confirmed'].includes(booking.status) ? (
                /* Case 2: Within cancellation window (cannot cancel online) */
                <div
                  style={{
                    padding: 16,
                    background: 'rgba(248, 113, 113, 0.06)',
                    border: '1px solid rgba(248, 113, 113, 0.25)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Phone size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                      Cancellation window has passed, please contact the hotel on{' '}
                      <a
                        href={`tel:${siteContent.phone}`}
                        style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {siteContent.phone}
                      </a>
                    </div>
                  </div>
                </div>
              ) : booking.status === 'cancelled' ? (
                /* Case 3: Already cancelled */
                <div
                  style={{
                    padding: 14,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                    color: 'var(--muted)',
                  }}
                >
                  This reservation was cancelled on{' '}
                  <strong style={{ color: 'var(--text)' }}>
                    {formatDate(booking.cancelled_at || booking.updated_at)}
                  </strong>
                  .
                </div>
              ) : (
                /* Case 4: Other statuses like checked_in or checked_out */
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Reservation status is currently{' '}
                  <span style={{ textTransform: 'capitalize' }}>{booking.status.replace('_', ' ')}</span>.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Cancellation Modal */}
      <ConfirmModal
        open={showCancelModal}
        title="Cancel Reservation"
        message={`Are you sure you want to cancel your reservation (${booking.booking_ref}) for ${booking.room_type}? This action cannot be reversed.`}
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        danger
        loading={cancelling}
        onCancel={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
      />
    </div>
  );
}
