import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BedDouble, RefreshCw } from 'lucide-react';
import api from '../../../api/axios';
import RoomCard from '../components/RoomCard';
import SearchBar from '../components/SearchBar';
import { SectionTitle, Skeleton, EmptyState } from '../../../components/UI';

export default function Rooms() {
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkIn = searchParams.get('check_in') || '';
  const checkOut = searchParams.get('check_out') || '';
  const guests = searchParams.get('guests') || '';
  const type = searchParams.get('type') || '';

  const fetchRooms = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = {};
    if (checkIn) params.check_in = checkIn;
    if (checkOut) params.check_out = checkOut;
    if (guests) params.guests = guests;
    if (type) params.type = type;

    api.get('/public/rooms', { params })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setRooms(list);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load available rooms.');
      })
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, guests, type]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <div className="public-rooms-page">
      {/* Top Banner / Filter Bar */}
      <section className="public-rooms-header-section">
        <div className="public-container">
          <SectionTitle
            eyebrow="Accommodations"
            title="Rooms & Suites"
            subtitle="Browse our collection of hand-crafted sanctuaries tailored for bespoke stays."
          />
          <div style={{ marginTop: 24 }}>
            <SearchBar initialValues={{ check_in: checkIn, check_out: checkOut, guests, type }} />
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="public-section">
        <div className="public-container">
          {loading && (
            <div className="rooms-grid-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card-ui" style={{ padding: 0, overflow: 'hidden' }}>
                  <Skeleton height="208px" />
                  <div style={{ padding: 20 }}>
                    <Skeleton height="24px" width="60%" style={{ marginBottom: 12 }} />
                    <Skeleton height="16px" width="80%" style={{ marginBottom: 16 }} />
                    <Skeleton height="20px" width="40%" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="error-state-ui">
              <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>
              <button
                type="button"
                className="btn-ui btn-ui-secondary btn-ui-sm"
                onClick={fetchRooms}
              >
                <RefreshCw size={15} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!loading && !error && rooms.length > 0 && (
            <div className="rooms-grid-4">
              {rooms.map((room) => (
                <RoomCard key={room.room_id || room.room_type} room={room} />
              ))}
            </div>
          )}

          {!loading && !error && rooms.length === 0 && (
            <EmptyState
              icon={<BedDouble size={48} />}
              title="No Accommodations Found"
              message="No suites match your selected criteria. Try adjusting your dates or room type filter."
            />
          )}
        </div>
      </section>
    </div>
  );
}
