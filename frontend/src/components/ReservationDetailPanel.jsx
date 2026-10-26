import { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  BedDouble,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatLKR, formatDate, formatDateTime, nightsBetween, todayISO } from '../utils/format';
import {
  Button,
  StatusText,
  GoldDivider,
  Eyebrow,
  ConfirmModal,
  Modal,
  FormField,
  Input,
  Select,
  Skeleton,
} from './UI';

export default function ReservationDetailPanel({
  bookingRef,
  isOpen = false,
  onClose,
  onActionComplete,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    note: '',
  });
  const [paymentErrors, setPaymentErrors] = useState({});

  // Refund form state (Admin only)
  const [refundForm, setRefundForm] = useState({
    amount: '',
    method: 'cash',
    reason: '',
  });
  const [refundErrors, setRefundErrors] = useState({});

  const fetchDetail = useCallback(async () => {
    if (!bookingRef) return;
    try {
      setLoading(true);
      const res = await api.get(`/reservations/${bookingRef}`);
      setBooking(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reservation details.');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [bookingRef, onClose]);

  useEffect(() => {
    if (isOpen && bookingRef) {
      fetchDetail();
    } else {
      setBooking(null);
    }
  }, [isOpen, bookingRef, fetchDetail]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const todayStr = todayISO();
  const bill = booking?.bill || {};
  const customer = booking?.customer || {};
  const room = booking?.room || {};
  const payments = booking?.payments || [];
  const nights = booking ? nightsBetween(booking.check_in_date, booking.check_out_date) : 0;
  const balance = Number(bill.balance ?? booking?.total_amount ?? 0);
  const paidAmount = Number(bill.paid_amount ?? 0);

  // Status Action Handlers
  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/reservations/${booking.booking_ref}/confirm`);
      toast.success(`Booking ${booking.booking_ref} confirmed successfully.`);
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm reservation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/reservations/${booking.booking_ref}/check-in`);
      toast.success(`Guest checked in to Room ${room.room_number || booking.room_number}.`);
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check in.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (balance > 0) {
      toast.error(`Cannot check out with an outstanding balance of ${formatLKR(balance)}. Please record payment first.`);
      return;
    }
    setActionLoading(true);
    try {
      await api.patch(`/reservations/${booking.booking_ref}/check-out`);
      toast.success(`Guest checked out successfully.`);
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check out.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    setActionLoading(true);
    try {
      const res = await api.patch(`/reservations/${booking.booking_ref}/cancel`);
      setShowCancelModal(false);
      const refundDue = Number(res.data.refund_due || 0);
      if (refundDue > 0) {
        toast.success(`Reservation cancelled. Refund due: ${formatLKR(refundDue)}.`);
      } else {
        toast.success(`Reservation ${booking.booking_ref} cancelled.`);
      }
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel reservation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShowConfirm = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/reservations/${booking.booking_ref}/no-show`);
      setShowNoShowModal(false);
      toast.success(`Reservation marked as No-Show.`);
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark as no-show.');
    } finally {
      setActionLoading(false);
    }
  };

  // Payment submission
  const openPaymentModal = () => {
    setPaymentForm({
      amount: balance > 0 ? String(balance) : '',
      method: 'cash',
      reference: '',
      note: '',
    });
    setPaymentErrors({});
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentErrors({});

    const errors = {};
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    }
    if (paymentForm.method !== 'cash' && !paymentForm.reference.trim()) {
      errors.reference = 'Reference number is required for card, transfer, or online payments.';
    }

    if (Object.keys(errors).length > 0) {
      setPaymentErrors(errors);
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/reservations/${booking.booking_ref}/payments`, {
        amount: amt,
        method: paymentForm.method,
        reference: paymentForm.reference.trim() || null,
        note: paymentForm.note.trim() || null,
      });
      toast.success('Payment recorded successfully.');
      setShowPaymentModal(false);
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Refund submission (Admin only)
  const openRefundModal = () => {
    setRefundForm({
      amount: paidAmount > 0 ? String(paidAmount) : '',
      method: 'cash',
      reason: '',
    });
    setRefundErrors({});
    setShowRefundModal(true);
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    setRefundErrors({});

    const errors = {};
    const amt = parseFloat(refundForm.amount);
    if (isNaN(amt) || amt <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    } else if (amt > paidAmount) {
      errors.amount = `Refund cannot exceed total paid amount of ${formatLKR(paidAmount)}.`;
    }
    if (!refundForm.reason.trim()) {
      errors.reason = 'Reason for refund is required.';
    }

    if (Object.keys(errors).length > 0) {
      setRefundErrors(errors);
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/reservations/${booking.booking_ref}/refunds`, {
        amount: amt,
        method: refundForm.method,
        reason: refundForm.reason.trim(),
      });
      toast.success('Refund recorded successfully.');
      setShowRefundModal(false);
      await fetchDetail();
      onActionComplete?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record refund.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        className="reservation-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-In Drawer Panel */}
      <aside
        className="reservation-drawer-panel"
        role="dialog"
        aria-label="Reservation Details"
      >
        {/* Panel Header */}
        <div className="reservation-drawer-header">
          <div>
            <Eyebrow text="RESERVATION FOLIO" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--gold)',
                  letterSpacing: '0.05em',
                }}
              >
                {bookingRef}
              </span>
              {booking && <StatusText status={booking.status} />}
            </div>
          </div>
          <button
            type="button"
            className="mobile-sidebar-close-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Panel Body */}
        <div className="reservation-drawer-body">
          {loading || !booking ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Skeleton height={60} />
              <Skeleton height={140} />
              <Skeleton height={180} />
            </div>
          ) : (
            <>
              {/* Guest & Contact Info */}
              <section className="reservation-drawer-section">
                <div className="reservation-section-title">
                  <User size={16} style={{ color: 'var(--gold)' }} />
                  <span>Guest Details</span>
                </div>
                <div className="reservation-info-grid">
                  <div>
                    <span className="reservation-label">Guest Name</span>
                    <div className="reservation-val">{customer.name || booking.customer_name || '—'}</div>
                  </div>
                  <div>
                    <span className="reservation-label">Source</span>
                    <div className="reservation-val" style={{ textTransform: 'capitalize' }}>
                      {booking.booking_source || 'direct'}
                    </div>
                  </div>
                  <div>
                    <span className="reservation-label">Email</span>
                    <div className="reservation-val" style={{ wordBreak: 'break-all' }}>
                      {customer.email || booking.customer_email || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="reservation-label">Phone</span>
                    <div className="reservation-val">{customer.phone || booking.customer_phone || '—'}</div>
                  </div>
                </div>
              </section>

              <GoldDivider style={{ margin: '18px 0' }} />

              {/* Room & Stay Details */}
              <section className="reservation-drawer-section">
                <div className="reservation-section-title">
                  <BedDouble size={16} style={{ color: 'var(--gold)' }} />
                  <span>Room & Stay Information</span>
                </div>
                <div className="reservation-info-grid">
                  <div>
                    <span className="reservation-label">Room</span>
                    <div className="reservation-val">
                      Room {room.room_number || booking.room_number} ({room.room_type || booking.room_type})
                    </div>
                  </div>
                  <div>
                    <span className="reservation-label">Guests</span>
                    <div className="reservation-val">{booking.guests} Guest(s)</div>
                  </div>
                  <div>
                    <span className="reservation-label">Check-In</span>
                    <div className="reservation-val">{formatDate(booking.check_in_date)}</div>
                  </div>
                  <div>
                    <span className="reservation-label">Check-Out</span>
                    <div className="reservation-val">{formatDate(booking.check_out_date)}</div>
                  </div>
                  <div>
                    <span className="reservation-label">Stay Duration</span>
                    <div className="reservation-val">{nights} Night(s)</div>
                  </div>
                  <div>
                    <span className="reservation-label">Nightly Rate</span>
                    <div className="reservation-val">{formatLKR(booking.nightly_rate || booking.room_price || 0)}</div>
                  </div>
                </div>

                {booking.remark && (
                  <div style={{ marginTop: 12 }}>
                    <span className="reservation-label">Special Requests / Remark</span>
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: 13,
                        color: 'var(--text-body)',
                        marginTop: 4,
                      }}
                    >
                      {booking.remark}
                    </div>
                  </div>
                )}
              </section>

              <GoldDivider style={{ margin: '18px 0' }} />

              {/* Billing & Balance */}
              <section className="reservation-drawer-section">
                <div className="reservation-section-title">
                  <CreditCard size={16} style={{ color: 'var(--gold)' }} />
                  <span>Billing Summary</span>
                </div>
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>Total Amount</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {formatLKR(bill.total_amount ?? booking.total_amount)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>Total Paid</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{formatLKR(paidAmount)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 15,
                      fontWeight: 700,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ color: 'var(--text)' }}>Balance Due</span>
                    <span style={{ color: balance > 0 ? 'var(--warning)' : 'var(--text)' }}>
                      {formatLKR(balance)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
                    <span className="reservation-label" style={{ margin: 0 }}>Payment Status</span>
                    <StatusText status={bill.payment_status || booking.payment_status} />
                  </div>
                </div>
              </section>

              {/* Payments Ledger */}
              <section className="reservation-drawer-section" style={{ marginTop: 18 }}>
                <span className="reservation-label" style={{ marginBottom: 8, display: 'block' }}>
                  Recorded Transactions
                </span>
                {payments.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                    No payments recorded yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {payments.map((p) => (
                      <div
                        key={p.payment_id}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' }}>
                            {p.kind === 'refund' ? 'Refund' : p.method || 'Payment'}
                            {p.reference ? ` (${p.reference})` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {formatDateTime(p.created_at)}
                            {p.note ? ` · ${p.note}` : ''}
                          </div>
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: p.kind === 'refund' ? 'var(--danger)' : 'var(--gold)',
                          }}
                        >
                          {p.kind === 'refund' ? '-' : ''}{formatLKR(p.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <GoldDivider style={{ margin: '20px 0' }} />

              {/* Status Actions */}
              <section className="reservation-drawer-actions">
                <span className="reservation-label" style={{ marginBottom: 10, display: 'block' }}>
                  Available Actions
                </span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {/* PENDING ACTIONS */}
                  {booking.status === 'pending' && (
                    <>
                      <Button
                        variant="primary"
                        onClick={handleConfirm}
                        loading={actionLoading}
                      >
                        Confirm Booking
                      </Button>
                      <Button
                        variant="danger"
                        outline
                        onClick={() => setShowCancelModal(true)}
                        disabled={actionLoading}
                      >
                        Cancel Booking
                      </Button>
                    </>
                  )}

                  {/* CONFIRMED ACTIONS */}
                  {booking.status === 'confirmed' && (
                    <>
                      <Button
                        variant="primary"
                        onClick={handleCheckIn}
                        loading={actionLoading}
                        disabled={todayStr < booking.check_in_date}
                        title={todayStr < booking.check_in_date ? `Check-in available from ${formatDate(booking.check_in_date)}` : ''}
                      >
                        Check In
                      </Button>
                      {todayStr > booking.check_in_date && (
                        <Button
                          variant="secondary"
                          onClick={() => setShowNoShowModal(true)}
                          disabled={actionLoading}
                        >
                          Mark No-Show
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        outline
                        onClick={() => setShowCancelModal(true)}
                        disabled={actionLoading}
                      >
                        Cancel Booking
                      </Button>
                    </>
                  )}

                  {/* CHECKED-IN ACTIONS */}
                  {booking.status === 'checked_in' && (
                    <Button
                      variant="primary"
                      onClick={handleCheckOut}
                      loading={actionLoading}
                    >
                      Check Out
                    </Button>
                  )}

                  {/* RECORD PAYMENT (available unless cancelled or no-show) */}
                  {!['cancelled', 'no_show'].includes(booking.status) && (
                    <Button
                      variant="secondary"
                      onClick={openPaymentModal}
                      disabled={actionLoading}
                    >
                      Record Payment
                    </Button>
                  )}

                  {/* RECORD REFUND (ADMIN ONLY) */}
                  {isAdmin && paidAmount > 0 && (
                    <Button
                      variant="danger"
                      outline
                      onClick={openRefundModal}
                      disabled={actionLoading}
                    >
                      Record Refund
                    </Button>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>

      {/* CONFIRM CANCEL MODAL */}
      <ConfirmModal
        open={showCancelModal}
        title="Cancel Reservation"
        message={`Are you sure you want to cancel reservation ${booking?.booking_ref}? Any recorded payments will become refund due.`}
        confirmText="Yes, Cancel"
        cancelText="Keep Reservation"
        danger
        loading={actionLoading}
        onCancel={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirm}
      />

      {/* CONFIRM NO-SHOW MODAL */}
      <ConfirmModal
        open={showNoShowModal}
        title="Mark as No-Show"
        message={`Mark booking ${booking?.booking_ref} as No-Show? The guest did not arrive on their check-in date.`}
        confirmText="Mark No-Show"
        cancelText="Dismiss"
        danger
        loading={actionLoading}
        onCancel={() => setShowNoShowModal(false)}
        onConfirm={handleNoShowConfirm}
      />

      {/* RECORD PAYMENT MODAL */}
      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        maxWidth="460px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePaymentSubmit} loading={actionLoading}>
              Save Payment
            </Button>
          </div>
        }
      >
        <form onSubmit={handlePaymentSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Amount (LKR)" required error={paymentErrors.amount}>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                error={paymentErrors.amount}
              />
            </FormField>

            <FormField label="Payment Method" required>
              <Select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="card">Credit / Debit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online Payment</option>
              </Select>
            </FormField>

            <FormField
              label="Transaction Reference"
              required={paymentForm.method !== 'cash'}
              error={paymentErrors.reference}
              hint={paymentForm.method === 'cash' ? 'Optional for cash payments' : 'Required for non-cash payments'}
            >
              <Input
                placeholder="e.g. TXN-89218 or Card Auth Code"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                error={paymentErrors.reference}
              />
            </FormField>

            <FormField label="Note (Optional)">
              <Input
                placeholder="e.g. Settle balance at check-in"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* RECORD REFUND MODAL (Admin Only) */}
      {isAdmin && (
        <Modal
          open={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          title="Record Refund (Admin)"
          maxWidth="460px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button variant="secondary" onClick={() => setShowRefundModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRefundSubmit} loading={actionLoading}>
                Issue Refund
              </Button>
            </div>
          }
        >
          <form onSubmit={handleRefundSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FormField
                label="Refund Amount (LKR)"
                required
                error={refundErrors.amount}
                hint={`Maximum refundable: ${formatLKR(paidAmount)}`}
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paidAmount}
                  placeholder="0.00"
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                  error={refundErrors.amount}
                />
              </FormField>

              <FormField label="Refund Method" required>
                <Select
                  value={refundForm.method}
                  onChange={(e) => setRefundForm({ ...refundForm, method: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card Reversal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="online">Online Gateway</option>
                </Select>
              </FormField>

              <FormField label="Reason for Refund" required error={refundErrors.reason}>
                <Input
                  placeholder="e.g. Cancellation within free policy or guest compensation"
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  error={refundErrors.reason}
                />
              </FormField>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
