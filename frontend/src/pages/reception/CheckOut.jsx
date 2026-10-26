// frontend/src/pages/reception/CheckOut.jsx
// Guest Check-Out and Folio Settlement page for Reception

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LogOut,
  Search,
  Printer,
  CreditCard,
  CheckCircle2,
  X,
  RefreshCw,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import siteContent from '../../config/siteContent';
import { formatDate, formatDateTime, formatLKR, todayISO } from '../../utils/format';
import {
  Button,
  StatusText,
  PageHeader,
  Skeleton,
  EmptyState,
  FormField,
  Input,
  Select,
} from '../../components/UI';

export default function CheckOut() {
  const [searchTerm, setSearchTerm] = useState('');
  const [inHouseList, setInHouseList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Selected reservation state
  const [reservation, setReservation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Checkout completed / Printable receipt state
  const [receiptData, setReceiptData] = useState(null);

  const todayStr = todayISO();

  // Load In House guests, sorting those departing today first
  const fetchInHouseStays = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await api.get('/reservations', {
        params: { status: 'checked_in', limit: 100 },
      });
      const list = res.data?.data || [];
      // Sort: check_out_date === todayStr first, then oldest check_out_date
      const sorted = [...list].sort((a, b) => {
        const aToday = a.check_out_date === todayStr ? 1 : 0;
        const bToday = b.check_out_date === todayStr ? 1 : 0;
        if (aToday !== bToday) return bToday - aToday;
        return a.check_out_date.localeCompare(b.check_out_date);
      });
      setInHouseList(sorted);
    } catch {
      toast.error('Failed to load in-house guests.');
    } finally {
      setLoadingList(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchInHouseStays();
  }, [fetchInHouseStays]);

  // Load detailed reservation with bill and payments
  const loadReservationDetail = useCallback(async (ref) => {
    if (!ref) {
      setReservation(null);
      return;
    }
    try {
      setLoadingDetail(true);
      setServerError(null);
      setPaymentError(null);
      const res = await api.get(`/reservations/${encodeURIComponent(ref.trim())}`);
      const data = res.data;
      setReservation(data);
      // Initialize payment amount to current balance
      const currentBalance = data.bill?.balance ?? 0;
      setPaymentAmount(currentBalance > 0 ? String(currentBalance) : '');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load reservation bill.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelectReservation = (ref) => {
    setReceiptData(null);
    loadReservationDetail(ref);
  };

  // Search by reference or guest name
  const handleSearch = async (e) => {
    e?.preventDefault();
    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setServerError(null);

      if (/^LS-\d{4}-\d{6}$/i.test(query)) {
        handleSelectReservation(query.toUpperCase());
        setSearchResults([]);
        return;
      }

      const res = await api.get('/reservations', {
        params: { q: query, status: 'checked_in', limit: 10 },
      });

      const list = res.data?.data || [];
      if (list.length === 1) {
        handleSelectReservation(list[0].booking_ref);
        setSearchResults([]);
      } else {
        setSearchResults(list);
        if (list.length === 0) {
          toast.error('No in-house guests match your search.');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  // Record Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!reservation) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid positive payment amount.');
      return;
    }

    if (paymentMethod !== 'cash' && !paymentRef.trim()) {
      setPaymentError('Transaction reference is required for non-cash payment methods.');
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentError(null);
      await api.post(`/reservations/${reservation.booking_ref}/payments`, {
        amount: amt,
        method: paymentMethod,
        reference: paymentRef.trim() || undefined,
        note: paymentNote.trim() || undefined,
      });

      toast.success(`Payment of ${formatLKR(amt)} recorded successfully.`);
      setPaymentRef('');
      setPaymentNote('');
      await loadReservationDetail(reservation.booking_ref);
      await fetchInHouseStays();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record payment.';
      setPaymentError(msg);
      toast.error(msg);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Complete Check-Out
  const handleCompleteCheckOut = async () => {
    if (!reservation) return;

    const currentBalance = Number(reservation.bill?.balance ?? 0);
    if (currentBalance > 0) {
      setServerError(`Cannot check out: Outstanding balance of ${formatLKR(currentBalance)} must be settled first.`);
      return;
    }

    try {
      setCheckingOut(true);
      setServerError(null);

      await api.patch(`/reservations/${reservation.booking_ref}/check-out`);
      toast.success(`Check-out completed for Room ${reservation.room?.room_number}!`);

      // Prepare snapshot for the receipt
      const receiptSnapshot = {
        booking_ref: reservation.booking_ref,
        customer_name: reservation.customer_name || reservation.customer?.name,
        customer_email: reservation.customer_email || reservation.customer?.email,
        customer_phone: reservation.customer_phone || reservation.customer?.phone,
        room_number: reservation.room?.room_number,
        room_type: reservation.room?.room_type,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        nights: reservation.bill?.nights,
        nightly_rate: reservation.bill?.nightly_rate,
        total_amount: reservation.bill?.total_amount,
        payments: reservation.payments || [],
        balance: 0,
        generated_at: new Date().toISOString(),
      };

      setReceiptData(receiptSnapshot);
      await fetchInHouseStays();
    } catch (err) {
      if (err.response?.status === 409) {
        const bal = err.response?.data?.balance ?? reservation.bill?.balance;
        const msg = `Cannot check out: Outstanding balance of ${formatLKR(bal)} remains.`;
        setServerError(msg);
        toast.error(msg);
      } else {
        const msg = err.response?.data?.message || 'Check-out failed.';
        setServerError(msg);
        toast.error(msg);
      }
    } finally {
      setCheckingOut(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleReset = () => {
    setReservation(null);
    setReceiptData(null);
    setServerError(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Computed bill fields
  const bill = reservation?.bill || {};
  const payments = useMemo(() => reservation?.payments || [], [reservation]);
  const regularPayments = payments.filter((p) => p.kind === 'payment');
  const refunds = payments.filter((p) => p.kind === 'refund');
  const balance = Number(bill.balance ?? 0);
  const totalAmount = Number(bill.total_amount ?? reservation?.total_amount ?? 0);
  const nights = Number(bill.nights || 1);
  const nightlyRate = Number(bill.nightly_rate || (totalAmount / nights));

  return (
    <div className="page-content slide-up" style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header (hidden in print) */}
      <div className="no-print">
        <PageHeader
          title="Guest Check-Out"
          subtitle="Settle outstanding folios, process check-out, and generate official guest receipts"
        />
      </div>

      {/* TOP SEARCH BAR (hidden in print) */}
      {!receiptData && (
        <div className="card-ui no-print" style={{ padding: 24, marginBottom: 24 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              />
              <input
                type="text"
                className="input-ui"
                placeholder="Search by booking reference (e.g. LS-2026-000001) or guest name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 40, width: '100%' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSearchResults([]);
                  }}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Button type="submit" variant="primary" loading={searching} style={{ minWidth: 120 }}>
              Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={fetchInHouseStays}
              loading={loadingList}
              style={{ gap: 6 }}
            >
              <RefreshCw size={14} /> Refresh
            </Button>
          </form>

          {/* Search Results Matches */}
          {searchResults.length > 0 && (
            <div
              style={{
                marginTop: 16,
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: 'var(--muted)',
                  borderBottom: '1px solid var(--border)',
                  fontWeight: 600,
                }}
              >
                IN-HOUSE SEARCH RESULTS ({searchResults.length})
              </div>
              {searchResults.map((r) => (
                <div
                  key={r.booking_ref}
                  onClick={() => {
                    handleSelectReservation(r.booking_ref);
                    setSearchResults([]);
                  }}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(200, 169, 106, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)', marginRight: 12 }}>
                      {r.booking_ref}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text)', marginRight: 10 }}>
                      {r.customer_name || r.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Room {r.room_number} • Departs: {formatDate(r.check_out_date)}
                    </span>
                  </div>
                  <Button size="xs" variant="secondary">Select</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRINTABLE RECEIPT SCREEN (DISPLAYED AFTER CHECK-OUT) */}
      {receiptData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Action buttons (hidden when printed) */}
          <div
            className="card-ui no-print"
            style={{
              padding: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              borderLeft: '4px solid var(--success)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(52, 211, 153, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
                  Check-Out Completed Successfully
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Room {receiptData.room_number} is now marked available on the calendar.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                id="btn-print-receipt"
                variant="primary"
                onClick={handlePrintReceipt}
                style={{ gap: 8 }}
              >
                <Printer size={16} /> Print Receipt
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                Process Another Check-Out
              </Button>
            </div>
          </div>

          {/* Printable Receipt Paper */}
          <div className="printable-receipt">
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #222', paddingBottom: 18, marginBottom: 20 }}>
              <h1 className="font-serif" style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '0.04em' }}>
                {siteContent.hotelName}
              </h1>
              {siteContent.address && (
                <p style={{ margin: '0 0 4px', fontSize: 12 }}>{siteContent.address}</p>
              )}
              {siteContent.phone && (
                <p style={{ margin: 0, fontSize: 12 }}>Tel: {siteContent.phone}</p>
              )}
              <div
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  padding: '4px 14px',
                  background: '#f2f2f2',
                  border: '1px solid #ddd',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Official Guest Folio / Receipt
              </div>
            </div>

            {/* Receipt Meta & Guest Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, fontSize: 13 }}>
              <div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Guest Name:</strong> {receiptData.customer_name}
                </div>
                {receiptData.customer_phone && (
                  <div style={{ marginBottom: 4 }}>
                    <strong>Phone:</strong> {receiptData.customer_phone}
                  </div>
                )}
                {receiptData.customer_email && (
                  <div>
                    <strong>Email:</strong> {receiptData.customer_email}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>Booking Reference:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{receiptData.booking_ref}</span>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Room Assigned:</strong> Room {receiptData.room_number} ({receiptData.room_type})
                </div>
                <div>
                  <strong>Generated At:</strong> {formatDateTime(receiptData.generated_at)}
                </div>
              </div>
            </div>

            {/* Stay Details */}
            <div
              style={{
                borderTop: '1px solid #ddd',
                borderBottom: '1px solid #ddd',
                padding: '10px 0',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
              }}
            >
              <div>
                <strong>Check-In Date:</strong> {formatDate(receiptData.check_in_date)}
              </div>
              <div>
                <strong>Check-Out Date:</strong> {formatDate(receiptData.check_out_date)}
              </div>
              <div>
                <strong>Total Nights:</strong> {receiptData.nights}
              </div>
            </div>

            {/* Charges Breakdown */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                Charges
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #ccc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Description</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px' }}>Rate / Night</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px' }}>Nights</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 6px' }}>
                      Accommodation — Room {receiptData.room_number} ({receiptData.room_type})
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                      {formatLKR(receiptData.nightly_rate)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                      {receiptData.nights}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 6px', fontWeight: 600 }}>
                      {formatLKR(receiptData.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payments List */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                Payments Received
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #ccc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Method</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Reference</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 10, textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                        No payments recorded
                      </td>
                    </tr>
                  ) : (
                    receiptData.payments.map((p, idx) => (
                      <tr key={p.payment_id || idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 6px' }}>{formatDateTime(p.created_at)}</td>
                        <td style={{ padding: '8px 6px', textTransform: 'capitalize' }}>{p.payment_method}</td>
                        <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{p.transaction_ref || '—'}</td>
                        <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>
                          {p.kind === 'refund' ? `- ${formatLKR(p.amount)}` : formatLKR(p.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Final Totals */}
            <div style={{ borderTop: '2px solid #222', paddingTop: 12, marginBottom: 28, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Total Charges:</span>
                <strong>{formatLKR(receiptData.total_amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Total Payments:</span>
                <strong>{formatLKR(receiptData.total_amount)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                  paddingTop: 8,
                  borderTop: '1px solid #ddd',
                }}
              >
                <span>Balance Due:</span>
                <strong style={{ color: '#000' }}>LKR 0.00</strong>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', borderTop: '1px solid #ddd', paddingTop: 16, fontSize: 12, color: '#555' }}>
              <p style={{ margin: '0 0 4px' }}>Thank you for staying at {siteContent.hotelName}.</p>
              <p style={{ margin: 0 }}>This is a computer-generated receipt and requires no physical signature.</p>
            </div>
          </div>
        </div>
      ) : loadingDetail ? (
        <div className="card-ui" style={{ padding: 28 }}>
          <Skeleton height={280} />
        </div>
      ) : reservation ? (
        /* SELECTED RESERVATION BILL & SETTLEMENT PANEL */
        <div className="card-ui" style={{ padding: 28 }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 20,
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>
                  {reservation.booking_ref}
                </span>
                <StatusText status={reservation.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Guest: <strong>{reservation.customer_name || reservation.customer?.name}</strong> • Room{' '}
                <strong>{reservation.room?.room_number} ({reservation.room?.room_type})</strong>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setReservation(null)}>
              <X size={16} /> Close Details
            </Button>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: 'rgba(248, 113, 113, 0.12)',
                border: '1px solid rgba(248, 113, 113, 0.35)',
                borderRadius: 'var(--radius)',
                color: 'var(--danger)',
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{serverError}</div>
            </div>
          )}

          {/* BILL PANEL */}
          <div
            style={{
              background: 'var(--input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', marginBottom: 16 }}>
              <Receipt size={18} />
              <h3 className="font-serif" style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>
                Folio & Settlement Summary
              </h3>
            </div>

            {/* Room charge line */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 14,
              }}
            >
              <div>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>Room Charge Line:</span>{' '}
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  ({nights} nights × {formatLKR(nightlyRate)})
                </span>
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {formatLKR(totalAmount)}
              </span>
            </div>

            {/* Total Amount */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 14,
              }}
            >
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>Total Folio Charges:</span>
              <span style={{ fontWeight: 700, color: 'var(--gold)' }}>
                {formatLKR(totalAmount)}
              </span>
            </div>

            {/* Payments Received List */}
            <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                Payments Received ({regularPayments.length})
              </div>
              {regularPayments.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                  No payments recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {regularPayments.map((p) => (
                    <div
                      key={p.payment_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 3,
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>
                          {p.payment_method}
                        </span>
                        {p.transaction_ref && (
                          <span style={{ color: 'var(--muted)', marginLeft: 8, fontFamily: 'monospace' }}>
                            Ref: {p.transaction_ref}
                          </span>
                        )}
                        <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11 }}>
                          {formatDateTime(p.created_at)}
                        </span>
                      </div>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {formatLKR(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Refunds if any */}
            {refunds.length > 0 && (
              <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Refunds Issued ({refunds.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {refunds.map((p) => (
                    <div
                      key={p.payment_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        padding: '6px 10px',
                        background: 'rgba(248, 113, 113, 0.05)',
                        borderRadius: 3,
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                          Refund ({p.payment_method})
                        </span>
                        {p.note && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{p.note}</span>}
                      </div>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        - {formatLKR(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Balance Due Highlight */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Balance Due:
                </span>
                {balance > 0 ? (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--danger)' }}>
                    Outstanding balance must be 0 to complete check-out.
                  </p>
                ) : (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--success)' }}>
                    Folio is fully settled. Check-out may now be completed.
                  </p>
                )}
              </div>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: balance > 0 ? 'var(--gold)' : 'var(--success)',
                }}
              >
                {formatLKR(balance)}
              </span>
            </div>
          </div>

          {/* PAYMENT FORM (when balance > 0) */}
          {balance > 0 && (
            <div
              className="card-ui"
              style={{
                padding: 20,
                background: 'rgba(200, 169, 106, 0.04)',
                border: '1px solid var(--border-strong)',
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', marginBottom: 14 }}>
                <CreditCard size={18} />
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  Record Payment (Settle Balance)
                </h4>
              </div>

              {paymentError && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(248, 113, 113, 0.15)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--danger)',
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  {paymentError}
                </div>
              )}

              <form onSubmit={handleRecordPayment}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
                  <FormField label="Amount (LKR)" required>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={balance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={String(balance)}
                      required
                    />
                  </FormField>

                  <FormField label="Method" required>
                    <Select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="online">Online</option>
                    </Select>
                  </FormField>

                  <FormField
                    label={paymentMethod === 'cash' ? 'Reference (Optional)' : 'Reference'}
                    required={paymentMethod !== 'cash'}
                  >
                    <Input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder={paymentMethod === 'cash' ? 'Cash receipt #' : 'Card / Bank Trans. Ref'}
                      required={paymentMethod !== 'cash'}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Optional note / memo..."
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={paymentSubmitting}
                    style={{ gap: 6 }}
                  >
                    <CreditCard size={14} /> Record Payment
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* CHECK-OUT COMPLETION ACTION */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border)',
              paddingTop: 20,
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              {balance > 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Complete check-out is disabled until the balance of {formatLKR(balance)} is recorded.
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--success)' }}>
                  Ready to depart. Clicking Complete Check-Out will release Room {reservation.room?.room_number}.
                </div>
              )}
            </div>

            <Button
              id="btn-complete-checkout"
              variant="primary"
              size="lg"
              disabled={balance > 0 || checkingOut || reservation.status !== 'checked_in'}
              loading={checkingOut}
              onClick={handleCompleteCheckOut}
              style={{ minWidth: 220, gap: 8 }}
            >
              <LogOut size={18} />
              Complete Check-Out
            </Button>
          </div>
        </div>
      ) : (
        /* DEFAULT LIST: IN HOUSE GUESTS */
        <div className="card-ui" style={{ padding: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogOut size={20} style={{ color: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                In House Guests ({inHouseList.length})
              </h2>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Stays currently checked in. Guests departing today ({formatDate(todayStr)}) are listed first.
            </span>
          </div>

          {loadingList ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          ) : inHouseList.length === 0 ? (
            <EmptyState
              icon={<LogOut size={36} />}
              title="No In House Guests"
              message="There are currently no active checked-in stays in the hotel."
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table-ui">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Departure Date</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inHouseList.map((r) => {
                    const isDepartingToday = r.check_out_date === todayStr;
                    return (
                      <tr
                        key={r.booking_ref}
                        onClick={() => handleSelectReservation(r.booking_ref)}
                        style={{
                          cursor: 'pointer',
                          background: isDepartingToday ? 'rgba(251, 191, 36, 0.05)' : undefined,
                        }}
                      >
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)' }}>
                          {r.booking_ref}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {r.customer_name || r.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.phone || r.email}</div>
                        </td>
                        <td>
                          Room {r.room_number}{' '}
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.room_type})</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: isDepartingToday ? 700 : 400, color: isDepartingToday ? 'var(--warning)' : 'var(--text-body)' }}>
                            {formatDate(r.check_out_date)}
                          </span>
                          {isDepartingToday && (
                            <span
                              style={{
                                marginLeft: 8,
                                padding: '2px 8px',
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: 'rgba(251, 191, 36, 0.15)',
                                color: 'var(--warning)',
                                borderRadius: 3,
                              }}
                            >
                              Today
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: r.balance > 0 ? 'var(--gold)' : 'var(--success)' }}>
                          {formatLKR(r.balance ?? 0)}
                        </td>
                        <td>
                          <StatusText status={r.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            size="sm"
                            variant={isDepartingToday ? 'primary' : 'secondary'}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectReservation(r.booking_ref);
                            }}
                          >
                            Check Out
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
