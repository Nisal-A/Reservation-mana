import { useEffect, useState } from 'react';
import { BedDouble, CalendarCheck, LogIn, LogOut, Clock } from 'lucide-react';
import api from '../../api/axios';
import { PageLoader, StatCard } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

export default function ReceptionDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentRes, setRecentRes] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/reservations', { params: { status: 'confirmed' } }),
    ]).then(([s, r]) => {
      setSummary(s.data);
      setRecentRes(r.data.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const stats = [
    { icon: <BedDouble size={20} />, label: 'Available Rooms',     value: summary.available_rooms,     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <LogIn size={20} />,     label: "Today's Check-Ins",  value: summary.todays_checkins,     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    { icon: <LogOut size={20} />,    label: "Today's Check-Outs", value: summary.todays_checkouts,    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { icon: <Clock size={20} />,     label: 'Pending Approvals',  value: summary.pending_reservations, color: '#d4a843', bg: 'rgba(212,168,67,0.12)' },
  ];

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div className="page-content slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user.name || user.username} 👋</h1>
          <p className="page-subtitle">Reception Dashboard — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Upcoming check-ins */}
      <div className="card">
        <div className="card-title">🔔 Upcoming Confirmed Reservations</div>
        {recentRes.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No upcoming confirmed reservations.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Customer</th><th>Room</th><th>Check-In</th><th>Check-Out</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {recentRes.map((r) => (
                  <tr key={r.reservation_id}>
                    <td style={{ color: 'var(--color-text-muted)' }}>#{r.reservation_id}</td>
                    <td><strong>{r.customer_name}</strong></td>
                    <td>Room {r.room_number} ({r.room_type})</td>
                    <td>{fmt(r.check_in_date)}</td>
                    <td>{fmt(r.check_out_date)}</td>
                    <td style={{ color: 'var(--color-gold)', fontWeight: 600 }}>${Number(r.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
