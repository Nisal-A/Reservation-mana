// frontend/src/pages/admin/Reports.jsx
// Enterprise Admin Reports page
// Tabs: Revenue, Reservations, Occupancy and rooms, Customers, Operations.
// Area-specific KPI cards, Recharts visualizations, DataTables with server pagination and drill-downs.
// Definitions drawer, print stylesheet, skeletons, empty states, and error handling with retry.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Printer,
  DollarSign,
  Wallet,
  BedDouble,
  CalendarCheck,
  AlertTriangle,
  Scale,
  Users,
  CreditCard,
  Layers,
  Search,
  Building,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowUpDown,
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
import { siteContent } from '../../config/siteContent';
import { formatLKR, formatDate, getDefaultRange } from '../../utils/format';
import {
  PageHeader,
  Button,
  Modal,
  Skeleton,
  EmptyState,
  ErrorState,
  Pagination,
  ReservationDetailPanel,
} from '../../components/UI';
import ReportFilters from './reports/ReportFilters';

const GOLD = '#C8A96A';
const SUCCESS = '#34d399';
const DANGER = '#f87171';
const INFO_COLOR = '#60a5fa';

const CHART_COLORS = ['#C8A96A', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f87171'];

const TABS = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'occupancy', label: 'Occupancy & Rooms' },
  { id: 'customers', label: 'Customers' },
  { id: 'operations', label: 'Operations' },
];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const activeTab = searchParams.get('tab') || 'revenue';

  const setActiveTab = (tabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tabId);
        return next;
      },
      { replace: true }
    );
  };

  // Common parameters
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const from = searchParams.get('from') || defaultRange.from;
  const to = searchParams.get('to') || defaultRange.to;
  const compare = searchParams.get('compare') || 'none';
  const room_type = searchParams.get('room_type') || '';
  const source = searchParams.get('source') || '';

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [revenueTrendData, setRevenueTrendData] = useState(null);
  const [occupancyTrendData, setOccupancyTrendData] = useState(null);
  const [reservationsSummaryData, setReservationsSummaryData] = useState(null);
  const [roomPerfData, setRoomPerfData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [paymentsData, setPaymentsData] = useState(null);
  const [operationsData, setOperationsData] = useState(null);
  const [definitions, setDefinitions] = useState({});

  // Reservations drill-down table state
  const [resPage, setResPage] = useState(1);
  const [resStatusFilter, setResStatusFilter] = useState('');
  const [resPaymentFilter, setResPaymentFilter] = useState('');
  const [resSearch, setResSearch] = useState('');
  const [resSort, setResSort] = useState('created_at');
  const [resSortDir, setResSortDir] = useState('desc');
  const [reservationsDrilldown, setReservationsDrilldown] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // General Loading & Error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drawers & Modals
  const [showDefinitionsDrawer, setShowDefinitionsDrawer] = useState(false);
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);

  // Fetch Definitions
  useEffect(() => {
    let isMounted = true;
    api
      .get('/reports/definitions')
      .then((res) => {
        if (isMounted) {
          setDefinitions(res.data?.data || res.data?.definitions || {});
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Tab Data
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { from, to };
      if (compare && compare !== 'none') params.compare = compare;
      if (room_type) params.room_type = room_type;
      if (source) params.source = source;

      // Always fetch overview to power top cards and consistency
      const ovRes = await api.get('/reports/overview', { params });
      setOverviewData(ovRes.data);

      if (activeTab === 'revenue') {
        const [revRes, payRes, rPerfRes] = await Promise.all([
          api.get('/reports/revenue-trend', { params }),
          api.get('/reports/payments', { params }),
          api.get('/reports/room-performance', { params }),
        ]);
        setRevenueTrendData(revRes.data);
        setPaymentsData(payRes.data);
        setRoomPerfData(rPerfRes.data);
      } else if (activeTab === 'reservations') {
        const sumRes = await api.get('/reports/reservations-summary', { params });
        setReservationsSummaryData(sumRes.data);
      } else if (activeTab === 'occupancy') {
        const [occRes, rPerfRes] = await Promise.all([
          api.get('/reports/occupancy-trend', { params }),
          api.get('/reports/room-performance', { params }),
        ]);
        setOccupancyTrendData(occRes.data);
        setRoomPerfData(rPerfRes.data);
      } else if (activeTab === 'customers') {
        const custRes = await api.get('/reports/customers', { params });
        setCustomersData(custRes.data);
      } else if (activeTab === 'operations') {
        const opsRes = await api.get('/reports/operations', { params: { room_type, source } });
        setOperationsData(opsRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch report data');
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [from, to, compare, room_type, source, activeTab]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Fetch Reservations Drilldown table (when on Reservations tab)
  const fetchDrilldown = useCallback(async () => {
    if (activeTab !== 'reservations') return;
    setDrilldownLoading(true);
    try {
      const params = {
        from,
        to,
        page: resPage,
        limit: 20,
        sort: resSort,
        sort_dir: resSortDir,
      };
      if (resStatusFilter) params.status = resStatusFilter;
      if (resPaymentFilter) params.payment_status = resPaymentFilter;
      if (source) params.source = source;
      if (room_type) params.room_type = room_type;
      if (resSearch.trim()) params.q = resSearch.trim();

      const res = await api.get('/reports/reservations', { params });
      setReservationsDrilldown(res.data);
    } catch {
      toast.error('Failed to load reservations drill-down');
    } finally {
      setDrilldownLoading(false);
    }
  }, [activeTab, from, to, resPage, resStatusFilter, resPaymentFilter, source, room_type, resSearch, resSort, resSortDir]);

  useEffect(() => {
    fetchDrilldown();
  }, [fetchDrilldown]);

  // Handle column sort in reservations drilldown
  const handleSort = (field) => {
    if (resSort === field) {
      setResSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setResSort(field);
      setResSortDir('desc');
    }
    setResPage(1);
  };

  // Delta Helper
  const renderDelta = (deltaPct, reverse = false) => {
    if (compare === 'none' || deltaPct === undefined || deltaPct === null) return null;
    const isZero = deltaPct === 0;
    const isPositive = deltaPct > 0;
    const isGood = reverse ? !isPositive : isPositive;
    const color = isZero ? 'var(--muted)' : isGood ? SUCCESS : DANGER;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color, marginTop: 4 }}>
        {!isZero && <Icon size={12} />}
        <span>{isPositive ? '+' : ''}{deltaPct}% vs {compare === 'previous_year' ? 'prev year' : 'prev period'}</span>
      </div>
    );
  };

  const overview = overviewData?.data || {};

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content slide-up">
      {/* ─────────────────────────────────────────────────────────────
          PRINT-ONLY HEADER
         ───────────────────────────────────────────────────────────── */}
      <div className="print-only-header">
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', color: '#000', margin: 0 }}>
          {siteContent.hotelName || 'LuxeStay'} — Executive Report
        </h1>
        <div style={{ fontSize: '0.95rem', color: '#333', marginTop: 4 }}>
          Report Tab: <strong>{TABS.find((t) => t.id === activeTab)?.label}</strong> · Range: <strong>{formatDate(from)}</strong> to{' '}
          <strong>{formatDate(to)}</strong> ({overviewData?.range?.days || 30} days)
        </div>
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 2 }}>
          Filters: Room Type: {room_type || 'All'} | Booking Source: {source || 'All'} | Comparison:{' '}
          {compare === 'none' ? 'Off' : compare === 'previous_year' ? 'Previous Year' : 'Previous Period'}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
          Generated at: {overviewData?.generated_at || new Date().toISOString()} (Asia/Colombo)
        </div>
      </div>

      <PageHeader
        title="Reports & Analytics"
        subtitle="Performance analytics, guest trends, revenue auditing, and frontdesk operations"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button variant="outline" size="sm" onClick={() => setShowDefinitionsDrawer(true)}>
              <HelpCircle size={15} /> Definitions
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <Printer size={15} /> Print Report
            </Button>
          </div>
        }
      />

      {/* Shared Filter Bar */}
      <ReportFilters />

      {/* Tabs Navigation */}
      <div
        className="tabs-nav-bar"
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'transparent',
                color: isActive ? GOLD : 'var(--muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.92rem',
                borderBottom: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <ErrorState title="Report error" message={error} onRetry={fetchReportData} />
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────
              TAB 1: REVENUE
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'revenue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div className="card stat-card-ui">
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    <span>Room Revenue</span>
                    <DollarSign size={16} style={{ color: GOLD }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: GOLD, marginTop: 6 }}>
                    {loading ? <Skeleton height="32px" width="120px" /> : formatLKR(overview.room_revenue)}
                  </div>
                  {renderDelta(overview.room_revenue_delta_pct, false)}
                </div>

                <div className="card stat-card-ui">
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    <span>Cash Collected</span>
                    <Wallet size={16} style={{ color: SUCCESS }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 6 }}>
                    {loading ? <Skeleton height="32px" width="120px" /> : formatLKR(overview.cash_collected)}
                  </div>
                  {renderDelta(overview.cash_collected_delta_pct, false)}
                </div>

                <div className="card stat-card-ui">
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    <span>RevPAR</span>
                    <BedDouble size={16} style={{ color: GOLD }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 6 }}>
                    {loading ? <Skeleton height="32px" width="110px" /> : formatLKR(overview.revpar)}
                  </div>
                  {renderDelta(overview.revpar_delta_pct, false)}
                </div>

                <div className="card stat-card-ui">
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    <span>ADR</span>
                    <Scale size={16} style={{ color: GOLD }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 6 }}>
                    {loading ? <Skeleton height="32px" width="110px" /> : formatLKR(overview.adr)}
                  </div>
                  {renderDelta(overview.adr_delta_pct, false)}
                </div>
              </div>

              {/* Chart: Revenue & Cash Trend */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>Revenue & Cash Inflow Trend</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 16 }}>
                  Earned room revenue mapped by stay night against actual cash settlements received in the period.
                </div>
                <div style={{ height: 280, width: '100%', minWidth: 0 }}>
                  {loading ? (
                    <Skeleton height="100%" width="100%" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueTrendData?.data || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} />
                        <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                        <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} formatter={(val) => [formatLKR(val)]} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
                        <Line type="monotone" dataKey="room_revenue" name="Earned Revenue" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="cash_collected" name="Cash Collected" stroke={SUCCESS} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Tables: Payment Methods & Room Performance Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 20 }}>
                {/* Payment Methods */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CreditCard size={16} style={{ color: GOLD }} /> Settlement Method Breakdown
                    </div>
                    {paymentsData?.data && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400 }}>
                        Payments: <strong>{formatLKR(paymentsData.data.total_payments_amount)}</strong> | Refunds: <strong style={{ color: DANGER }}>{formatLKR(paymentsData.data.total_refunds_amount)}</strong>
                      </div>
                    )}
                  </div>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>METHOD</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>NET COLLECTED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(overview.payment_method_breakdown || {}).map(([m, amt]) => (
                        <tr key={m} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', textTransform: 'capitalize', fontWeight: 500 }}>{m.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatLKR(amt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Revenue by Room Type */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} style={{ color: GOLD }} /> Revenue by Room Type
                  </div>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>ROOM TYPE</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>SOLD</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>OCC %</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>REVENUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(roomPerfData?.data?.room_types || []).map((t) => (
                        <tr key={t.room_type} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{t.room_type}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>{t.sold_nights}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>{t.occupancy_pct}%</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatLKR(t.room_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: RESERVATIONS
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'reservations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Bookings Created</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: GOLD, marginTop: 4 }}>
                    {overview.reservations_created?.total || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Avg Lead Time</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {overview.avg_lead_time_days || 0} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>days</span>
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Avg Length of Stay</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {overview.avg_length_of_stay || 0} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>nights</span>
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Cancellation Rate</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: overview.cancellation_rate_pct > 0 ? DANGER : 'var(--text)', marginTop: 4 }}>
                    {overview.cancellation_rate_pct || 0}%
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>No-Shows</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {overview.no_show_count || 0}
                  </div>
                </div>
              </div>

              {/* Charts: Reservations by Status and Source */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>Bookings by Current Status</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 16 }}>
                    Distribution of all reservations created in the selected range.
                  </div>
                  <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                    {Object.keys(overview.reservations_created?.by_status || {}).length === 0 ? (
                      <EmptyState title="No data for this range" message="No reservations found." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(overview.reservations_created?.by_status || {}).map(([s, c]) => ({
                            status: s.replace(/_/g, ' '),
                            count: c,
                          }))}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="status" stroke="var(--muted)" fontSize={11} />
                          <YAxis stroke="var(--muted)" fontSize={11} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
                          <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]}>
                            {CHART_COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>Bookings by Booking Source</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 16 }}>
                    Reservations created across Online, Reception, and Admin channels.
                  </div>
                  <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                    {Object.keys(reservationsSummaryData?.data?.by_source || overview.reservations_created?.by_source || {}).length === 0 ? (
                      <EmptyState title="No data for this range" message="No channel bookings recorded." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(
                            reservationsSummaryData?.data?.by_source || overview.reservations_created?.by_source || {}
                          ).map(([srcKey, countVal]) => ({
                            source: typeof countVal === 'object' ? srcKey.toUpperCase() : srcKey.toUpperCase(),
                            count: typeof countVal === 'object' ? countVal.count : countVal,
                          }))}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="source" stroke="var(--muted)" fontSize={11} />
                          <YAxis stroke="var(--muted)" fontSize={11} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
                          <Bar dataKey="count" fill={INFO_COLOR} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Drill-down DataTable */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarCheck size={16} style={{ color: GOLD }} /> Reservations Drill-Down
                  </div>

                  {/* Filter tools for table */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 200 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Search ref, guest, room..."
                        value={resSearch}
                        onChange={(e) => {
                          setResSearch(e.target.value);
                          setResPage(1);
                        }}
                        style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32 }}
                      />
                    </div>

                    <select
                      className="select-field"
                      value={resStatusFilter}
                      onChange={(e) => {
                        setResStatusFilter(e.target.value);
                        setResPage(1);
                      }}
                      style={{ fontSize: '0.82rem', height: 32, padding: '4px 8px' }}
                    >
                      <option value="">All Statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="checked_in">Checked In</option>
                      <option value="checked_out">Checked Out</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                    </select>

                    <select
                      className="select-field"
                      value={resPaymentFilter}
                      onChange={(e) => {
                        setResPaymentFilter(e.target.value);
                        setResPage(1);
                      }}
                      style={{ fontSize: '0.82rem', height: 32, padding: '4px 8px' }}
                    >
                      <option value="">All Payments</option>
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>

                {/* Totals Summary Banner */}
                {reservationsDrilldown?.data?.totals && (
                  <div style={{ padding: '10px 20px', background: 'var(--input)', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: '0.82rem' }}>
                    <span>Total Matches: <strong>{reservationsDrilldown.data.totals.total_count}</strong></span>
                    <span>Total Amount: <strong>{formatLKR(reservationsDrilldown.data.totals.total_amount)}</strong></span>
                    <span>Net Paid: <strong>{formatLKR(reservationsDrilldown.data.totals.total_net_paid)}</strong></span>
                    <span style={{ color: reservationsDrilldown.data.totals.total_balance > 0 ? DANGER : SUCCESS }}>
                      Outstanding Balance: <strong>{formatLKR(reservationsDrilldown.data.totals.total_balance)}</strong>
                    </span>
                    <span>Total Nights: <strong>{reservationsDrilldown.data.totals.total_nights}</strong></span>
                  </div>
                )}

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th
                          onClick={() => handleSort('booking_ref')}
                          style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: resSort === 'booking_ref' ? GOLD : 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            BOOKING REF
                            <ArrowUpDown size={12} style={{ opacity: resSort === 'booking_ref' ? 1 : 0.4 }} />
                            {resSort === 'booking_ref' && (resSortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('guest_name')}
                          style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: resSort === 'guest_name' ? GOLD : 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            GUEST
                            <ArrowUpDown size={12} style={{ opacity: resSort === 'guest_name' ? 1 : 0.4 }} />
                            {resSort === 'guest_name' && (resSortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('room_number')}
                          style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: resSort === 'room_number' ? GOLD : 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ROOM
                            <ArrowUpDown size={12} style={{ opacity: resSort === 'room_number' ? 1 : 0.4 }} />
                            {resSort === 'room_number' && (resSortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('check_in_date')}
                          style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: resSort === 'check_in_date' ? GOLD : 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            DATES
                            <ArrowUpDown size={12} style={{ opacity: resSort === 'check_in_date' ? 1 : 0.4 }} />
                            {resSort === 'check_in_date' && (resSortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          STATUS
                        </th>
                        <th
                          onClick={() => handleSort('total_amount')}
                          style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: resSort === 'total_amount' ? GOLD : 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                            TOTAL
                            <ArrowUpDown size={12} style={{ opacity: resSort === 'total_amount' ? 1 : 0.4 }} />
                            {resSort === 'total_amount' && (resSortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          BALANCE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={7} style={{ padding: '12px 16px' }}><Skeleton height="20px" width="100%" /></td>
                          </tr>
                        ))
                      ) : (reservationsDrilldown?.data?.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center' }}>
                            <EmptyState
                              title="No data for this range"
                              message="No reservations found matching the selected filters."
                            />
                          </td>
                        </tr>
                      ) : (
                        (reservationsDrilldown?.data?.rows || []).map((r) => (
                          <tr
                            key={r.reservation_id}
                            className="is-clickable"
                            onClick={() => setSelectedBookingRef(r.booking_ref)}
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            title="Click to view reservation details"
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: GOLD, fontFamily: 'monospace' }}>
                              {r.booking_ref}
                            </td>
                            <td style={{ padding: '12px 12px' }}>
                              <div>{r.guest_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{r.guest_phone || r.guest_email}</div>
                            </td>
                            <td style={{ padding: '12px 12px', color: 'var(--text-body)' }}>
                              Room {r.room_number} ({r.room_type})
                            </td>
                            <td style={{ padding: '12px 12px', fontSize: '0.82rem' }}>
                              {formatDate(r.check_in_date)} to {formatDate(r.check_out_date)} ({r.nights}n)
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: 'var(--input)', textTransform: 'capitalize' }}>
                                {r.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {formatLKR(r.total_amount)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: r.balance > 0 ? DANGER : SUCCESS }}>
                              {formatLKR(r.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {reservationsDrilldown?.data?.pagination?.total_pages > 1 && (
                  <div style={{ padding: '12px 20px' }}>
                    <Pagination
                      currentPage={resPage}
                      totalPages={reservationsDrilldown.data.pagination.total_pages}
                      onPageChange={setResPage}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: OCCUPANCY & ROOMS
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'occupancy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Average Occupancy</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: GOLD, marginTop: 4 }}>
                    {overview.occupancy_pct || 0}%
                  </div>
                  {renderDelta(overview.occupancy_pct_delta_pct, false)}
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Sold Room Nights</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {overview.sold_room_nights || 0}
                  </div>
                  {renderDelta(overview.sold_room_nights_delta_pct, false)}
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Forecast Nights (Confirmed)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: INFO_COLOR, marginTop: 4 }}>
                    {overview.forecast_room_nights || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Available Capacity Nights</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {overview.available_room_nights || 0}
                  </div>
                </div>
              </div>

              {/* Chart: Daily Occupancy Trend */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>Daily Occupancy Trend</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 16 }}>
                  Daily room nights sold vs. capacity across the period.
                </div>
                <div style={{ height: 260, width: '100%', minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={occupancyTrendData?.data || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                      <YAxis stroke="var(--muted)" fontSize={11} domain={[0, 100]} unit="%" />
                      <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} formatter={(v) => [`${v}%`, 'Occupancy']} />
                      <Line type="monotone" dataKey="occupancy_pct" name="Occupancy %" stroke={INFO_COLOR} strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* DataTable: Room Performance & Underperforming flag */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building size={16} style={{ color: GOLD }} /> Room Inventory Performance
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Hotel Avg Occupancy: <strong>{roomPerfData?.data?.hotel_average_occupancy_pct || 0}%</strong> (Underperforming threshold: &lt; {roomPerfData?.data?.underperforming_threshold_pct || 0}%)
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>ROOM</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>TYPE</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>STATUS</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>SOLD</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>OCCUPANCY</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>ADR</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>REVENUE</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)' }}>FLAG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(roomPerfData?.data?.rooms || []).map((rm) => (
                        <tr
                          key={rm.room_id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: rm.underperforming ? 'rgba(251, 191, 36, 0.05)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: GOLD }}>Room {rm.room_number}</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.85rem' }}>{rm.room_type}</td>
                          <td style={{ padding: '12px 12px', textTransform: 'capitalize', fontSize: '0.8rem' }}>{rm.status}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>{rm.sold_nights}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600 }}>{rm.occupancy_pct}%</td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>{formatLKR(rm.adr)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatLKR(rm.room_revenue)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {rm.underperforming ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: 'rgba(251, 191, 36, 0.15)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(251, 191, 36, 0.3)',
                                  fontWeight: 600,
                                }}
                              >
                                <AlertTriangle size={12} /> Underperforming
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Normal</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: CUSTOMERS
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'customers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Active Guests</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: GOLD, marginTop: 4 }}>
                    {customersData?.data?.total_active_customers || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>New Guests</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: SUCCESS, marginTop: 4 }}>
                    {customersData?.data?.new_customers_count || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Returning Guests</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: INFO_COLOR, marginTop: 4 }}>
                    {customersData?.data?.returning_customers_count || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Repeat Rate</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {customersData?.data?.repeat_rate_pct || 0}%
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Avg Booking Value</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {formatLKR(customersData?.data?.avg_booking_value)}
                  </div>
                </div>
              </div>

              {/* Chart: Top Room Types by bookings */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>Room Type Preferences</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 16 }}>
                  Total bookings per room type among guests during the period.
                </div>
                <div style={{ height: 220, width: '100%', minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customersData?.data?.top_room_types || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="room_type" stroke="var(--muted)" fontSize={11} />
                      <YAxis stroke="var(--muted)" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
                      <Bar dataKey="bookings" fill={GOLD} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* DataTable: Top Customers Drilldown */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: GOLD }} /> Guest Drill-Down (Top Guests by Spend)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>GUEST NAME</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>EMAIL</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>PHONE</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)' }}>STATUS</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>STAYS</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>TOTAL SPENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customersData?.data?.top_customers || []).map((c) => (
                        <tr key={c.customer_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.85rem', color: 'var(--text-body)' }}>{c.email}</td>
                          <td style={{ padding: '12px 12px', fontSize: '0.85rem' }}>{c.phone || '—'}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: c.is_new ? 'rgba(52, 211, 153, 0.15)' : 'rgba(96, 165, 250, 0.15)', color: c.is_new ? SUCCESS : INFO_COLOR }}>
                              {c.is_new ? 'New Guest' : 'Returning'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>{c.reservations_count}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: GOLD }}>{formatLKR(c.total_spent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 5: OPERATIONS
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'operations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top Operational Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Arrivals Today</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: GOLD, marginTop: 4 }}>
                    {operationsData?.data?.arrivals_today_count || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Departures Today</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text)', marginTop: 4 }}>
                    {operationsData?.data?.departures_today_count || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>In-House Guests</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: INFO_COLOR, marginTop: 4 }}>
                    {operationsData?.data?.in_house_count || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Unpaid Folios</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: (operationsData?.data?.unpaid_bills_count || 0) > 0 ? DANGER : SUCCESS, marginTop: 4 }}>
                    {operationsData?.data?.unpaid_bills_count || 0}
                  </div>
                </div>

                <div className="card stat-card-ui">
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Payment Discrepancies</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: (operationsData?.data?.reconciliation_discrepancies_count || 0) > 0 ? DANGER : SUCCESS, marginTop: 4 }}>
                    {operationsData?.data?.reconciliation_discrepancies_count || 0}
                  </div>
                </div>
              </div>

              {/* Unpaid Bills Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} style={{ color: DANGER }} /> Unpaid Guest Folios with Outstanding Balance
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>BOOKING REF</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>GUEST</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>ROOM</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>STATUS</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>TOTAL</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>PAID</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>BALANCE DUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(operationsData?.data?.unpaid_bills || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: SUCCESS }}>
                            ✓ All guest bills are fully settled! Zero unpaid balance.
                          </td>
                        </tr>
                      ) : (
                        (operationsData?.data?.unpaid_bills || []).map((b) => (
                          <tr
                            key={b.reservation_id}
                            className="is-clickable"
                            onClick={() => setSelectedBookingRef(b.booking_ref)}
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            title="Click to open Reservation Detail Panel"
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: GOLD, fontFamily: 'monospace' }}>{b.booking_ref}</td>
                            <td style={{ padding: '12px 12px' }}>{b.guest_name}</td>
                            <td style={{ padding: '12px 12px' }}>Room {b.room_number} ({b.room_type})</td>
                            <td style={{ padding: '12px 12px', textTransform: 'capitalize' }}>{b.status.replace(/_/g, ' ')}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right' }}>{formatLKR(b.total_amount)}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', color: SUCCESS }}>{formatLKR(b.net_paid)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: DANGER }}>{formatLKR(b.balance)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Reconciliation Discrepancies Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} style={{ color: (operationsData?.data?.reconciliation_discrepancies_count || 0) > 0 ? DANGER : SUCCESS }} />
                  Payment Status Reconciliation Audit
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>BOOKING REF</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>GUEST</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>STORED STATUS</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>EXPECTED STATUS</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--muted)' }}>AUDIT FINDING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(operationsData?.data?.reconciliation_discrepancies || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: SUCCESS }}>
                            ✓ Clean audit! Every reservation payment_status agrees with recorded payment transactions.
                          </td>
                        </tr>
                      ) : (
                        (operationsData?.data?.reconciliation_discrepancies || []).map((rec) => (
                          <tr
                            key={rec.reservation_id}
                            className="is-clickable"
                            onClick={() => setSelectedBookingRef(rec.booking_ref)}
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            title="Click to open Reservation Detail Panel"
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: GOLD, fontFamily: 'monospace' }}>{rec.booking_ref}</td>
                            <td style={{ padding: '12px 12px' }}>{rec.guest_name}</td>
                            <td style={{ padding: '12px 12px', color: DANGER, textTransform: 'uppercase', fontWeight: 600 }}>{rec.stored_payment_status}</td>
                            <td style={{ padding: '12px 12px', color: SUCCESS, textTransform: 'uppercase', fontWeight: 600 }}>{rec.expected_payment_status}</td>
                            <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{rec.discrepancy}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DEFINITIONS DRAWER / MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showDefinitionsDrawer}
        onClose={() => setShowDefinitionsDrawer(false)}
        title="Metric Definitions & Calculation Formulas"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Every business metric is calculated on the server using verified parameterised queries and recursive night expansion CTEs.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(definitions).map(([key, desc]) => (
              <div
                key={key}
                style={{
                  padding: '12px 16px',
                  borderRadius: 4,
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, color: GOLD, fontSize: '0.88rem', marginBottom: 4, fontFamily: 'monospace' }}>
                  {key}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="outline" onClick={() => setShowDefinitionsDrawer(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reservation Detail Panel Drawer */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
        onActionComplete={() => {
          setSelectedBookingRef(null);
          fetchReportData();
        }}
      />
    </div>
  );
}
