import { useEffect, useState, useCallback } from 'react';
import { Search, Eye, X, UserCheck, LogOut, Calendar, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, StatusBadge, EmptyState, PageHeader } from '../../components/UI';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatLKR } from '../../utils/format';

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

export default function ReceptionReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewRes, setViewRes] = useState(null);
  const navigate = useNavigate();

  const fetch = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.q = search;
      const { data } = await api.get('/reservations', { params });
      setReservations(Array.isArray(data) ? data : (data.data || []));
    } catch { toast.error('Failed to load'); }
    finally  { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCancel = async (ref) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try {
      await api.patch(`/reservations/${ref}/cancel`);
      toast.success('Cancelled'); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Reservations"
        subtitle={`${reservations.length} records`}
        action={
          <button className="btn btn-primary" onClick={() => navigate('/reception/create-reservation')}>
            <Plus size={16} /> New Reservation
          </button>
        }
      />

      <div className="filters-row">
        <form className="search-bar" style={{ flex: 1, maxWidth: 400 }} onSubmit={(e) => { e.preventDefault(); fetch(); }}>
          <Search size={16} />
          <input placeholder="Search name, email, room..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select className="form-input" style={{ width: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={fetch}>Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {reservations.length === 0
          ? <EmptyState icon={Calendar} title="No reservations found" />
          : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Customer</th><th>Room</th><th>Check-In</th><th>Check-Out</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.reservation_id}>
                      <td style={{ color: 'var(--color-text-muted)' }}>#{r.reservation_id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.customer_email}</div>
                      </td>
                      <td>Room {r.room_number} <span style={{ color:'var(--color-text-muted)', fontSize:'0.8rem' }}>({r.room_type})</span></td>
                      <td>{formatDate(r.check_in_date)}</td>
                      <td>{formatDate(r.check_out_date)}</td>
                      <td style={{ color:'var(--color-gold)', fontWeight:700 }}>{formatLKR(r.total_amount)}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-btn" onClick={() => setViewRes(r)} title="View"><Eye size={14}/></button>
                          {r.status === 'confirmed' && (
                            <button className="icon-btn" title="Check-In"
                              style={{ color:'var(--color-success)', borderColor:'rgba(16,185,129,0.3)' }}
                              onClick={() => navigate(`/reception/checkin`)}>
                              <UserCheck size={14}/>
                            </button>
                          )}
                          {r.status === 'checked_in' && (
                            <button className="icon-btn" title="Check-Out"
                              style={{ color:'var(--color-warning)', borderColor:'rgba(245,158,11,0.3)' }}
                              onClick={() => navigate(`/reception/checkout`)}>
                              <LogOut size={14}/>
                            </button>
                          )}
                          {['pending','confirmed'].includes(r.status) && (
                            <button className="icon-btn" title="Cancel"
                              style={{ color:'var(--color-error)', borderColor:'rgba(239,68,68,0.2)' }}
                              onClick={() => handleCancel(r.booking_ref || r.reservation_id)}>
                              <X size={14}/>
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
              <button className="icon-btn" onClick={() => setViewRes(null)}><X size={16} /></button>
            </div>
            {[
              ['Customer',   viewRes.customer_name],
              ['Email',      viewRes.customer_email],
              ['Phone',      viewRes.customer_phone || '—'],
              ['Room',       `${viewRes.room_number} (${viewRes.room_type})`],
              ['Check-In',   formatDate(viewRes.check_in_date)],
              ['Check-Out',  formatDate(viewRes.check_out_date)],
              ['Amount',     formatLKR(viewRes.total_amount)],
              ['Status',     <StatusBadge key="status" status={viewRes.status} />],
              ['Remarks',    viewRes.remark || '—'],
            ].map(([l, v]) => (
              <div className="detail-row" key={l}>
                <span className="detail-label">{l}</span>
                <span className="detail-value">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
