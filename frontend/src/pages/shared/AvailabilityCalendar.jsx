/**
 * AvailabilityCalendar.jsx — Room Availability Calendar
 * Monthly grid view with per-day status for every room.
 * Features: prev/next navigation, room type / room number / floor filters,
 * click-room drawer showing reservation list with guest names.
 */
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, CalendarCheck } from 'lucide-react';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState } from '../../components/UI';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  available:   'day-available',
  occupied:    'day-occupied',
  reserved:    'day-reserved',
  maintenance: 'day-maintenance',
  dirty:       'day-dirty',
  cleaning:    'day-cleaning',
  ready:       'day-ready',
};

const LEGEND = [
  { cls: 'day-available',   label: 'Available' },
  { cls: 'day-reserved',    label: 'Reserved' },
  { cls: 'day-occupied',    label: 'Occupied' },
  { cls: 'day-maintenance', label: 'Maintenance' },
  { cls: 'day-dirty',       label: 'Dirty' },
  { cls: 'day-cleaning',    label: 'Cleaning' },
  { cls: 'day-ready',       label: 'Ready' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function AvailabilityCalendar() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // { room, reservations }

  // Filters
  const [filterType,   setFilterType]   = useState('');
  const [filterRoom,   setFilterRoom]   = useState('');
  const [filterFloor,  setFilterFloor]  = useState('');

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year, month };
      if (filterType)  params.room_type   = filterType;
      if (filterRoom)  params.room_number = filterRoom;
      if (filterFloor) params.floor       = filterFloor;
      const { data: res } = await api.get('/calendar', { params });
      setData(res);
    } catch {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [year, month, filterType, filterRoom, filterFloor]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const openDrawer = (room) => setDrawer(room);

  if (loading) return <PageLoader />;

  const days = data?.days_in_month || 0;
  const dayLabels = Array.from({ length: days }, (_, i) => i + 1);

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Room Availability Calendar"
        subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="icon-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 700, minWidth: 140, textAlign: 'center' }}>
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button className="icon-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>
        }
      />

      {/* Filters */}
      <div className="filters-row" style={{ marginBottom: 16 }}>
        <select className="form-input" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {['Single','Double','Suite','Deluxe'].map(t => <option key={t}>{t}</option>)}
        </select>
        <input className="form-input" style={{ width: 140 }} placeholder="Room number..." value={filterRoom} onChange={e => setFilterRoom(e.target.value)} />
        <input className="form-input" style={{ width: 110 }} placeholder="Floor..." value={filterFloor} onChange={e => setFilterFloor(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={fetchCalendar}>Apply</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setFilterType(''); setFilterRoom(''); setFilterFloor(''); }}>Clear</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {LEGEND.map(l => (
          <div key={l.cls} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className={`room-day-cell ${l.cls}`} style={{ width: 20, height: 16, borderRadius: 3, flex: 'none' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      {(!data?.rooms || data.rooms.length === 0) ? (
        <EmptyState icon="📅" title="No rooms found" message="Adjust filters or add rooms." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Day header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: 110, flexShrink: 0, padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)' }}>
              ROOM
            </div>
            <div className="room-days" style={{ overflowX: 'auto' }}>
              {dayLabels.map(d => {
                const isToday = d === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
                return (
                  <div
                    key={d}
                    className="room-day-cell"
                    style={{
                      background: isToday ? 'var(--color-gold-glow)' : 'var(--color-surface-2)',
                      color: isToday ? 'var(--color-gold)' : 'var(--color-text-muted)',
                      fontWeight: isToday ? 800 : 600,
                      fontSize: '0.75rem',
                      padding: '8px 2px',
                      cursor: 'default',
                    }}
                  >
                    {d}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room rows */}
          {data.rooms.map((room) => (
            <div key={room.room_id} className="room-calendar-row">
              <div
                className="room-label"
                style={{ cursor: 'pointer' }}
                onClick={() => openDrawer(room)}
                title="Click to view reservations"
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-gold)' }}>#{room.room_number}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{room.room_type}</div>
              </div>
              <div className="room-days" style={{ overflowX: 'auto' }}>
                {room.days.map((day) => (
                  <div
                    key={day.day}
                    className={`room-day-cell ${STATUS_COLORS[day.status] || 'day-available'}`}
                    title={`${day.date}: ${day.status}${day.guest_name ? ` — ${day.guest_name}` : ''}`}
                  >
                    {day.guest_name ? day.guest_name.split(' ')[0].slice(0, 4) : ''}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <div className="modal-overlay" onClick={() => setDrawer(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <CalendarCheck size={18} style={{ marginRight: 8, color: 'var(--color-gold)' }} />
                Room {drawer.room_number} — {drawer.room_type}
              </div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><X size={16} /></button>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Reservations in {MONTH_NAMES[month - 1]} {year}
            </div>
            {drawer.reservations.length === 0 ? (
              <EmptyState icon="🗓️" title="No reservations this month" message="This room is free all month." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {drawer.reservations.map(r => (
                  <div key={r.reservation_id} className="card" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.guest_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {r.check_in_date} → {r.check_out_date}
                        </div>
                      </div>
                      <span className={`badge badge-${r.status}`}>{r.status.replace('_',' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
