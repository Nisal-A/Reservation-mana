import { useEffect, useState } from 'react';
import { BarChart2, Download, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../api/axios';
import { PageLoader, PageHeader } from '../../components/UI';

const COLORS = ['#d4a843', '#3b82f6', '#10b981', '#a78bfa', '#f59e0b'];

export default function Reports() {
  const [summary, setSummary]   = useState(null);
  const [revenue, setRevenue]   = useState([]);
  const [rooms, setRooms]       = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/reports/revenue'),
      api.get('/reports/rooms'),
      api.get('/reports/by-status'),
    ]).then(([s, r, rm, bs]) => {
      setSummary(s.data);
      setRevenue(r.data.map(d => ({ ...d, revenue: Number(d.revenue) })));
      setRooms(rm.data.map(d => ({ ...d, total_revenue: Number(d.total_revenue) })));
      setByStatus(bs.data);
    }).finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const headers = ['Room Number', 'Type', 'Price', 'Total Bookings', 'Total Revenue'];
    const rows = rooms.map((r) => [r.room_number, r.room_type, r.price, r.total_bookings, r.total_revenue]);
    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'room_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Hotel performance insights"
        action={
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: `$${Number(summary.total_revenue).toLocaleString()}`, color: '#d4a843' },
          { label: 'Total Bookings', value: summary.total_reservations, color: '#3b82f6' },
          { label: 'Occupancy Rate', value: `${summary.occupancy_rate}%`, color: '#10b981' },
          { label: 'Available Rooms', value: summary.available_rooms, color: '#a78bfa' },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue Trend */}
      <div className="chart-wrapper">
        <div className="chart-title">📈 Monthly Revenue Trend</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: '#8892a4', fontSize: 12 }} />
            <YAxis tick={{ fill: '#8892a4', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
            />
            <Line type="monotone" dataKey="revenue" stroke="#d4a843" strokeWidth={3} dot={{ fill: '#d4a843', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="chart-wrapper">
          <div className="chart-title">Reservations by Status</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={85}
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrapper">
          <div className="chart-title">Monthly Check-Outs Volume</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#8892a4', fontSize: 12 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
              <Bar dataKey="checkouts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Room Performance Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div className="chart-title" style={{ margin: 0 }}>🏨 Room Performance</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Price/Night</th>
                <th>Total Bookings</th>
                <th>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room_number}>
                  <td><strong>Room {r.room_number}</strong></td>
                  <td>{r.room_type}</td>
                  <td style={{ color: 'var(--color-gold)', fontWeight: 600 }}>${r.price}</td>
                  <td>{r.total_bookings}</td>
                  <td style={{ color: 'var(--color-gold)', fontWeight: 700 }}>${Number(r.total_revenue).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
