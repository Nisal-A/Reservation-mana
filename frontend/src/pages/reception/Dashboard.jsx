import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LogIn,
  LogOut,
  BedDouble,
  Clock,
  CreditCard,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { formatDate, formatLKR } from '../../utils/format';
import {
  StatCard,
  Button,
  StatusText,
  ReservationDetailPanel,
  Skeleton,
  Eyebrow,
} from '../../components/UI';

export default function ReceptionDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);
  const [actionInProgress, setActionInProgress] = useState({});

  const timerRef = useRef(null);

  const fetchSummary = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setRefreshing(true);
      const res = await api.get('/frontdesk/summary');
      setData(res.data);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-LK', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setLastUpdated(timeStr);
    } catch {
      if (!isBackground) {
        toast.error('Failed to load frontdesk summary.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();

    // Auto-refresh every 60 seconds
    timerRef.current = setInterval(() => {
      fetchSummary(true);
    }, 60000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchSummary]);

  // One-click Confirm (Pending)
  const handleOneClickConfirm = async (e, bookingRef) => {
    e.stopPropagation();
    setActionInProgress((prev) => ({ ...prev, [bookingRef]: 'confirm' }));
    try {
      await api.patch(`/reservations/${bookingRef}/confirm`);
      toast.success(`Booking ${bookingRef} confirmed.`);
      await fetchSummary(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm reservation.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [bookingRef]: null }));
    }
  };

  // One-click Check In (Arrival)
  const handleOneClickCheckIn = async (e, bookingRef, roomNumber) => {
    e.stopPropagation();
    setActionInProgress((prev) => ({ ...prev, [bookingRef]: 'checkin' }));
    try {
      await api.patch(`/reservations/${bookingRef}/check-in`);
      toast.success(`Guest checked in to Room ${roomNumber}.`);
      await fetchSummary(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check in.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [bookingRef]: null }));
    }
  };

  // One-click Check Out (Departure)
  const handleOneClickCheckOut = async (e, bookingRef, balance) => {
    e.stopPropagation();
    if (balance > 0) {
      toast.error(`Outstanding balance of ${formatLKR(balance)}. Open folio to record payment before check out.`);
      setSelectedBookingRef(bookingRef);
      return;
    }
    setActionInProgress((prev) => ({ ...prev, [bookingRef]: 'checkout' }));
    try {
      await api.patch(`/reservations/${bookingRef}/check-out`);
      toast.success(`Guest checked out successfully.`);
      await fetchSummary(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check out.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [bookingRef]: null }));
    }
  };

  const counts = data?.counts || {
    arrivals: 0,
    departures: 0,
    in_house: 0,
    pending: 0,
    outstanding: 0,
  };

  const arrivals = data?.arrivals || [];
  const departures = data?.departures || [];
  const pending = data?.pending || [];

  return (
    <div className="page-content slide-up" style={{ paddingBottom: 60 }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <Eyebrow text="FRONT DESK OPERATIONS" />
          <h1 className="page-title" style={{ marginTop: 4, marginBottom: 6 }}>
            Reception Dashboard
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Daily guest movement, stay operations, and pending folio management.
          </p>
        </div>

        {/* Refresh button & Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {lastUpdated && (
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Updated at {lastUpdated}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchSummary()}
            loading={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 5 StatCards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 36,
        }}
      >
        <StatCard
          icon={<LogIn size={20} />}
          label="Arrivals Today"
          value={loading ? '...' : counts.arrivals}
          color="var(--gold)"
          bg="rgba(200, 169, 106, 0.12)"
        />
        <StatCard
          icon={<LogOut size={20} />}
          label="Departures Today"
          value={loading ? '...' : counts.departures}
          color="var(--warning)"
          bg="rgba(251, 191, 36, 0.12)"
        />
        <StatCard
          icon={<BedDouble size={20} />}
          label="In House"
          value={loading ? '...' : counts.in_house}
          color="var(--success)"
          bg="rgba(52, 211, 153, 0.12)"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Pending Bookings"
          value={loading ? '...' : counts.pending}
          color="var(--info)"
          bg="rgba(96, 165, 250, 0.12)"
        />
        <StatCard
          icon={<CreditCard size={20} />}
          label="Outstanding (LKR)"
          value={loading ? '...' : formatLKR(counts.outstanding)}
          color="var(--danger)"
          bg="rgba(248, 113, 113, 0.12)"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Skeleton height={200} />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* LIST 1: ARRIVALS TODAY */}
          <div className="card-ui" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogIn size={18} style={{ color: 'var(--gold)' }} />
                <h2 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                  Arrivals Today ({arrivals.length})
                </h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Confirmed stays checking in today
              </span>
            </div>

            {arrivals.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>
                No arrivals scheduled for today.
              </p>
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
                    {arrivals.map((r) => (
                      <tr
                        key={r.booking_ref}
                        onClick={() => setSelectedBookingRef(r.booking_ref)}
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
                          Room {r.room_number} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.room_type})</span>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {formatDate(r.check_in_date)} <ArrowRight size={12} style={{ display: 'inline', margin: '0 2px' }} /> {formatDate(r.check_out_date)}
                        </td>
                        <td style={{ fontWeight: 600, color: r.balance > 0 ? 'var(--warning)' : 'var(--text)' }}>
                          {formatLKR(r.balance)}
                        </td>
                        <td>
                          <StatusText status={r.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={actionInProgress[r.booking_ref] === 'checkin'}
                            onClick={(e) => handleOneClickCheckIn(e, r.booking_ref, r.room_number)}
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

          {/* LIST 2: DEPARTURES TODAY */}
          <div className="card-ui" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogOut size={18} style={{ color: 'var(--warning)' }} />
                <h2 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                  Departures Today ({departures.length})
                </h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                In-house stays scheduled to check out today
              </span>
            </div>

            {departures.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>
                No departures scheduled for today.
              </p>
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
                    {departures.map((r) => (
                      <tr
                        key={r.booking_ref}
                        onClick={() => setSelectedBookingRef(r.booking_ref)}
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
                          Room {r.room_number} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.room_type})</span>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {formatDate(r.check_in_date)} <ArrowRight size={12} style={{ display: 'inline', margin: '0 2px' }} /> {formatDate(r.check_out_date)}
                        </td>
                        <td style={{ fontWeight: 600, color: r.balance > 0 ? 'var(--warning)' : 'var(--text)' }}>
                          {formatLKR(r.balance)}
                        </td>
                        <td>
                          <StatusText status={r.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={actionInProgress[r.booking_ref] === 'checkout'}
                            onClick={(e) => handleOneClickCheckOut(e, r.booking_ref, r.balance)}
                          >
                            Check Out
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* LIST 3: PENDING APPROVALS */}
          <div className="card-ui" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={18} style={{ color: 'var(--info)' }} />
                <h2 className="font-serif" style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>
                  Pending Bookings ({pending.length})
                </h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Awaiting staff confirmation (oldest first)
              </span>
            </div>

            {pending.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>
                No pending bookings requiring confirmation.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table-ui">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Stay Dates</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr
                        key={r.booking_ref}
                        onClick={() => setSelectedBookingRef(r.booking_ref)}
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
                          Room {r.room_number} <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.room_type})</span>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {formatDate(r.check_in_date)} <ArrowRight size={12} style={{ display: 'inline', margin: '0 2px' }} /> {formatDate(r.check_out_date)}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--gold)' }}>
                          {formatLKR(r.total_amount)}
                        </td>
                        <td>
                          <StatusText status={r.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={actionInProgress[r.booking_ref] === 'confirm'}
                            onClick={(e) => handleOneClickConfirm(e, r.booking_ref)}
                          >
                            Confirm
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shared Reservation Detail Drawer Panel */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
        onActionComplete={() => fetchSummary(true)}
      />
    </div>
  );
}
