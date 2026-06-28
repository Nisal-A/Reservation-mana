import { useEffect, useState } from 'react';
import { BedDouble, CalendarCheck, BookOpen, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/UI';

export default function CustomerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ confirmed: 0, total: 0, availableRooms: 0 });
  const [loading, setLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/reservations'),
      api.get('/rooms', { params: { status: 'available' } }),
    ]).then(([res, rooms]) => {
      const myRes = res.data;
      setSummary({
        confirmed: myRes.filter((r) => r.status === 'confirmed').length,
        total: myRes.length,
        availableRooms: rooms.data.length,
      });
      setRecentBookings(myRes.slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  const quickActions = [
    { icon: <BedDouble size={28} />, label: 'Browse Rooms', sub: 'See all available rooms', to: '/customer/rooms', color: '#d4a843' },
    { icon: <BookOpen size={28} />,  label: 'Book a Room',  sub: 'Make a reservation',     to: '/customer/book',  color: '#3b82f6' },
    { icon: <History size={28} />,   label: 'My Bookings',  sub: 'View booking history',   to: '/customer/bookings', color: '#10b981' },
  ];

  return (
    <div className="page-content slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hello, {user.name || user.username} 👋</h1>
          <p className="page-subtitle">Welcome to LuxeStay — your comfort is our priority</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 32 }}>
        {[
          { label: 'Available Rooms',   value: summary.availableRooms, color: '#d4a843' },
          { label: 'Confirmed Bookings',value: summary.confirmed,      color: '#3b82f6' },
          { label: 'Total Bookings',    value: summary.total,          color: '#10b981' },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
        {quickActions.map((a) => (
          <button
            key={a.label}
            className="card"
            onClick={() => navigate(a.to)}
            style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ color: a.color }}>{a.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{a.label}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Recent Bookings */}
      {recentBookings.length > 0 && (
        <div className="card">
          <div className="card-title">📋 Recent Bookings</div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Room</th><th>Check-In</th><th>Check-Out</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentBookings.map((r) => (
                  <tr key={r.reservation_id}>
                    <td style={{ color:'var(--color-text-muted)' }}>#{r.reservation_id}</td>
                    <td>Room {r.room_number} <span style={{ color:'var(--color-text-muted)', fontSize:'0.8rem' }}>({r.room_type})</span></td>
                    <td>{fmt(r.check_in_date)}</td>
                    <td>{fmt(r.check_out_date)}</td>
                    <td style={{ color:'var(--color-gold)', fontWeight:700 }}>${Number(r.total_amount).toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${r.status}`}>{r.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
