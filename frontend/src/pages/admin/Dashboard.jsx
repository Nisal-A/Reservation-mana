import { useEffect, useState } from 'react';
import { BedDouble, CalendarCheck, DollarSign, Users, TrendingUp, LogIn, LogOut, Clock } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../api/axios';
import { PageLoader, StatCard } from '../../components/UI';

const GOLD = '#d4a843';
const COLORS = ['#d4a843', '#3b82f6', '#10b981', '#a78bfa', '#f59e0b'];

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/reports/revenue'),
      api.get('/reports/room-types'),
      api.get('/reports/by-status'),
    ]).then(([s, r, rt, bs]) => {
      setSummary(s.data);
      setRevenue(r.data.map(d => ({ ...d, revenue: Number(d.revenue) })));
      setRoomTypes(rt.data);
      setByStatus(bs.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const stats = [
    { icon: <BedDouble size={20} />, label: 'Total Rooms',        value: summary.total_rooms,         color: GOLD,         bg: 'rgba(212,168,67,0.12)' },
    { icon: <TrendingUp size={20} />, label: 'Occupancy Rate',    value: `${summary.occupancy_rate}%`, color: '#3b82f6',    bg: 'rgba(59,130,246,0.12)' },
    { icon: <CalendarCheck size={20} />, label: 'Total Reservations', value: summary.total_reservations, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <DollarSign size={20} />, label: 'Total Revenue',     value: `$${Number(summary.total_revenue).toLocaleString()}`, color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
    { icon: <LogIn size={20} />,  label: "Today's Check-Ins",    value: summary.todays_checkins,      color: '#10b981',    bg: 'rgba(16,185,129,0.12)' },
    { icon: <LogOut size={20} />, label: "Today's Check-Outs",   value: summary.todays_checkouts,     color: '#f59e0b',    bg: 'rgba(245,158,11,0.12)' },
    { icon: <Clock size={20} />,  label: 'Pending Reservations', value: summary.pending_reservations, color: '#f59e0b',    bg: 'rgba(245,158,11,0.12)' },
    { icon: <Users size={20} />,  label: 'Available Rooms',      value: summary.available_rooms,      color: '#10b981',    bg: 'rgba(16,185,129,0.12)' },
  ];

  return (
    <div className="page-content slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of hotel operations and performance</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Revenue Chart */}
        <div className="chart-wrapper">
          <div className="chart-title">Monthly Revenue (Last 6 Months)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#8892a4', fontSize: 12 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reservation Status Pie */}
        <div className="chart-wrapper">
          <div className="chart-title">Reservations by Status</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={byStatus} dataKey="count" nameKey="status"
                cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={false}
              >
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Room Types Chart */}
      <div className="chart-wrapper">
        <div className="chart-title">Revenue by Room Type</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={roomTypes} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 12 }} />
            <YAxis dataKey="room_type" type="category" tick={{ fill: '#8892a4', fontSize: 12 }} width={70} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
            />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
