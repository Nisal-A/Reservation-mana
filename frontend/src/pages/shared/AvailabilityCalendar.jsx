// frontend/src/pages/shared/AvailabilityCalendar.jsx
// Staff Room Availability Calendar (Admin and Reception shared page)
// Month view, rooms as rows and nights as columns.
// Previous and next month buttons, 'Today' button, room type filter, and legend.
// Cells coloured by StatusText colours: available, reserved (pending or confirmed), occupied, maintenance.
// Stay bars span their nights and show the guest name; clicking one opens ReservationDetailPanel.
// Horizontal scroll stays inside the grid and the room column is sticky.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  User,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { formatLKR, formatDate, todayISO, nightsBetween } from '../../utils/format';
import {
  Button,
  PageHeader,
  Skeleton,
  EmptyState,
  ReservationDetailPanel,
} from '../../components/UI';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Cell column width in pixels for each night
const CELL_WIDTH = 44;
const ROOM_COL_WIDTH = 210;

/**
 * Returns previous day string 'YYYY-MM-DD' without timezone shift
 */
function getPrevDay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d - 1));
  const py = utc.getUTCFullYear();
  const pm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(utc.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

/**
 * Returns day-of-week abbreviation ('Sun'..'Sat') in UTC
 */
function getWeekday(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_NAMES[date.getUTCDay()];
}

export default function AvailabilityCalendar() {
  const todayStr = todayISO();
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [roomTypeFilter, setRoomTypeFilter] = useState('');

  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drawer state for ReservationDetailPanel
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);

  // Fetch calendar from backend
  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year, month };
      if (roomTypeFilter) {
        params.room_type = roomTypeFilter;
      }
      const res = await api.get('/calendar', { params });
      setCalendarData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load availability calendar');
    } finally {
      setLoading(false);
    }
  }, [year, month, roomTypeFilter]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setYear(todayYear);
    setMonth(todayMonth);
  };

  const daysInMonth = calendarData?.days_in_month || 30;
  const rooms = calendarData?.rooms || [];

  // Extract distinct room types for dropdown
  const availableRoomTypes = useMemo(() => {
    const set = new Set();
    const list = calendarData?.rooms || [];
    list.forEach((r) => {
      if (r.room_type) set.add(r.room_type);
    });
    return Array.from(set);
  }, [calendarData?.rooms]);

  // Is current view showing today's month & year?
  const isCurrentMonthView = year === todayYear && month === todayMonth;

  // Month date boundaries
  const monthStr = String(month).padStart(2, '0');
  const firstDayOfMonth = `${year}-${monthStr}-01`;
  const lastDayOfMonth = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  /**
   * Calculate stay span for a reservation within this month.
   * A stay occupies nights from check_in_date up to but not including check_out_date.
   * Returns null if no nights in this month.
   */
  const computeStaySpan = useCallback(
    (res) => {
      const lastNightOccupied = getPrevDay(res.check_out_date);
      if (lastNightOccupied < firstDayOfMonth || res.check_in_date > lastDayOfMonth) {
        return null;
      }

      const startNight = res.check_in_date < firstDayOfMonth ? firstDayOfMonth : res.check_in_date;
      const endNight = lastNightOccupied > lastDayOfMonth ? lastDayOfMonth : lastNightOccupied;

      const startDay = parseInt(startNight.split('-')[2], 10);
      const endDay = parseInt(endNight.split('-')[2], 10);
      const spanNights = endDay - startDay + 1;

      if (spanNights <= 0) return null;

      return {
        startDay,
        endDay,
        spanNights,
      };
    },
    [firstDayOfMonth, lastDayOfMonth]
  );

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Availability Calendar"
        subtitle="Visual room allocation and stay schedule across all nights of the month"
      />

      {/* Control Bar: Month Navigation, Today, Room Type filter, Legend */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* Month / Year Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--input)',
                borderRadius: 4,
                border: '1px solid var(--border)',
                padding: 2,
              }}
            >
              <button
                type="button"
                className="btn-icon"
                onClick={handlePrevMonth}
                title="Previous Month"
                style={{
                  padding: '7px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <ChevronLeft size={18} />
              </button>

              <div
                style={{
                  padding: '6px 16px',
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--gold)',
                  minWidth: 170,
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                }}
              >
                {MONTH_NAMES[month - 1]} {year}
              </div>

              <button
                type="button"
                className="btn-icon"
                onClick={handleNextMonth}
                title="Next Month"
                style={{
                  padding: '7px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Today Button */}
            <Button
              variant={isCurrentMonthView ? 'outline' : 'secondary'}
              size="sm"
              onClick={handleToday}
              title="Jump to current month"
            >
              <CalendarIcon size={14} /> Today
            </Button>
          </div>

          {/* Room Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
            <Filter size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="select-field"
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              style={{ padding: '8px 12px', minWidth: 180 }}
            >
              <option value="">All Room Types</option>
              {availableRoomTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Legend Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 20,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: '0.82rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
            Legend:
          </span>

          {/* Available */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: 'rgba(52, 211, 153, 0.25)',
                border: '1px solid var(--success)',
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'var(--text-body)' }}>Available</span>
          </div>

          {/* Reserved (Pending / Confirmed) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: 'var(--gold)',
                border: '1px solid #E8C98A',
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'var(--text-body)' }}>Reserved (Confirmed)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: 'var(--warning)',
                border: '1px solid #f59e0b',
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'var(--text-body)' }}>Reserved (Pending)</span>
          </div>

          {/* Occupied */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: 'var(--info)',
                border: '1px solid #3b82f6',
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'var(--text-body)' }}>Occupied (Checked In)</span>
          </div>

          {/* Maintenance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: 'rgba(248, 113, 113, 0.3)',
                border: '1px solid var(--danger)',
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'var(--text-body)' }}>Maintenance</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container with Internal Horizontal Scroll */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--card)',
        }}
      >
        {/* Horizontal Scroll wrapper */}
        <div
          style={{
            overflowX: 'auto',
            maxHeight: '75vh',
            position: 'relative',
          }}
        >
          <div
            style={{
              minWidth: ROOM_COL_WIDTH + daysInMonth * CELL_WIDTH,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header Row: Sticky Top and Sticky Left on the Room Column */}
            <div
              style={{
                display: 'flex',
                position: 'sticky',
                top: 0,
                zIndex: 25,
                background: 'var(--input)',
                borderBottom: '2px solid var(--border)',
              }}
            >
              {/* Sticky Left Corner Header */}
              <div
                style={{
                  width: ROOM_COL_WIDTH,
                  minWidth: ROOM_COL_WIDTH,
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                  background: 'var(--input)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRight: '2px solid var(--border)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--gold)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                <span>Room</span>
                <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '0.72rem' }}>Nights</span>
              </div>

              {/* Night Columns in Header */}
              <div style={{ display: 'flex', flex: 1 }}>
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const weekday = getWeekday(year, month, dayNum);
                  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
                  const isToday = isCurrentMonthView && dayNum === todayDay;

                  return (
                    <div
                      key={dayNum}
                      style={{
                        width: CELL_WIDTH,
                        minWidth: CELL_WIDTH,
                        padding: '8px 2px',
                        textAlign: 'center',
                        borderRight: '1px solid var(--border)',
                        background: isToday
                          ? 'rgba(200, 169, 106, 0.15)'
                          : isWeekend
                          ? 'rgba(255, 255, 255, 0.02)'
                          : 'transparent',
                        color: isToday ? 'var(--gold)' : isWeekend ? 'var(--muted)' : 'var(--text)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`${dayNum} ${MONTH_NAMES[month - 1]} ${year} (${weekday})`}
                    >
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          lineHeight: 1.2,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isToday ? 'var(--gold)' : 'transparent',
                          color: isToday ? '#000' : 'inherit',
                        }}
                      >
                        {dayNum}
                      </span>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.75 }}>
                        {weekday}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Room Rows */}
            {loading ? (
              <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <Skeleton height="46px" width={`${ROOM_COL_WIDTH}px`} />
                    <Skeleton height="46px" width="100%" />
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <EmptyState
                  icon={CalendarIcon}
                  title="No rooms to display"
                  message={
                    roomTypeFilter
                      ? `No rooms of type '${roomTypeFilter}' found. Try clearing the filter.`
                      : 'No rooms configured in the system.'
                  }
                />
              </div>
            ) : (
              rooms.map((room) => {
                const roomReservations = room.reservations || [];
                const isRoomMaintenance = room.base_status === 'maintenance';

                return (
                  <div
                    key={room.room_id}
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--border)',
                      minHeight: 52,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Sticky Room Info Column */}
                    <div
                      style={{
                        width: ROOM_COL_WIDTH,
                        minWidth: ROOM_COL_WIDTH,
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: 'var(--card)',
                        padding: '8px 16px',
                        borderRight: '2px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '2px 0 8px rgba(0,0,0,0.4)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: 'var(--gold)',
                            fontFamily: "'Playfair Display', Georgia, serif",
                          }}
                        >
                          Room {room.room_number}
                        </span>
                        {isRoomMaintenance && (
                          <span
                            title="Room under maintenance"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'var(--danger)',
                              fontSize: '0.7rem',
                            }}
                          >
                            <Wrench size={12} />
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <span>{room.room_type}</span>
                        <span>·</span>
                        <span>{formatLKR(room.price)}</span>
                      </div>
                    </div>

                    {/* Timeline Track: CSS Grid with daysInMonth columns */}
                    <div
                      style={{
                        flex: 1,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${daysInMonth}, ${CELL_WIDTH}px)`,
                        gridTemplateRows: '1fr',
                        position: 'relative',
                        background: 'rgba(0,0,0,0.15)',
                      }}
                    >
                      {/* 1. Background Night Cells */}
                      {Array.from({ length: daysInMonth }).map((_, idx) => {
                        const dayNum = idx + 1;
                        const weekday = getWeekday(year, month, dayNum);
                        const isWeekend = weekday === 'Sat' || weekday === 'Sun';

                        return (
                          <div
                            key={dayNum}
                            style={{
                              gridColumn: `${dayNum} / span 1`,
                              gridRow: 1,
                              borderRight: '1px solid var(--border)',
                              height: '100%',
                              background: isRoomMaintenance
                                ? 'rgba(248, 113, 113, 0.08)'
                                : isWeekend
                                ? 'rgba(255, 255, 255, 0.015)'
                                : 'transparent',
                              transition: 'background 0.15s ease',
                            }}
                            title={`Night of ${dayNum} ${MONTH_NAMES[month - 1]} — ${
                              isRoomMaintenance ? 'Maintenance' : 'Available'
                            }`}
                          />
                        );
                      })}

                      {/* 2. Stay Bars spanning their nights */}
                      {roomReservations.map((res) => {
                        const span = computeStaySpan(res);
                        if (!span) return null;

                        const isOccupied = res.status === 'checked_in';
                        const isPending = res.status === 'pending';

                        // Colors by status
                        const barBg = isOccupied
                          ? 'var(--info)'
                          : isPending
                          ? 'var(--warning)'
                          : 'var(--gold)';

                        const barColor = isOccupied ? '#ffffff' : '#000000';
                        const barBorder = isOccupied
                          ? 'rgba(96, 165, 250, 0.9)'
                          : isPending
                          ? 'rgba(251, 191, 36, 0.9)'
                          : 'rgba(200, 169, 106, 0.9)';

                        const totalNights = nightsBetween(res.check_in_date, res.check_out_date);

                        return (
                          <div
                            key={res.reservation_id}
                            onClick={() => setSelectedBookingRef(res.booking_ref)}
                            title={`${res.guest_name} (${res.booking_ref})\nDates: ${formatDate(
                              res.check_in_date
                            )} to ${formatDate(res.check_out_date)} (${totalNights} nights)\nStatus: ${
                              res.status
                            } (Click to view full reservation details)`}
                            style={{
                              gridColumn: `${span.startDay} / span ${span.spanNights}`,
                              gridRow: 1,
                              zIndex: 4,
                              alignSelf: 'center',
                              height: 36,
                              margin: '0 2px',
                              borderRadius: 4,
                              background: barBg,
                              color: barColor,
                              border: `1px solid ${barBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 8px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                              transition: 'transform 0.1s ease, filter 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = 'brightness(1.15)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = 'brightness(1)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <User size={13} style={{ marginRight: 5, flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {res.guest_name}
                            </span>
                            {span.spanNights >= 3 && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: '0.7rem',
                                  opacity: 0.85,
                                  fontWeight: 500,
                                }}
                              >
                                ({res.booking_ref})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Reservation Detail Panel Drawer */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
        onActionComplete={() => {
          setSelectedBookingRef(null);
          fetchCalendar();
        }}
      />
    </div>
  );
}
