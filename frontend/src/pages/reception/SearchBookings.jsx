import { useState } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, StatusBadge, EmptyState } from '../../components/UI';
import { formatDate, formatLKR } from '../../utils/format';

export default function SearchBookings() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const params = {};
      if (search)       params.q      = search;
      if (filterStatus) params.status = filterStatus;
      if (fromDate)     params.from   = fromDate;
      if (toDate)       params.to     = toDate;
      const { data } = await api.get('/reservations', { params });
      setResults(Array.isArray(data) ? data : (data.data || []));
      setSearched(true);
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="page-content slide-up">
      <PageHeader title="Search Bookings" subtitle="Filter reservations by name, date, room, or status" />

      <form className="card" onSubmit={handleSearch} style={{ marginBottom: 24 }}>
        <div className="search-bookings-grid">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <div className="search-bar" style={{ maxWidth: '100%' }}>
              <Search size={16} />
              <input placeholder="Name, email, room..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Any Status</option>
              {['pending','confirmed','checked_in','checked_out','cancelled'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input className="form-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button id="btn-search-bookings" type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={16} /> {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {searched && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.9rem' }}>
            Found {results.length} reservation{results.length !== 1 ? 's' : ''}
          </div>
          {results.length === 0
            ? <EmptyState icon={Search} title="No results" message="Try different search criteria." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Customer</th><th>Room</th><th>Check-In</th><th>Check-Out</th><th>Amount</th><th>Status</th><th>Remark</th></tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.reservation_id}>
                        <td style={{ color: 'var(--color-text-muted)' }}>#{r.reservation_id}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{r.customer_phone}</div>
                        </td>
                        <td>Room {r.room_number} <span style={{ color:'var(--color-text-muted)', fontSize:'0.8rem' }}>({r.room_type})</span></td>
                        <td>{formatDate(r.check_in_date)}</td>
                        <td>{formatDate(r.check_out_date)}</td>
                        <td style={{ color:'var(--color-gold)', fontWeight:700 }}>{formatLKR(r.total_amount)}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.remark || '—'}
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
