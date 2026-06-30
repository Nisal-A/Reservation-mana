import { useEffect, useState } from 'react';
import { BarChart2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../api/axios';
import { PageLoader, PageHeader } from '../../components/UI';
import toast from 'react-hot-toast';

const COLORS = ['#d4a843', '#3b82f6', '#10b981', '#a78bfa', '#f59e0b'];

async function downloadReport(endpoint, format, filename) {
  try {
    const resp = await api.get(`/export/${endpoint}?format=${format}`, { responseType: 'blob' });
    const ext  = format === 'excel' ? 'xlsx' : format;
    const url  = URL.createObjectURL(resp.data);
    const a    = document.createElement('a'); a.href = url; a.download = `${filename}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  } catch { toast.error('Export failed'); }
}


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

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Hotel performance insights"
        action={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>EXPORT RESERVATIONS</div>
            <div className="export-btn-row">
              <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('reservations','csv','reservations')}><Download size={13}/> CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('reservations','excel','reservations')}><FileSpreadsheet size={13}/> Excel</button>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('reservations','pdf','reservations')}><FileText size={13}/> PDF</button>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, marginTop: 4 }}>EXPORT ROOMS</div>
            <div className="export-btn-row">
              <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('rooms','csv','rooms')}><Download size={13}/> CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('rooms','excel','rooms')}><FileSpreadsheet size={13}/> Excel</button>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadReport('rooms','pdf','rooms')}><FileText size={13}/> PDF</button>
            </div>
          </div>
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
