import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BedDouble, Calendar, Users, ArrowUpDown, XCircle } from 'lucide-react';
import api from '../../../api/axios';
import RoomCard from '../components/RoomCard';
import { SectionTitle, Skeleton, GoldDivider, Pagination, ErrorState } from '../../../components/UI';
import { todayISO } from '../../../utils/format';

export default function Rooms() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayISO();

  // Read URL query parameters (single source of filter truth)
  const checkIn = searchParams.get('check_in') || '';
  const checkOut = searchParams.get('check_out') || '';
  const guests = searchParams.get('guests') || '';
  const type = searchParams.get('type') || '';
  const minPriceParam = searchParams.get('min_price') || '';
  const maxPriceParam = searchParams.get('max_price') || '';
  const sort = searchParams.get('sort') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Local state for debounced text inputs (min/max price)
  const [localMinPrice, setLocalMinPrice] = useState(minPriceParam);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPriceParam);
  const debounceTimerRef = useRef(null);

  // Sync local inputs if URL changes externally (e.g. back/forward button)
  useEffect(() => {
    setLocalMinPrice(minPriceParam);
  }, [minPriceParam]);

  useEffect(() => {
    setLocalMaxPrice(maxPriceParam);
  }, [maxPriceParam]);

  // Public room types for filter dropdown
  const [roomTypes, setRoomTypes] = useState([]);
  useEffect(() => {
    let active = true;
    api.get('/public/room-types')
      .then((res) => {
        if (active && Array.isArray(res.data)) {
          setRoomTypes(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Rooms fetch state
  const [rooms, setRooms] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to update search params
  const updateQuery = useCallback((newParams, resetPage = true) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        updated.set(key, String(val).trim());
      } else {
        updated.delete(key);
      }
    });

    if (resetPage) {
      updated.delete('page');
    }

    setSearchParams(updated);
  }, [searchParams, setSearchParams]);

  // Handle typing debounce for min/max price (400ms)
  const handlePriceChange = (key, val) => {
    if (key === 'min_price') setLocalMinPrice(val);
    if (key === 'max_price') setLocalMaxPrice(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateQuery({ [key]: val }, true);
    }, 400);
  };

  // Fetch rooms from /api/public/rooms with pagination limit = 12
  const fetchRooms = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 12,
    };
    if (checkIn) params.check_in = checkIn;
    if (checkOut) params.check_out = checkOut;
    if (guests) params.guests = guests;
    if (type) params.type = type;
    if (minPriceParam) params.min_price = minPriceParam;
    if (maxPriceParam) params.max_price = maxPriceParam;
    if (sort) params.sort = sort;

    api.get('/public/rooms', { params })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setRooms(list);

        // Read total from header or estimate
        const countHeader = res.headers['x-total-count'];
        const total = countHeader ? parseInt(countHeader, 10) : (list.length < 12 && page === 1 ? list.length : 50);
        setTotalCount(total);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Unable to load accommodations at this time.');
      })
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, guests, type, minPriceParam, maxPriceParam, sort, page]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const clearDates = () => {
    updateQuery({ check_in: '', check_out: '' }, true);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / 12));

  return (
    <div className="public-rooms-page">
      <div className="public-container">
        {/* Section Title with Eyebrow and Gold Divider */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <SectionTitle
            eyebrow="Our rooms"
            title="Rooms & Suites"
            subtitle="Bespoke sanctuaries designed for uncompromised luxury and timeless tranquility."
          />
          <GoldDivider />
        </div>

        {/* Filter Bar built from Input styles */}
        <div className="rooms-filter-panel card-ui" style={{ padding: '24px 20px', marginBottom: 32 }}>
          <div className="rooms-filter-grid">
            {/* Check-In */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-check-in">
                <Calendar size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                <span>Check-In</span>
              </label>
              <input
                id="filter-check-in"
                type="date"
                className="input-ui"
                min={today}
                value={checkIn}
                onChange={(e) => updateQuery({ check_in: e.target.value })}
              />
            </div>

            {/* Check-Out */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-check-out">
                <Calendar size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                <span>Check-Out</span>
              </label>
              <input
                id="filter-check-out"
                type="date"
                className="input-ui"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => updateQuery({ check_out: e.target.value })}
              />
            </div>

            {/* Guests */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-guests">
                <Users size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                <span>Guests</span>
              </label>
              <select
                id="filter-guests"
                className="select-ui"
                value={guests}
                onChange={(e) => updateQuery({ guests: e.target.value })}
              >
                <option value="">Any Guests</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Guest' : 'Guests'}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Type */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-room-type">
                <BedDouble size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                <span>Room Type</span>
              </label>
              <select
                id="filter-room-type"
                className="select-ui"
                value={type}
                onChange={(e) => updateQuery({ type: e.target.value })}
              >
                <option value="">All Categories</option>
                {roomTypes.map((rt) => (
                  <option key={rt.room_type} value={rt.room_type}>
                    {rt.room_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Price (Debounced 400ms) */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-min-price">
                <span>Min Price (LKR)</span>
              </label>
              <input
                id="filter-min-price"
                type="number"
                min="0"
                step="50"
                placeholder="Min LKR"
                className="input-ui"
                value={localMinPrice}
                onChange={(e) => handlePriceChange('min_price', e.target.value)}
              />
            </div>

            {/* Max Price (Debounced 400ms) */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-max-price">
                <span>Max Price (LKR)</span>
              </label>
              <input
                id="filter-max-price"
                type="number"
                min="0"
                step="50"
                placeholder="Max LKR"
                className="input-ui"
                value={localMaxPrice}
                onChange={(e) => handlePriceChange('max_price', e.target.value)}
              />
            </div>

            {/* Sort Order */}
            <div className="form-field-wrapper">
              <label className="form-field-label" htmlFor="filter-sort">
                <ArrowUpDown size={13} style={{ color: 'var(--gold)', marginRight: 4 }} />
                <span>Sort By</span>
              </label>
              <select
                id="filter-sort"
                className="select-ui"
                value={sort}
                onChange={(e) => updateQuery({ sort: e.target.value })}
              >
                <option value="">Default Ranking</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="capacity">Capacity: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Header: Count & Active Filters Indicator */}
        <div className="rooms-results-meta">
          <div className="rooms-count-text">
            {!loading && (
              <span>
                Showing <strong style={{ color: 'var(--text)' }}>{rooms.length}</strong> of{' '}
                <strong style={{ color: 'var(--gold)' }}>{totalCount}</strong> accommodations
                {checkIn && checkOut && (
                  <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                    (for {checkIn} to {checkOut})
                  </span>
                )}
              </span>
            )}
          </div>

          {(checkIn || checkOut || guests || type || minPriceParam || maxPriceParam || sort) && (
            <button
              type="button"
              className="btn-ui btn-ui-ghost btn-ui-sm clear-filters-btn"
              onClick={clearAllFilters}
            >
              <XCircle size={14} />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Loading State: 8 skeleton cards */}
        {loading && (
          <div className="rooms-grid-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="card-ui" style={{ padding: 0, overflow: 'hidden' }}>
                <Skeleton height="208px" />
                <div style={{ padding: 20 }}>
                  <Skeleton height="24px" width="60%" style={{ marginBottom: 12 }} />
                  <Skeleton height="16px" width="80%" style={{ marginBottom: 16 }} />
                  <Skeleton height="20px" width="40%" style={{ marginBottom: 20 }} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Skeleton height="36px" width="50%" />
                    <Skeleton height="36px" width="50%" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry */}
        {error && (
          <ErrorState
            title="Unable to Load Accommodations"
            message={error}
            onRetry={fetchRooms}
          />
        )}

        {/* Empty Result */}
        {!loading && !error && rooms.length === 0 && (
          <div className="empty-rooms-card card-ui" style={{ textAlign: 'center', padding: '60px 24px', margin: '32px 0' }}>
            <BedDouble size={48} style={{ color: 'var(--gold)', margin: '0 auto 16px', opacity: 0.8 }} />
            {checkIn && checkOut ? (
              <>
                <h3 className="empty-state-title font-serif" style={{ fontSize: '1.4rem', color: 'var(--text)', marginBottom: 8 }}>
                  No rooms are free for these dates
                </h3>
                <p className="empty-state-text" style={{ color: 'var(--muted)', maxWidth: 480, margin: '0 auto 24px' }}>
                  All suites are occupied between {checkIn} and {checkOut}. Please try adjusting your schedule or clearing the dates to view all rooms.
                </p>
                <button
                  type="button"
                  className="btn-ui btn-ui-primary btn-ui-md"
                  onClick={clearDates}
                >
                  Clear dates & view all
                </button>
              </>
            ) : (
              <>
                <h3 className="empty-state-title font-serif" style={{ fontSize: '1.4rem', color: 'var(--text)', marginBottom: 8 }}>
                  No accommodations match your filters
                </h3>
                <p className="empty-state-text" style={{ color: 'var(--muted)', maxWidth: 480, margin: '0 auto 24px' }}>
                  Try resetting your price range or category to explore available options.
                </p>
                <button
                  type="button"
                  className="btn-ui btn-ui-secondary btn-ui-md"
                  onClick={clearAllFilters}
                >
                  Reset all filters
                </button>
              </>
            )}
          </div>
        )}

        {/* Room Cards Grid (1 / 2 / 4 columns) */}
        {!loading && !error && rooms.length > 0 && (
          <div className="rooms-grid-4">
            {rooms.map((room) => (
              <RoomCard
                key={room.room_id}
                room={room}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                onCheckDates={() => {
                  const input = document.getElementById('filter-check-in');
                  if (input) input.focus();
                }}
              />
            ))}
          </div>
        )}

        {/* Pagination (12 per page) */}
        {!loading && !error && totalPages > 1 && (
          <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => updateQuery({ page: p }, false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
