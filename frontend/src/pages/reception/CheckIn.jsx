// frontend/src/pages/reception/CheckIn.jsx
// Guest Check-In page for Reception

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  BedDouble,
  Calendar,
  X,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  User,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import siteContent from '../../config/siteContent';
import { formatDate, formatLKR, todayISO } from '../../utils/format';
import {
  Button,
  StatusText,
  PageHeader,
  Skeleton,
  EmptyState,
} from '../../components/UI';

export default function CheckIn() {
  const [searchTerm, setSearchTerm] = useState('');
  const [arrivingToday, setArrivingToday] = useState([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Selected reservation state
  const [reservation, setReservation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingPending, setConfirmingPending] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [checkInSuccess, setCheckInSuccess] = useState(null);

  const todayStr = todayISO();

  // Load Arriving Today list from Frontdesk Summary
  const fetchArrivingToday = useCallback(async () => {
    try {
      setLoadingArrivals(true);
      const res = await api.get('/frontdesk/summary');
      setArrivingToday(res.data?.arrivals || []);
    } catch {
      toast.error('Failed to load arrivals for today.');
    } finally {
      setLoadingArrivals(false);
    }
  }, []);

  useEffect(() => {
    fetchArrivingToday();
  }, [fetchArrivingToday]);

  // Load detailed reservation when selectedRef changes
  const loadReservationDetail = useCallback(async (ref) => {
    if (!ref) {
      setReservation(null);
      return;
    }
    try {
      setLoadingDetail(true);
      setServerError(null);
      setIdVerified(false);
      setCheckInSuccess(null);
      const res = await api.get(`/reservations/${encodeURIComponent(ref.trim())}`);
      setReservation(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load reservation details.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelectReservation = (ref) => {
    loadReservationDetail(ref);
  };

  // Search handler (booking ref, name, phone)
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

      // Check if it's an exact booking ref match (e.g. LS-...)
      if (/^LS-\d{4}-\d{6}$/i.test(query)) {
        handleSelectReservation(query.toUpperCase());
        setSearchResults([]);
        return;
      }

      const res = await api.get('/reservations', {
        params: { q: query, limit: 10 },
      });

      const list = res.data?.data || [];
      if (list.length === 1) {
        handleSelectReservation(list[0].booking_ref);
        setSearchResults([]);
      } else {
        setSearchResults(list);
        if (list.length === 0) {
          toast.error('No reservations matching your search.');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  // Confirm pending reservation
  const handleConfirmPending = async () => {
    if (!reservation) return;
    try {
      setConfirmingPending(true);
      setServerError(null);
      await api.patch(`/reservations/${reservation.booking_ref}/confirm`);
      toast.success(`Booking ${reservation.booking_ref} confirmed successfully.`);
      await loadReservationDetail(reservation.booking_ref);
      await fetchArrivingToday();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to confirm reservation.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setConfirmingPending(false);
    }
  };

  // Complete Check-In
  const handleCompleteCheckIn = async () => {
    if (!reservation) return;
    if (!idVerified) {
      setServerError('Please verify the guest identity before proceeding with check-in.');
      return;
    }

    try {
      setSubmitting(true);
      setServerError(null);
      const res = await api.patch(`/reservations/${reservation.booking_ref}/check-in`, {
        id_verified: true,
      });

      toast.success(`Check-in complete for Room ${res.data?.room_number || reservation.room?.room_number}!`);
      setCheckInSuccess({
        room_number: res.data?.room_number || reservation.room?.room_number,
        room_type: res.data?.room_type || reservation.room?.room_type,
        check_out_date: res.data?.check_out_date || reservation.check_out_date,
        booking_ref: reservation.booking_ref,
        guest_name: reservation.customer_name || reservation.customer?.name,
      });
      await fetchArrivingToday();
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-in failed.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setReservation(null);
    setCheckInSuccess(null);
    setServerError(null);
    setIdVerified(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Room state logic
  const room = reservation?.room || {};
  const isRoomMaintenance = room.status === 'maintenance';
  const isRoomOccupiedByOther = Boolean(room.is_occupied_by_other);
  const isRoomBlocked = isRoomMaintenance || isRoomOccupiedByOther;

  // Status & Date eligibility
  const isPending = reservation?.status === 'pending';
  const isConfirmed = reservation?.status === 'confirmed';
  const isCheckedIn = reservation?.status === 'checked_in';
  const isAlreadyDeparted = ['checked_out', 'cancelled', 'no_show'].includes(reservation?.status);
  const isBeforeArrivalDate = reservation && todayStr < reservation.check_in_date;
  const isPastDepartureDate = reservation && todayStr >= reservation.check_out_date;

  const canCheckIn =
    isConfirmed &&
    !isRoomBlocked &&
    !isBeforeArrivalDate &&
    !isPastDepartureDate &&
    idVerified &&
    !submitting;

  return (
    <div className="page-content slide-up" style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader
        title="Guest Check-In"
        subtitle="Verify guest identity, check room readiness, and complete check-in"
      />

      {/* TOP SEARCH & ARRIVING TODAY BAR */}
      <div className="card-ui" style={{ padding: 24, marginBottom: 24 }}>
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
              placeholder="Search booking reference (e.g. LS-2026-000001), guest name, or phone..."
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
            onClick={fetchArrivingToday}
            loading={loadingArrivals}
            style={{ gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </form>

        {/* Search Results Dropdown List (if multiple results found) */}
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
              SEARCH MATCHES ({searchResults.length})
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
                    Room {r.room_number} • {formatDate(r.check_in_date)} to {formatDate(r.check_out_date)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusText status={r.status} />
                  <Button size="xs" variant="secondary">Select</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SUCCESS SCREEN */}
      {checkInSuccess ? (
        <div className="card-ui" style={{ padding: 40, textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(52, 211, 153, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
          >
            <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
          </div>

          <h2 className="font-serif" style={{ fontSize: 28, color: 'var(--text)', marginBottom: 12 }}>
            Check-In Completed
          </h2>
          <p style={{ color: 'var(--text-body)', fontSize: 15, maxWidth: 520, margin: '0 auto 28px' }}>
            Guest <strong>{checkInSuccess.guest_name}</strong> has been successfully checked in.
          </p>

          <div
            style={{
              background: 'var(--input)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              padding: 24,
              maxWidth: 480,
              margin: '0 auto 32px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Assigned Room</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>
                Room {checkInSuccess.room_number} ({checkInSuccess.room_type})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Scheduled Check-Out</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {formatDate(checkInSuccess.check_out_date)} at {siteContent.checkOutTime}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Booking Reference</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)' }}>
                {checkInSuccess.booking_ref}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
            <Button variant="primary" onClick={handleReset}>
              Check In Another Guest
            </Button>
          </div>
        </div>
      ) : loadingDetail ? (
        <div className="card-ui" style={{ padding: 28 }}>
          <Skeleton height={280} />
        </div>
      ) : reservation ? (
        /* SELECTED RESERVATION DETAIL PANEL */
        <div className="card-ui" style={{ padding: 28 }}>
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
                Created on {formatDate(reservation.created_at)} • Source: {reservation.booking_source || 'online'}
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setReservation(null)}>
              <X size={16} /> Close Details
            </Button>
          </div>

          {/* Server Error Alert Banner */}
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

          {/* Room Blocking Alert (Maintenance or Occupied) */}
          {isRoomMaintenance && (
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
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Room Blocked:</strong> Room {room.room_number} is currently marked as under maintenance.
                Housekeeping or maintenance must release this room before check-in can be completed.
              </div>
            </div>
          )}

          {isRoomOccupiedByOther && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                borderRadius: 'var(--radius)',
                color: 'var(--warning)',
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Room Currently Occupied:</strong> Room {room.room_number} is still occupied by reservation{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{room.occupied_by_ref}</span>.
                The departure must be processed before the new stay can check in.
              </div>
            </div>
          )}

          {/* Status notices */}
          {isPending && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'rgba(96, 165, 250, 0.12)',
                border: '1px solid rgba(96, 165, 250, 0.35)',
                borderRadius: 'var(--radius)',
                color: 'var(--info)',
                fontSize: 14,
                marginBottom: 20,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={18} />
                <span>This reservation is pending. Stays must be confirmed prior to check-in.</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                loading={confirmingPending}
                onClick={handleConfirmPending}
              >
                Confirm Booking First
              </Button>
            </div>
          )}

          {isCheckedIn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 'var(--radius)',
                color: 'var(--success)',
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              <CheckCircle2 size={18} />
              <span>Guest has already checked in to Room {room.room_number}.</span>
            </div>
          )}

          {isBeforeArrivalDate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: 'var(--radius)',
                color: 'var(--warning)',
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              <AlertTriangle size={18} />
              <span>
                Arrival date is {formatDate(reservation.check_in_date)}. Early check-in before the check-in date is not allowed.
              </span>
            </div>
          )}

          {isAlreadyDeparted && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: 'rgba(248, 113, 113, 0.12)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: 'var(--radius)',
                color: 'var(--danger)',
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              <AlertTriangle size={18} />
              <span>
                This reservation is marked as <StatusText status={reservation.status} /> and cannot be checked in.
              </span>
            </div>
          )}

          {/* Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Guest Contact */}
            <div
              style={{
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', marginBottom: 10 }}>
                <User size={16} />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>PRIMARY GUEST</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
                {reservation.customer_name || reservation.customer?.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                <Phone size={13} /> {reservation.customer_phone || reservation.customer?.phone || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <Mail size={13} /> {reservation.customer_email || reservation.customer?.email || '—'}
              </div>
            </div>

            {/* Room & Stay */}
            <div
              style={{
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', marginBottom: 10 }}>
                <BedDouble size={16} />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>ROOM DETAILS</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>
                Room {room.room_number || reservation.room_number} • {room.room_type || reservation.room_type}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-body)', marginBottom: 4 }}>
                Stay: {formatDate(reservation.check_in_date)} to {formatDate(reservation.check_out_date)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {reservation.guests} Guest(s) • Rate: {formatLKR(reservation.nightly_rate || room.price)} / night
              </div>
            </div>

            {/* Billing & Balance */}
            <div
              style={{
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', marginBottom: 10 }}>
                <Calendar size={16} />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>BILLING SUMMARY</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--muted)' }}>Stay Total:</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {formatLKR(reservation.bill?.total_amount || reservation.total_amount)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--muted)' }}>Paid to date:</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {formatLKR(reservation.bill?.paid_amount || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Balance Due:</span>
                <span style={{ fontWeight: 700, color: (reservation.bill?.balance || 0) > 0 ? 'var(--gold)' : 'var(--success)' }}>
                  {formatLKR(reservation.bill?.balance ?? reservation.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Guest Remark */}
          {reservation.remark && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(200, 169, 106, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 13,
                color: 'var(--text-body)',
                marginBottom: 24,
              }}
            >
              <strong style={{ color: 'var(--gold)' }}>Guest Remarks / Requests:</strong> {reservation.remark}
            </div>
          )}

          {/* CHECK-IN ACTION FORM */}
          {isConfirmed && !isRoomBlocked && !isBeforeArrivalDate && !isPastDepartureDate && (
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  id="identity-verified-checkbox"
                  checked={idVerified}
                  onChange={(e) => setIdVerified(e.target.checked)}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: 'var(--gold)',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  Guest identity verified (Government-issued photo identification verified at the desk)
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button
                  id="btn-complete-checkin"
                  variant="primary"
                  size="lg"
                  disabled={!canCheckIn}
                  loading={submitting}
                  onClick={handleCompleteCheckIn}
                  style={{ minWidth: 200, gap: 8 }}
                >
                  <ShieldCheck size={18} />
                  Complete Check-In
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* DEFAULT LIST: ARRIVING TODAY */
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
              <UserCheck size={20} style={{ color: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                Arriving Today ({arrivingToday.length})
              </h2>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Confirmed reservations scheduled for arrival on {formatDate(todayStr)}
            </span>
          </div>

          {loadingArrivals ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          ) : arrivingToday.length === 0 ? (
            <EmptyState
              icon={<UserCheck size={36} />}
              title="No Arrivals Scheduled Today"
              message="There are no confirmed guests scheduled to check in today. Use the search bar above to look up future stays or walk-ins."
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table-ui">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Stay Dates</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {arrivingToday.map((r) => (
                    <tr
                      key={r.booking_ref}
                      onClick={() => handleSelectReservation(r.booking_ref)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)' }}>
                        {r.booking_ref}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.guest_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.phone}</div>
                      </td>
                      <td>
                        Room {r.room_number}{' '}
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.room_type})</span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {formatDate(r.check_in_date)} to {formatDate(r.check_out_date)}
                      </td>
                      <td style={{ fontWeight: 600, color: r.balance > 0 ? 'var(--gold)' : 'var(--success)' }}>
                        {formatLKR(r.balance)}
                      </td>
                      <td>
                        <StatusText status={r.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectReservation(r.booking_ref);
                          }}
                        >
                          Check In
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
