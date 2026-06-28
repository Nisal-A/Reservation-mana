import { useEffect, useState } from 'react';
import { Search, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, StatusBadge, EmptyState, PageHeader } from '../../components/UI';

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

export default function AdminReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewRes, setViewRes] = useState(null);

  const fetchReservations = async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const { data } = await api.get('/reservations', { params });
      setReservations(data);
    } catch { toast.error('Failed to load reservations'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchReservations(); }, [filterStatus]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchReservations();
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try {
      await api.patch(`/reservations/${id}/cancel`);
      toast.success('Reservation cancelled');
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader title="All Reservations" subtitle={`${reservations.length} reservations`} />

      <div className="filters-row">
        <form className="search-bar" onSubmit={handleSearch} style={{ flex: 1, maxWidth: 420 }}>
          <Search size={16} />
          <input
            placeholder="Search by name, email, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <select className="form-input" style={{ width: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={fetchReservations}>Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {reservations.length === 0 ? (
          <EmptyState icon="📅" title="No reservations found" />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#ID</th>
                  <th>Customer</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.reservation_id}>
                    <td style={{ color: 'var(--color-text-muted)' }}>#{r.reservation_id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.customer_email}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>Room {r.room_number}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.room_type}</div>
                    </td>
                    <td>{fmt(r.check_in_date)}</td>
                    <td>{fmt(r.check_out_date)}</td>
                    <td style={{ color: 'var(--color-gold)', fontWeight: 700 }}>
                      ${Number(r.total_amount).toFixed(2)}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" onClick={() => setViewRes(r)} title="View"><Eye size={15} /></button>
                        {['pending','confirmed'].includes(r.status) && (
                          <button className="icon-btn" onClick={() => handleCancel(r.reservation_id)} title="Cancel"
                            style={{ color:'var(--color-error)', borderColor:'rgba(239,68,68,0.2)' }}>
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewRes && (
        <div className="modal-overlay" onClick={() => setViewRes(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Reservation #{viewRes.reservation_id}</div>
              <button className="icon-btn" onClick={() => setViewRes(null)}>✕</button>
            </div>
            <div>
              {[
                ['Customer',   viewRes.customer_name],
                ['Email',      viewRes.customer_email],
                ['Phone',      viewRes.customer_phone || '—'],
                ['Room',       `${viewRes.room_number} (${viewRes.room_type})`],
                ['Check-In',   fmt(viewRes.check_in_date)],
                ['Check-Out',  fmt(viewRes.check_out_date)],
                ['Amount',     `$${Number(viewRes.total_amount).toFixed(2)}`],
                ['Status',     <StatusBadge status={viewRes.status} />],
                ['Remarks',    viewRes.remark || '—'],
              ].map(([label, value]) => (
                <div className="detail-row" key={label}>
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
