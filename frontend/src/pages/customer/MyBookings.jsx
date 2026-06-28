import { useEffect, useState } from 'react';
import { X, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, StatusBadge, EmptyState, PageHeader, ConfirmModal } from '../../components/UI';

export default function MyBookings() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewRes, setViewRes] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchReservations = async () => {
    try {
      const { data } = await api.get('/reservations');
      setReservations(data);
    } catch { toast.error('Failed to load bookings'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchReservations(); }, []);

  const handleCancel = async () => {
    try {
      await api.patch(`/reservations/${cancelTarget.reservation_id}/cancel`);
      toast.success('Reservation cancelled');
      setCancelTarget(null);
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
      setCancelTarget(null);
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  const filtered = filterStatus ? reservations.filter((r) => r.status === filterStatus) : reservations;

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader title="My Bookings" subtitle={`${reservations.length} total reservation${reservations.length !== 1 ? 's' : ''}`} />

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {['', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📅" title="No bookings found"
          message="You haven't made any reservations yet. Browse our rooms to get started!" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((r) => (
            <div key={r.reservation_id} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                      Room {r.room_number} — {r.room_type}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 24, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    <span>📅 Check-In: <strong style={{ color:'var(--color-text)' }}>{fmt(r.check_in_date)}</strong></span>
                    <span>📅 Check-Out: <strong style={{ color:'var(--color-text)' }}>{fmt(r.check_out_date)}</strong></span>
                    <span>
                      Nights: <strong style={{ color:'var(--color-text)' }}>
                        {Math.round((new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000)}
                      </strong>
                    </span>
                  </div>
                  {r.remark && (
                    <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      💬 {r.remark}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ color: 'var(--color-gold)', fontWeight: 800, fontSize: '1.3rem' }}>
                    ${Number(r.total_amount).toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="icon-btn" onClick={() => setViewRes(r)} title="Details">
                      <Eye size={14} />
                    </button>
                    {['pending', 'confirmed'].includes(r.status) && (
                      <button
                        className="icon-btn"
                        onClick={() => setCancelTarget(r)}
                        title="Cancel"
                        style={{ color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.2)' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {viewRes && (
        <div className="modal-overlay" onClick={() => setViewRes(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Reservation #{viewRes.reservation_id}</div>
              <button className="icon-btn" onClick={() => setViewRes(null)}>✕</button>
            </div>
            {[
              ['Room',       `${viewRes.room_number} (${viewRes.room_type})`],
              ['Check-In',   fmt(viewRes.check_in_date)],
              ['Check-Out',  fmt(viewRes.check_out_date)],
              ['Nights',     Math.round((new Date(viewRes.check_out_date) - new Date(viewRes.check_in_date)) / 86400000)],
              ['Rate/Night', `$${Number(viewRes.room_price).toFixed(2)}`],
              ['Total',      `$${Number(viewRes.total_amount).toFixed(2)}`],
              ['Status',     <StatusBadge status={viewRes.status} />],
              ['Remarks',    viewRes.remark || '—'],
              ['Booked On',  fmt(viewRes.created_at)],
            ].map(([l, v]) => (
              <div className="detail-row" key={l}>
                <span className="detail-label">{l}</span>
                <span className="detail-value">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Confirm */}
      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel Reservation"
        message={`Are you sure you want to cancel your reservation for Room ${cancelTarget?.room_number}?`}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
        danger
      />
    </div>
  );
}
