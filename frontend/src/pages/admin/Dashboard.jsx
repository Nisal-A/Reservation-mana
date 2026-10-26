// frontend/src/pages/admin/Dashboard.jsx
// Enterprise Admin Analytics Dashboard
// Uses /api/reports/* endpoints only. Zero browser calculation of business metrics.
// 8 KPI StatCards with deltas, info tooltips, and click drill-downs.
// Recharts with gold primary series and muted dashed comparison series.
// Two compact tables (top rooms & largest outstanding balances with ReservationDetailPanel).
// Footer line with generated_at timestamp.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  Wallet,
  BedDouble,
  Percent,
  CalendarCheck,
  AlertTriangle,
  Scale,
  CreditCard,
  Building,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { formatLKR, formatDate, getDefaultRange } from '../../utils/format';
import {
  PageHeader,
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
  ReservationDetailPanel,
  ExportMenu,
} from '../../components/UI';
import ReportFilters from './reports/ReportFilters';

const GOLD = '#C8A96A';
const MUTED = '#888888';
const SUCCESS = '#34d399';
const DANGER = '#f87171';
const INFO_COLOR = '#60a5fa';

const CHART_COLORS = ['#C8A96A', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f87171'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Extract filters from URL
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const from = searchParams.get('from') || defaultRange.from;
  const to = searchParams.get('to') || defaultRange.to;
  const compare = searchParams.get('compare') || 'none';
  const room_type = searchParams.get('room_type') || '';
  const source = searchParams.get('source') || '';

  // Data State
  const [overviewRes, setOverviewRes] = useState(null);
  const [revenueTrendRes, setRevenueTrendRes] = useState(null);
  const [occupancyTrendRes, setOccupancyTrendRes] = useState(null);
  const [roomPerfRes, setRoomPerfRes] = useState(null);
  const [operationsRes, setOperationsRes] = useState(null);
  const [definitions, setDefinitions] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reservation detail drawer
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);

  // Fetch Definitions once
  useEffect(() => {
    let mounted = true;
    api
      .get('/reports/definitions')
      .then((res) => {
        if (mounted) {
          setDefinitions(res.data?.data || res.data?.definitions || {});
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch all dashboard data from 5.2 reports endpoints
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { from, to };
      if (compare && compare !== 'none') params.compare = compare;
      if (room_type) params.room_type = room_type;
      if (source) params.source = source;

      const [ov, rev, occ, rPerf, ops] = await Promise.all([
        api.get('/reports/overview', { params }),
        api.get('/reports/revenue-trend', { params }),
        api.get('/reports/occupancy-trend', { params }),
        api.get('/reports/room-performance', { params }),
        api.get('/reports/operations', { params: { room_type, source } }),
      ]);

      setOverviewRes(ov.data);
      setRevenueTrendRes(rev.data);
      setOccupancyTrendRes(occ.data);
      setRoomPerfRes(rPerf.data);
      setOperationsRes(ops.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard metrics');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [from, to, compare, room_type, source]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Render Delta Pill
  const renderDelta = (deltaPct, reverse = false) => {
    if (compare === 'none' || deltaPct === undefined || deltaPct === null) return null;

    const isZero = deltaPct === 0;
    const isPositive = deltaPct > 0;
    // For normal: positive is good (green), negative is bad (red)
    // For reverse (cancellation, outstanding): positive is bad (red), negative is good (green)
    const isGood = reverse ? !isPositive : isPositive;
    const color = isZero ? 'var(--muted)' : isGood ? SUCCESS : DANGER;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.75rem',
          fontWeight: 600,
          color,
          marginTop: 6,
        }}
      >
        {!isZero && <Icon size={13} />}
        <span>
          {isPositive ? '+' : ''}
          {deltaPct}% vs {compare === 'previous_year' ? 'prev year' : 'prev period'}
        </span>
      </div>
    );
  };

  const overview = overviewRes?.data || {};
  const hasCompare = Boolean(overviewRes?.previous);

  // Top 5 rooms by revenue
  const topRooms = useMemo(() => {
    const list = roomPerfRes?.data?.rooms || [];
    return [...list].sort((a, b) => b.room_revenue - a.room_revenue).slice(0, 5);
  }, [roomPerfRes]);

  // Largest outstanding balances
  const largestBalances = useMemo(() => {
    const list = operationsRes?.data?.unpaid_bills || [];
    return [...list].slice(0, 5);
  }, [operationsRes]);

  // Chart 1: Revenue trend data
  const revenueChartData = useMemo(() => {
    const curSeries = revenueTrendRes?.data || [];
    const prevSeries = revenueTrendRes?.previous || [];
    return curSeries.map((item, idx) => ({
      label: item.label,
      room_revenue: item.room_revenue,
      cash_collected: item.cash_collected,
      prev_room_revenue: prevSeries[idx]?.room_revenue ?? null,
      prev_cash_collected: prevSeries[idx]?.cash_collected ?? null,
    }));
  }, [revenueTrendRes]);

  // Chart 2: Occupancy trend data
  const occupancyChartData = useMemo(() => {
    const curSeries = occupancyTrendRes?.data || [];
    const prevSeries = occupancyTrendRes?.previous || [];
    return curSeries.map((item, idx) => ({
      date: item.date.slice(5), // 'MM-DD'
      occupancy_pct: item.occupancy_pct,
      sold_nights: item.sold_nights,
      prev_occupancy_pct: prevSeries[idx]?.occupancy_pct ?? null,
    }));
  }, [occupancyTrendRes]);

  // Chart 3: Reservations by Status
  const reservationsStatusData = useMemo(() => {
    const byStatus = overviewRes?.data?.reservations_created?.by_status || {};
    return Object.entries(byStatus).map(([status, count]) => ({
      status: status.replace(/_/g, ' '),
      count,
    }));
  }, [overviewRes]);

  // Chart 4: Room revenue by room type
  const revByRoomTypeData = useMemo(() => {
    const types = roomPerfRes?.data?.room_types || [];
    return types.map((t) => ({
      room_type: t.room_type,
      revenue: t.room_revenue,
    }));
  }, [roomPerfRes]);

  // Chart 5: Payments by method
  const paymentsMethodData = useMemo(() => {
    const pBreakdown = overviewRes?.data?.payment_method_breakdown || {};
    return Object.entries(pBreakdown).map(([method, amount]) => ({
      method: method.replace(/_/g, ' '),
      amount,
    }));
  }, [overviewRes]);

  return (
    <div className="page-content slide-up">
      {/* Print-only Header */}
      <div className="print-only-header">
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#000', margin: 0 }}>
          LuxeStay Hotel — Executive Dashboard
        </h1>
        <div style={{ fontSize: '0.9rem', color: '#444', marginTop: 4 }}>
          Period: <strong>{formatDate(from)}</strong> to <strong>{formatDate(to)}</strong> · Filters:{' '}
          {room_type || 'All Rooms'}, {source || 'All Sources'} · Compare: {compare}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>
          Generated: {overviewRes?.generated_at || new Date().toISOString()} (Asia/Colombo)
        </div>
      </div>

      <PageHeader
        title="Hotel Overview"
        subtitle="Real-time performance indicators, revenue streams, and frontdesk operations"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ExportMenu
              report="overview"
              filters={{ from, to, compare, room_type, source }}
              buttonText="Export Overview"
            />
            <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
        }
      />

      {/* Shared Filter Bar */}
      <ReportFilters />

      {error ? (
        <ErrorState
          title="Could not load dashboard metrics"
          message={error}
          onRetry={fetchDashboardData}
        />
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────
              EIGHT KPI STATCARDS
             ───────────────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 28,
            }}
          >
            {/* 1. Room Revenue */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reports?tab=revenue&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                )
              }
              title="Click to view full Revenue report"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Room Revenue
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.room_revenue}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(200, 169, 106, 0.12)', color: GOLD }}>
                    <DollarSign size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: GOLD, marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="120px" /> : formatLKR(overview.room_revenue)}
              </div>
              {!loading && renderDelta(overview.room_revenue_delta_pct, false)}
            </div>

            {/* 2. Cash Collected */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reports?tab=revenue&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                )
              }
              title="Click to view full Revenue report"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Cash Collected
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.cash_collected}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(52, 211, 153, 0.12)', color: SUCCESS }}>
                    <Wallet size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="120px" /> : formatLKR(overview.cash_collected)}
              </div>
              {!loading && renderDelta(overview.cash_collected_delta_pct, false)}
            </div>

            {/* 3. Occupancy */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reports?tab=occupancy&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                )
              }
              title="Click to view Occupancy and Rooms report"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Occupancy
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.occupancy_pct}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(96, 165, 250, 0.12)', color: INFO_COLOR }}>
                    <Percent size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="90px" /> : `${overview.occupancy_pct || 0}%`}
              </div>
              {!loading && renderDelta(overview.occupancy_pct_delta_pct, false)}
            </div>

            {/* 4. ADR */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reports?tab=occupancy&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                )
              }
              title="Click to view Occupancy and Rooms report"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  ADR
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.adr}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(200, 169, 106, 0.12)', color: GOLD }}>
                    <Scale size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="110px" /> : formatLKR(overview.adr)}
              </div>
              {!loading && renderDelta(overview.adr_delta_pct, false)}
            </div>

            {/* 5. RevPAR */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reports?tab=occupancy&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                )
              }
              title="Click to view Occupancy and Rooms report"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  RevPAR
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.revpar}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(200, 169, 106, 0.12)', color: GOLD }}>
                    <BedDouble size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="110px" /> : formatLKR(overview.revpar)}
              </div>
              {!loading && renderDelta(overview.revpar_delta_pct, false)}
            </div>

            {/* 6. Reservations */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reservations?source=${source || ''}`
                )
              }
              title="Click to view all matching reservations"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Reservations
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.reservations_created}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(96, 165, 250, 0.12)', color: INFO_COLOR }}>
                    <CalendarCheck size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="80px" /> : overview.reservations_created?.total || 0}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
                Created in period
              </div>
            </div>

            {/* 7. Cancellation Rate (Increase is bad) */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() => navigate('/admin/reservations?status=cancelled')}
              title="Click to view cancelled reservations"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Cancellation Rate
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.cancellation_rate_pct}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(248, 113, 113, 0.12)', color: DANGER }}>
                    <AlertTriangle size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="90px" /> : `${overview.cancellation_rate_pct || 0}%`}
              </div>
              {!loading && renderDelta(overview.cancellation_rate_pct_delta_pct, true)}
            </div>

            {/* 8. Outstanding Balance (Increase is bad) */}
            <div
              className="card stat-card-ui is-clickable"
              onClick={() =>
                navigate(
                  `/admin/reports?tab=operations&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                )
              }
              title="Click to view Operations unpaid bills"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Outstanding Balance
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="kpi-info-wrapper" onClick={(e) => e.stopPropagation()}>
                    <Info size={14} style={{ color: 'var(--muted)', cursor: 'help' }} />
                    <div className="kpi-tooltip">{definitions.outstanding_balance}</div>
                  </div>
                  <div style={{ padding: 6, borderRadius: 4, background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>
                    <Clock size={16} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: overview.outstanding_balance > 0 ? DANGER : 'var(--text)', marginTop: 8 }}>
                {loading ? <Skeleton height="32px" width="120px" /> : formatLKR(overview.outstanding_balance)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
                Uncollected active balance
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RECHARTS VISUALIZATIONS
             ───────────────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: 20,
              marginBottom: 28,
            }}
          >
            {/* Chart 1: Revenue Trend */}
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: 4 }}>
                Revenue & Cash Trend
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16 }}>
                Room revenue earned across sold nights compared to actual net cash collected during the period.
              </div>
              <div style={{ height: 260, width: '100%', minWidth: 0 }}>
                {loading ? (
                  <Skeleton height="100%" width="100%" />
                ) : revenueChartData.length === 0 ? (
                  <EmptyState title="No trend data" message="No transactions recorded in this range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} />
                      <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                        formatter={(val) => [formatLKR(val)]}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
                      <Line type="monotone" dataKey="room_revenue" name="Earned Revenue" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="cash_collected" name="Cash Collected" stroke={SUCCESS} strokeWidth={2} dot={{ r: 3 }} />
                      {hasCompare && (
                        <Line
                          type="monotone"
                          dataKey="prev_room_revenue"
                          name="Prev Earned Rev"
                          stroke={MUTED}
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Occupancy Trend */}
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: 4 }}>
                Daily Occupancy Rate
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16 }}>
                Daily room occupancy percentage based on occupied rooms versus total available rooms.
              </div>
              <div style={{ height: 260, width: '100%', minWidth: 0 }}>
                {loading ? (
                  <Skeleton height="100%" width="100%" />
                ) : occupancyChartData.length === 0 ? (
                  <EmptyState title="No occupancy data" message="No occupancy activity recorded." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={occupancyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} />
                      <YAxis stroke="var(--muted)" fontSize={11} domain={[0, 100]} unit="%" />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                        formatter={(val) => [`${val}%`, 'Occupancy']}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
                      <Line type="monotone" dataKey="occupancy_pct" name="Occupancy %" stroke={INFO_COLOR} strokeWidth={2.5} dot={{ r: 3 }} />
                      {hasCompare && (
                        <Line
                          type="monotone"
                          dataKey="prev_occupancy_pct"
                          name="Prev Occupancy %"
                          stroke={MUTED}
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 3: Reservations by Status */}
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: 4 }}>
                Reservations by Status
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16 }}>
                Breakdown of all reservations created in the selected date range by current booking status.
              </div>
              <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                {loading ? (
                  <Skeleton height="100%" width="100%" />
                ) : reservationsStatusData.length === 0 ? (
                  <EmptyState title="No reservations" message="No bookings created in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reservationsStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="status" stroke="var(--muted)" fontSize={11} />
                      <YAxis stroke="var(--muted)" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
                      <Bar dataKey="count" name="Bookings" fill={GOLD} radius={[4, 4, 0, 0]}>
                        {reservationsStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 4: Room Revenue by Room Type */}
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: 4 }}>
                Room Revenue by Room Type
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16 }}>
                Total earned room revenue segmented by room category across all occupied nights.
              </div>
              <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                {loading ? (
                  <Skeleton height="100%" width="100%" />
                ) : revByRoomTypeData.length === 0 ? (
                  <EmptyState title="No revenue data" message="No room revenue generated." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revByRoomTypeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="room_type" stroke="var(--muted)" fontSize={11} />
                      <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                        formatter={(val) => [formatLKR(val), 'Revenue']}
                      />
                      <Bar dataKey="revenue" name="Revenue (LKR)" fill={GOLD} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 5: Payments by Method */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gridColumn: '1 / -1',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: 4 }}>
                Payments Collected by Settlement Method
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16 }}>
                Share of net cash collected across different settlement payment methods during the period.
              </div>
              <div style={{ height: 220, width: '100%', minWidth: 0 }}>
                {loading ? (
                  <Skeleton height="100%" width="100%" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentsMethodData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" stroke="var(--muted)" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                      <YAxis dataKey="method" type="category" stroke="var(--muted)" fontSize={12} width={100} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                        formatter={(val) => [formatLKR(val), 'Amount']}
                      />
                      <Bar dataKey="amount" fill={GOLD} radius={[0, 4, 4, 0]}>
                        {paymentsMethodData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TWO COMPACT TABLES
             ───────────────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: 20,
              marginBottom: 32,
            }}
          >
            {/* Table 1: Top 5 Rooms by Revenue */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building size={16} style={{ color: GOLD }} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Top 5 Rooms by Revenue</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    navigate(
                      `/admin/reports?tab=occupancy&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                    )
                  }
                  style={{ fontSize: '0.8rem', color: GOLD }}
                >
                  View all rooms <ArrowRight size={13} style={{ marginLeft: 4 }} />
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>ROOM</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>TYPE</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>NIGHTS</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>OCCUPANCY</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>REVENUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px' }}><Skeleton height="18px" width="60px" /></td>
                          <td style={{ padding: '12px 12px' }}><Skeleton height="18px" width="80px" /></td>
                          <td style={{ padding: '12px 12px' }}><Skeleton height="18px" width="40px" style={{ marginLeft: 'auto' }} /></td>
                          <td style={{ padding: '12px 12px' }}><Skeleton height="18px" width="50px" style={{ marginLeft: 'auto' }} /></td>
                          <td style={{ padding: '12px 16px' }}><Skeleton height="18px" width="80px" style={{ marginLeft: 'auto' }} /></td>
                        </tr>
                      ))
                    ) : topRooms.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                          No room performance data available for this range.
                        </td>
                      </tr>
                    ) : (
                      topRooms.map((rm) => (
                        <tr key={rm.room_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: GOLD }}>
                            Room {rm.room_number}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: '0.85rem', color: 'var(--text-body)' }}>
                            {rm.room_type}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '0.85rem' }}>
                            {rm.sold_nights}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '0.85rem' }}>
                            {rm.occupancy_pct}%
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                            {formatLKR(rm.room_revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Largest Outstanding Balances */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} style={{ color: DANGER }} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Largest Outstanding Balances</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    navigate(
                      `/admin/reports?tab=operations&from=${from}&to=${to}&compare=${compare}&room_type=${room_type}&source=${source}`
                    )
                  }
                  style={{ fontSize: '0.8rem', color: GOLD }}
                >
                  View all bills <ArrowRight size={13} style={{ marginLeft: 4 }} />
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>BOOKING REF</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>GUEST</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>ROOM</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px' }}><Skeleton height="18px" width="80px" /></td>
                          <td style={{ padding: '12px 12px' }}><Skeleton height="18px" width="100px" /></td>
                          <td style={{ padding: '12px 12px' }}><Skeleton height="18px" width="60px" /></td>
                          <td style={{ padding: '12px 16px' }}><Skeleton height="18px" width="90px" style={{ marginLeft: 'auto' }} /></td>
                        </tr>
                      ))
                    ) : largestBalances.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: SUCCESS, fontSize: '0.85rem' }}>
                          ✓ No outstanding balances. All guest folios are fully settled.
                        </td>
                      </tr>
                    ) : (
                      largestBalances.map((item) => (
                        <tr
                          key={item.reservation_id}
                          className="is-clickable"
                          onClick={() => setSelectedBookingRef(item.booking_ref)}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          title="Click to open Reservation Details"
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: GOLD, fontFamily: 'monospace' }}>
                            {item.booking_ref}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: '0.85rem' }}>
                            {item.guest_name}
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: '0.85rem', color: 'var(--text-body)' }}>
                            Room {item.room_number}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: DANGER }}>
                            {formatLKR(item.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Line with Timestamp */}
          <div
            style={{
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: 'var(--muted)',
            }}
          >
            <span>
              Generated at {overviewRes?.generated_at ? overviewRes.generated_at.replace('T', ' ').slice(0, 19) : 'recently'} (Asia/Colombo)
            </span>
            <span>All monetary figures presented in Sri Lankan Rupees (LKR)</span>
          </div>
        </>
      )}

      {/* Reservation Details Drawer */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
        onActionComplete={() => {
          setSelectedBookingRef(null);
          fetchDashboardData();
        }}
      />
    </div>
  );
}
