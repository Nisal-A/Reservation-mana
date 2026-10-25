import { useState } from 'react';
import { Search, UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, StatusBadge } from '../../components/UI';
import { formatDate, formatLKR } from '../../utils/format';

export default function CheckIn() {
  const [searchId, setSearchId] = useState('');
  const [reservation, setReservation] = useState(null);
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    setSearching(true);
    setReservation(null);
    setDone(false);
    try {
      const { data } = await api.get(`/reservations/${searchId}`);
      setReservation(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reservation not found');
    } finally { setSearching(false); }
  };

  const handleCheckIn = async () => {
    setProcessing(true);
    try {
      const ref = reservation.booking_ref || reservation.reservation_id;
      await api.patch(`/reservations/${ref}/check-in`);
      toast.success('Guest checked in successfully!');
      setDone(true);
      setReservation({ ...reservation, status: 'checked_in' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally { setProcessing(false); }
  };

  return (
    <div className="page-content slide-up">
      <PageHeader title="Guest Check-In" subtitle="Search reservation by booking reference to process check-in" />

      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <form className="card" onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Booking Reference</label>
            <input
              id="checkin-search"
              className="form-input"
              type="text"
              placeholder="Enter booking reference (e.g. LS-2026-000001)..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={searching}>
            <Search size={16} /> {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {reservation && (
          <div className="card slide-up">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Reservation {reservation.booking_ref || `#${reservation.reservation_id}`}</span>
              <StatusBadge status={reservation.status} />
            </div>

            {[
              ['Guest Name',  reservation.customer_name],
              ['Email',       reservation.customer_email],
              ['Phone',       reservation.customer_phone || '—'],
              ['Room',        `${reservation.room_number} — ${reservation.room_type}`],
              ['Check-In',    formatDate(reservation.check_in_date)],
              ['Check-Out',   formatDate(reservation.check_out_date)],
              ['Total',       formatLKR(reservation.total_amount)],
              ['Remarks',     reservation.remark || '—'],
            ].map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span className="detail-label">{label}</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}

            {done ? (
              <div className="alert alert-success" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} /> Guest has been successfully checked in!
              </div>
            ) : reservation.status === 'confirmed' ? (
              <button
                id="btn-confirm-checkin"
                className="btn btn-primary w-full"
                style={{ marginTop: 20 }}
                onClick={handleCheckIn}
                disabled={processing}
              >
                <UserCheck size={16} />
                {processing ? 'Processing...' : 'Confirm Check-In'}
              </button>
            ) : (
              <div className="alert alert-warning" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> Cannot check in. Status is: <strong>{reservation.status}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
