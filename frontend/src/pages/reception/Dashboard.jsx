import { useEffect, useState } from 'react';
import { BedDouble, LogIn, LogOut, Clock, Bell } from 'lucide-react';
import api from '../../api/axios';
import { PageLoader, StatCard } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatLKR, todayISO } from '../../utils/format';

export default function ReceptionDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentRes, setRecentRes] = useState([]);

  useEffect(() => {
    const today = todayISO();
    Promise.allSettled([
      api.get('/rooms'),
      api.get('/reservations', { params: { limit: 100 } }),
    ]).then(([roomsRes, resRes]) => {
      const rooms = roomsRes.status === 'fulfilled' ? (Array.isArray(roomsRes.value.data) ? roomsRes.value.data : roomsRes.value.data?.data || []) : [];
      const resPayload = resRes.status === 'fulfilled' ? resRes.value.data : {};
      const allReservations = Array.isArray(resPayload) ? resPayload : (resPayload.data || []);

      const availableRooms = rooms.filter((r) => r.status === 'available').length;
      const todaysCheckins = allReservations.filter((r) => r.check_in_date === today && (r.status === 'confirmed' || r.status === 'checked_in')).length;
      const todaysCheckouts = allReservations.filter((r) => r.check_out_date === today && r.status === 'checked_in').length;
      const pendingReservations = allReservations.filter((r) => r.status === 'pending').length;
      const confirmedUpcoming = allReservations.filter((r) => r.status === 'confirmed').slice(0, 5);

      setSummary({
        available_rooms: availableRooms,
        todays_checkins: todaysCheckins,
        todays_checkouts: todaysCheckouts,
        pending_reservations: pendingReservations,
      });
      setRecentRes(confirmedUpcoming);
    }).catch(() => {
      setSummary({ available_rooms: 0, todays_checkins: 0, todays_checkouts: 0, pending_reservations: 0 });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const stats = [
    { icon: <BedDouble size={20} />, label: 'Available Rooms',     value: summary?.available_rooms ?? 0,     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <LogIn size={20} />,     label: "Today's Check-Ins",  value: summary?.todays_checkins ?? 0,     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    { icon: <LogOut size={20} />,    label: "Today's Check-Outs", value: summary?.todays_checkouts ?? 0,    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { icon: <Clock size={20} />,     label: 'Pending Approvals',  value: summary?.pending_reservations ?? 0, color: '#d4a843', bg: 'rgba(212,168,67,0.12)' },
  ];

  return (
    <div className="page-content slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user.name || user.username}</h1>
          <p className="page-subtitle">Reception Dashboard — {formatDate(todayISO())}</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Upcoming check-ins */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} /> Upcoming Confirmed Reservations
        </div>
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
                    <td>{formatDate(r.check_in_date)}</td>
                    <td>{formatDate(r.check_out_date)}</td>
                    <td style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{formatLKR(r.total_amount)}</td>
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
