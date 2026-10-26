// frontend/src/pages/admin/reports/ReportFilters.jsx
// Shared reporting filter bar
// DateRangePicker with presets (Today, Last 7 days, This month, Last month, This year),
// 'Compare with' select (Off, Previous period, Previous year),
// Room type select (from /api/public/room-types), and Booking source select.
// All values live in the URL query string and every request is debounced 300ms. Default range: this month.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layers, ArrowLeftRight, Compass } from 'lucide-react';
import api from '../../../api/axios';
import { getDefaultRange } from '../../../utils/format';
import { DateRangePicker } from '../../../components/UI';

export default function ReportFilters({ className = '' }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query params with defaults
  const defaultRange = getDefaultRange();
  const fromParam = searchParams.get('from') || defaultRange.from;
  const toParam = searchParams.get('to') || defaultRange.to;
  const compareParam = searchParams.get('compare') || 'none';
  const roomTypeParam = searchParams.get('room_type') || '';
  const sourceParam = searchParams.get('source') || '';

  // Local state for smooth interaction before debounce
  const [localFrom, setLocalFrom] = useState(fromParam);
  const [localTo, setLocalTo] = useState(toParam);
  const [localCompare, setLocalCompare] = useState(compareParam);
  const [localRoomType, setLocalRoomType] = useState(roomTypeParam);
  const [localSource, setLocalSource] = useState(sourceParam);

  // Available room types from public endpoint
  const [roomTypes, setRoomTypes] = useState([]);
  const debounceTimerRef = useRef(null);

  // Fetch room types
  useEffect(() => {
    let isMounted = true;
    api
      .get('/public/room-types')
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          const names = res.data
            .map((item) => (typeof item === 'string' ? item : item.room_type))
            .filter(Boolean);
          setRoomTypes([...new Set(names)]);
        }
      })
      .catch(() => {
        // Fallback default suggestions if endpoint is unavailable
        if (isMounted) {
          setRoomTypes(['Single', 'Double', 'Deluxe', 'Suite', 'Ocean Villa', 'Family Suite']);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Synchronize local state if URL changes externally
  useEffect(() => {
    setLocalFrom(fromParam);
    setLocalTo(toParam);
    setLocalCompare(compareParam);
    setLocalRoomType(roomTypeParam);
    setLocalSource(sourceParam);
  }, [fromParam, toParam, compareParam, roomTypeParam, sourceParam]);

  // Debounced URL updates (300ms)
  const commitParams = useCallback(
    (newParams) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            // Retain existing params like 'tab'
            if (newParams.from) next.set('from', newParams.from);
            else next.delete('from');

            if (newParams.to) next.set('to', newParams.to);
            else next.delete('to');

            if (newParams.compare && newParams.compare !== 'none') {
              next.set('compare', newParams.compare);
            } else {
              next.delete('compare');
            }

            if (newParams.room_type) next.set('room_type', newParams.room_type);
            else next.delete('room_type');

            if (newParams.source) next.set('source', newParams.source);
            else next.delete('source');

            return next;
          },
          { replace: true }
        );
      }, 300);
    },
    [setSearchParams]
  );

  // DateRangePicker change handler
  const handleDateChange = ({ startDate, endDate }) => {
    setLocalFrom(startDate);
    setLocalTo(endDate);
    commitParams({
      from: startDate,
      to: endDate,
      compare: localCompare,
      room_type: localRoomType,
      source: localSource,
    });
  };

  // Compare change handler
  const handleCompareChange = (e) => {
    const val = e.target.value;
    setLocalCompare(val);
    commitParams({
      from: localFrom,
      to: localTo,
      compare: val,
      room_type: localRoomType,
      source: localSource,
    });
  };

  // Room type change handler
  const handleRoomTypeChange = (e) => {
    const val = e.target.value;
    setLocalRoomType(val);
    commitParams({
      from: localFrom,
      to: localTo,
      compare: localCompare,
      room_type: val,
      source: localSource,
    });
  };

  // Booking source change handler
  const handleSourceChange = (e) => {
    const val = e.target.value;
    setLocalSource(val);
    commitParams({
      from: localFrom,
      to: localTo,
      compare: localCompare,
      room_type: localRoomType,
      source: val,
    });
  };

  return (
    <div
      className={`card report-filters-bar ${className}`}
      style={{
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* 1. Date Range Picker with Presets */}
      <div style={{ flex: '1 1 360px', minWidth: 320 }}>
        <DateRangePicker
          startDate={localFrom}
          endDate={localTo}
          onChange={handleDateChange}
        />
      </div>

      {/* 2. Compare With, Room Type, and Booking Source Selects */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          flex: '1 1 auto',
        }}
      >
        {/* Compare Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 160 }}>
          <ArrowLeftRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <select
            className="select-field"
            value={localCompare}
            onChange={handleCompareChange}
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            aria-label="Compare with"
          >
            <option value="none">Compare: Off</option>
            <option value="previous_period">Previous Period</option>
            <option value="previous_year">Previous Year</option>
          </select>
        </div>

        {/* Room Type Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 160 }}>
          <Layers size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <select
            className="select-field"
            value={localRoomType}
            onChange={handleRoomTypeChange}
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            aria-label="Room type"
          >
            <option value="">All Room Types</option>
            {roomTypes.map((type) => {
              const val = typeof type === 'string' ? type : type.room_type;
              return (
                <option key={val} value={val}>
                  {val}
                </option>
              );
            })}
          </select>
        </div>

        {/* Booking Source Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 150 }}>
          <Compass size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <select
            className="select-field"
            value={localSource}
            onChange={handleSourceChange}
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            aria-label="Booking source"
          >
            <option value="">All Sources</option>
            <option value="online">Online Portal</option>
            <option value="reception">Reception Desk</option>
            <option value="admin">Admin Console</option>
          </select>
        </div>
      </div>
    </div>
  );
}
