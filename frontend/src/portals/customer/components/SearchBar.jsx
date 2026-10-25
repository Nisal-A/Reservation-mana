import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Users, BedDouble, AlertCircle } from 'lucide-react';
import api from '../../../api/axios';
import { todayISO } from '../../../utils/format';

export default function SearchBar({ initialValues = {} }) {
  const navigate = useNavigate();
  const today = todayISO();

  const [checkIn, setCheckIn] = useState(initialValues.check_in || '');
  const [checkOut, setCheckOut] = useState(initialValues.check_out || '');
  const [guests, setGuests] = useState(initialValues.guests || '1');
  const [roomType, setRoomType] = useState(initialValues.type || '');
  const [roomTypes, setRoomTypes] = useState([]);
  const [error, setError] = useState('');

  // Fetch optional room types from public API
  useEffect(() => {
    let isMounted = true;
    api.get('/public/room-types')
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setRoomTypes(res.data);
        }
      })
      .catch(() => {
        // Silently fall back to standard list if offline
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setError('');

    // Inline validation
    if (checkIn && checkIn < today) {
      setError('Check-in date cannot be in the past.');
      return;
    }
    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Check-out date must be strictly after check-in date.');
      return;
    }

    const params = new URLSearchParams();
    if (checkIn) params.set('check_in', checkIn);
    if (checkOut) params.set('check_out', checkOut);
    if (guests) params.set('guests', guests);
    if (roomType) params.set('type', roomType);

    navigate(`/rooms?${params.toString()}`);
  };

  return (
    <div className="hero-search-wrapper">
      <form className="hero-search-bar" onSubmit={handleSearch} noValidate>
        {/* Check-In */}
        <div className="search-field-group">
          <label className="search-field-label" htmlFor="search-check-in">
            <Calendar size={13} style={{ color: 'var(--gold)' }} />
            <span>Check-In</span>
          </label>
          <input
            id="search-check-in"
            type="date"
            className="search-field-input"
            min={today}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              setError('');
            }}
          />
        </div>

        {/* Check-Out */}
        <div className="search-field-group">
          <label className="search-field-label" htmlFor="search-check-out">
            <Calendar size={13} style={{ color: 'var(--gold)' }} />
            <span>Check-Out</span>
          </label>
          <input
            id="search-check-out"
            type="date"
            className="search-field-input"
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              setError('');
            }}
          />
        </div>

        {/* Guests */}
        <div className="search-field-group">
          <label className="search-field-label" htmlFor="search-guests">
            <Users size={13} style={{ color: 'var(--gold)' }} />
            <span>Guests</span>
          </label>
          <select
            id="search-guests"
            className="search-field-select"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? 'Guest' : 'Guests'}
              </option>
            ))}
          </select>
        </div>

        {/* Room Type */}
        <div className="search-field-group">
          <label className="search-field-label" htmlFor="search-room-type">
            <BedDouble size={13} style={{ color: 'var(--gold)' }} />
            <span>Room Type</span>
          </label>
          <select
            id="search-room-type"
            className="search-field-select"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
          >
            <option value="">All Room Types</option>
            {roomTypes.map((rt) => (
              <option key={rt.room_type} value={rt.room_type}>
                {rt.room_type}
              </option>
            ))}
          </select>
        </div>

        {/* Submit Button */}
        <div className="search-button-container">
          <button
            type="submit"
            className="btn-ui btn-ui-primary search-submit-btn"
            id="search-availability-btn"
          >
            <Search size={16} />
            <span>Check availability</span>
          </button>
        </div>
      </form>

      {/* Inline Validation Error */}
      {error && (
        <div className="search-inline-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
