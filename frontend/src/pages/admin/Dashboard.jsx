/**
 * Dashboard.jsx — Enhanced Admin Analytics Dashboard
 * Uses /api/analytics/* endpoints for comprehensive KPIs and charts.
 */
import { useEffect, useState } from 'react';
import {
  BedDouble, CalendarCheck, DollarSign, Users,
  TrendingUp, LogIn, LogOut, Clock, Star, Percent
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../api/axios';
import { PageLoader, StatCard } from '../../components/UI';

const GOLD    = '#d4a843';
const COLORS  = ['#d4a843','#3b82f6','#10b981','#a78bfa','#f59e0b','#ef4444'];

const tooltipStyle = { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)' };

export default function AdminDashboard() {
  const [overview,   setOverview]   = useState(null);
  const [revenue,    setRevenue]    = useState([]);
  const [resMonthly, setResMonthly] = useState([]);
  const [occupancy,  setOccupancy]  = useState([]);
  const [roomTypes,  setRoomTypes]  = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [revByType,  setRevByType]  = useState([]);
  const [cancellation, setCancellation] = useState([]);
  const [avgStay,    setAvgStay]    = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/revenue-monthly'),
      api.get('/analytics/reservations-monthly'),
      api.get('/analytics/occupancy-rate'),
      api.get('/analytics/room-type-popularity'),
      api.get('/analytics/top-customers'),
      api.get('/analytics/revenue-by-room-type'),
      api.get('/analytics/cancellation-rate'),
      api.get('/analytics/avg-stay'),
    ]).then(([ov, rev, rm, occ, rt, tc, rbt, can, avg]) => {
      setOverview(ov.data);
      setRevenue(rev.data);
      setResMonthly(rm.data);
      setOccupancy(occ.data);
      setRoomTypes(rt.data);
      setTopCustomers(tc.data);
      setRevByType(rbt.data);
      setCancellation(can.data);
      setAvgStay(avg.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !overview) return <PageLoader />;

  const stats = [
    { icon: <DollarSign size={20}/>, label: 'Total Revenue',       value: `$${Number(overview.total_revenue).toLocaleString()}`,  color: GOLD,      bg: 'rgba(212,168,67,0.12)' },
    { icon: <DollarSign size={20}/>, label: "Today's Revenue",     value: `$${Number(overview.today_revenue).toLocaleString()}`,  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <DollarSign size={20}/>, label: 'Month Revenue',       value: `$${Number(overview.month_revenue).toLocaleString()}`,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
    { icon: <CalendarCheck size={20}/>, label: 'Total Reservations', value: overview.total_reservations,  color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
    { icon: <Users size={20}/>,      label: 'Active Guests',       value: overview.active_guests,        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <BedDouble size={20}/>,  label: 'Available Rooms',     value: overview.available_rooms,      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <BedDouble size={20}/>,  label: 'Occupied Rooms',      value: overview.occupied_rooms,       color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
    { icon: <Clock size={20}/>,      label: 'Pending Reservations', value: overview.pending_reservations, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { icon: <TrendingUp size={20}/>, label: 'Occupancy Rate',      value: `${overview.occupancy_rate}%`, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
    { icon: <Star size={20}/>,       label: 'Avg Guest Rating',    value: `${overview.avg_rating} ⭐`,   color: GOLD,      bg: 'rgba(212,168,67,0.12)' },
    { icon: <LogIn size={20}/>,      label: "Today's Check-Ins",   value: overview.today_checkins,       color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { icon: <LogOut size={20}/>,     label: "Today's Check-Outs",  value: overview.today_checkouts,      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ];

  return (
    <div className="page-content slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="page-subtitle">Real-time hotel performance overview</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Revenue + Reservations */}
      <div className="analytics-grid-2">
        <div className="chart-wrapper">
          <div className="chart-title">📈 Revenue Trend (12 months)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={3} fill="url(#goldGrad)" dot={{ fill: GOLD, r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrapper">
          <div className="chart-title">📊 Monthly Reservations</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={resMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="total"     name="Total"     fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Occupancy + Room Types */}
      <div className="analytics-grid-2">
        <div className="chart-wrapper">
          <div className="chart-title">🏨 Occupancy Rate (30 days)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={occupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <YAxis domain={[0,100]} unit="%" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Occupancy']} />
              <Line type="monotone" dataKey="occupancy_rate" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrapper">
          <div className="chart-title">🛏️ Room Type Popularity</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={roomTypes} dataKey="bookings" nameKey="room_type" cx="50%" cy="50%" outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {roomTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cancellation Rate + Avg Stay */}
      <div className="analytics-grid-2">
        <div className="chart-wrapper">
          <div className="chart-title">❌ Cancellation Rate (%)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cancellation}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis unit="%" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Cancellation Rate']} />
              <Line type="monotone" dataKey="cancellation_rate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrapper">
          <div className="chart-title">⏱️ Average Stay Duration (nights)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgStay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} nights`, 'Avg Stay']} />
              <Bar dataKey="avg_nights" fill="#a78bfa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue by Room Type + Top Customers */}
      <div className="analytics-grid-2">
        <div className="chart-wrapper">
          <div className="chart-title">💰 Revenue by Room Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis dataKey="room_type" type="category" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill={GOLD} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Customers Table */}
        <div className="chart-wrapper">
          <div className="chart-title">🏆 Top Customers</div>
          <div className="table-wrapper" style={{ maxHeight: 200, overflow: 'auto' }}>
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr><th>#</th><th>Customer</th><th>Bookings</th><th>Total Spend</th></tr>
              </thead>
              <tbody>
                {topCustomers.slice(0, 8).map((c, i) => (
                  <tr key={c.email}>
                    <td style={{ color: 'var(--color-gold)', fontWeight: 700 }}>#{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{c.email}</div>
                    </td>
                    <td>{c.bookings}</td>
                    <td style={{ color: 'var(--color-gold)', fontWeight: 700 }}>${Number(c.total_spend).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
