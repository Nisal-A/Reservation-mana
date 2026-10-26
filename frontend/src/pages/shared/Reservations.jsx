import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatLKR } from '../../utils/format';
import {
  Button,
  StatusText,
  Pagination,
  ReservationDetailPanel,
  Skeleton,
  Eyebrow,
  EmptyState,
} from '../../components/UI';

const PAGE_SIZE = 20;

export default function Reservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query params
  const qParam = searchParams.get('q') || '';
  const statusParam = searchParams.get('status') || '';
  const sourceParam = searchParams.get('source') || '';
  const paymentStatusParam = searchParams.get('payment_status') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(qParam);
  const [reservations, setReservations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected reservation for side-drawer detail panel
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);

  // Debounce search input by 400ms to update URL
  const debounceTimerRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchInput(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val.trim()) next.set('q', val.trim());
        else next.delete('q');
        next.set('page', '1');
        return next;
      });
    }, 400);
  };

  // Sync search input if URL changes externally
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  // Update a single filter parameter
  const updateFilter = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set('page', '1');
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  // Fetch reservations from server
  const fetchReservations = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const params = {
        page: pageParam,
        limit: PAGE_SIZE,
      };
      if (qParam) params.q = qParam;
      if (statusParam) params.status = statusParam;
      if (sourceParam) params.source = sourceParam;
      if (paymentStatusParam) params.payment_status = paymentStatusParam;
      if (fromParam) params.from = fromParam;
      if (toParam) params.to = toParam;

      const res = await api.get('/reservations', { params });
      const payload = res.data;

      if (Array.isArray(payload)) {
        setReservations(payload);
        setTotalCount(payload.length);
      } else {
        setReservations(payload.data || []);
        setTotalCount(payload.total || 0);
      }
    } catch {
      toast.error('Failed to load reservations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [qParam, statusParam, sourceParam, paymentStatusParam, fromParam, toParam, pageParam]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasActiveFilters = Boolean(
    qParam || statusParam || sourceParam || paymentStatusParam || fromParam || toParam
  );

  return (
    <div className="page-content slide-up" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Eyebrow text="FOLIO DIRECTORY" />
          <h1 className="page-title" style={{ marginTop: 4, marginBottom: 6 }}>
            Reservations
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {totalCount} total reservation record{totalCount === 1 ? '' : 's'} found
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchReservations(true)}
            loading={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>

          {user?.role === 'reception' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/reception/new')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} />
              <span>New Reservation</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card-ui"
        style={{
          padding: 16,
          marginBottom: 20,
          background: 'var(--card)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {/* Search Input (Debounced 400ms) */}
          <div style={{ position: 'relative', gridColumn: 'span 2' }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: 10,
                color: 'var(--muted)',
                pointerEvents: 'none',
              }}
            >
              <Search size={16} />
            </span>
            <input
              type="text"
              className="input-ui"
              placeholder="Search reference, guest, email, phone, room..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="select-ui"
              value={statusParam}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-Show</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              className="select-ui"
              value={sourceParam}
              onChange={(e) => updateFilter('source', e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="online">Online Portal</option>
              <option value="reception">Reception Walk-in</option>
              <option value="admin">Admin Direct</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              className="select-ui"
              value={paymentStatusParam}
              onChange={(e) => updateFilter('payment_status', e.target.value)}
            >
              <option value="">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Date Range: From */}
          <div>
            <input
              type="date"
              className="input-ui"
              value={fromParam}
              onChange={(e) => updateFilter('from', e.target.value)}
              title="Filter stays on or after this date"
            />
          </div>

          {/* Date Range: To */}
          <div>
            <input
              type="date"
              className="input-ui"
              value={toParam}
              onChange={(e) => updateFilter('to', e.target.value)}
              title="Filter stays on or before this date"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Filters active. Showing filtered subset.
            </span>
            <button
              type="button"
              className="btn-ui btn-ui-ghost btn-ui-sm"
              onClick={clearFilters}
              style={{ fontSize: 12, color: 'var(--gold)', gap: 4 }}
            >
              <X size={14} /> Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="card-ui" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skeleton height={32} />
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : reservations.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              icon={<Search size={40} />}
              title="No Reservations Found"
              message={
                hasActiveFilters
                  ? 'No reservations matched your selected filters or search terms.'
                  : 'No reservation records exist in the system yet.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table-ui">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                  <th>Payment Status</th>
                  <th>Total</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr
                    key={r.reservation_id}
                    onClick={() => setSelectedBookingRef(r.booking_ref)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Reference (gold mono) */}
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)' }}>
                      {r.booking_ref}
                    </td>

                    {/* Guest */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {r.customer_name || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {r.customer_phone || r.customer_email || ''}
                      </div>
                    </td>

                    {/* Room */}
                    <td>
                      Room {r.room_number || '—'}{' '}
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                        ({r.room_type})
                      </span>
                    </td>

                    {/* Check-In */}
                    <td style={{ fontSize: 13 }}>{formatDate(r.check_in_date)}</td>

                    {/* Check-Out */}
                    <td style={{ fontSize: 13 }}>{formatDate(r.check_out_date)}</td>

                    {/* Status */}
                    <td>
                      <StatusText status={r.status} />
                    </td>

                    {/* Payment Status */}
                    <td>
                      <StatusText status={r.payment_status} />
                    </td>

                    {/* Total */}
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {formatLKR(r.total_amount)}
                    </td>

                    {/* Balance */}
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: r.balance > 0 ? 'var(--warning)' : 'var(--text)',
                      }}
                    >
                      {formatLKR(r.balance ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination (20 per page) */}
        {!loading && totalPages > 1 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Showing {Math.min((pageParam - 1) * PAGE_SIZE + 1, totalCount)}–
              {Math.min(pageParam * PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            <Pagination
              currentPage={pageParam}
              totalPages={totalPages}
              onPageChange={(p) => updateFilter('page', String(p))}
            />
          </div>
        )}
      </div>

      {/* Shared Reservation Detail Drawer */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
        onActionComplete={() => fetchReservations(true)}
      />
    </div>
  );
}
