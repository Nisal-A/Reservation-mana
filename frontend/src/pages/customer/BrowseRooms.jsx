import { useEffect, useState } from 'react';
import { BedDouble, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { PageLoader, StatusBadge, EmptyState, PageHeader } from '../../components/UI';

const ROOM_TYPES = ['Single', 'Double', 'Suite', 'Deluxe'];

const ROOM_ICONS = {
  Single: '🛏️', Double: '🛏️🛏️', Suite: '🏩', Deluxe: '🌟'
};

export default function BrowseRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/rooms', { params: { status: 'available' } })
      .then(({ data }) => setRooms(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = rooms.filter((r) => {
    const matchType = !filterType || r.room_type === filterType;
    const matchSearch = !search || r.room_number.toLowerCase().includes(search.toLowerCase()) || r.room_type.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Available Rooms"
        subtitle={`${filtered.length} rooms available`}
      />

      <div className="filters-row">
        <div className="search-bar">
          <Search size={16} />
          <input placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${!filterType ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilterType('')}
          >All</button>
          {ROOM_TYPES.map((t) => (
            <button
              key={t}
              className={`btn ${filterType === t ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilterType(t)}
            >{t}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🛏️" title="No available rooms" message="Try different filters or check back later." />
      ) : (
        <div className="rooms-grid">
          {filtered.map((room) => (
            <div key={room.room_id} className="room-card">
              <div className="room-card-image">
                <span style={{ fontSize: '4rem' }}>{ROOM_ICONS[room.room_type] || '🛏️'}</span>
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(16,185,129,0.15)', color: '#10b981',
                  fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                  borderRadius: 999, backdropFilter: 'blur(4px)', border: '1px solid rgba(16,185,129,0.3)'
                }}>Available</div>
              </div>
              <div className="room-card-body">
                <div className="room-card-header">
                  <div>
                    <div className="room-number">Room {room.room_number}</div>
                    <div className="room-type">{room.room_type}</div>
                  </div>
                  <div className="room-price">${Number(room.price).toFixed(0)}<span>/night</span></div>
                </div>
                {room.description && (
                  <p className="room-desc">{room.description}</p>
                )}
                <button
                  id={`btn-book-room-${room.room_id}`}
                  className="btn btn-primary w-full btn-sm"
                  onClick={() => navigate(`/customer/book?room=${room.room_id}`)}
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
