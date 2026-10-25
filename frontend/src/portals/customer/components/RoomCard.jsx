import { useNavigate } from 'react-router-dom';
import { BedDouble } from 'lucide-react';
import { formatLKR } from '../../../utils/format';

export default function RoomCard({ room }) {
  const navigate = useNavigate();

  const {
    room_id,
    room_type,
    from_price,
    price,
    max_capacity,
    capacity,
    view_label,
    size_sqm,
    image,
    images,
  } = room;

  const displayPrice = from_price != null ? from_price : (price != null ? price : 0);
  const displayCapacity = max_capacity || capacity || 2;
  const displayView = view_label || 'Scenic View';
  const displaySize = size_sqm ? `${size_sqm} m²` : '28 m²';
  const imgUrl = image || (images && images.length > 0 ? images[0] : null);

  const handleChoose = () => {
    navigate(`/rooms?type=${encodeURIComponent(room_type || '')}`);
  };

  const handleDetails = () => {
    if (room_id) {
      navigate(`/rooms/${room_id}`);
    } else {
      navigate(`/rooms?type=${encodeURIComponent(room_type || '')}`);
    }
  };

  return (
    <article className="room-card-ui" aria-label={`${room_type} Room`}>
      {/* 208px Image with Zoom 1.06 on hover and bottom gradient */}
      <div className="room-card-media">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${room_type} Room at LuxeStay`}
            loading="lazy"
            className="room-card-image"
          />
        ) : (
          <div className="room-card-placeholder">
            <BedDouble size={40} style={{ color: 'var(--border-strong)', opacity: 0.6 }} />
          </div>
        )}
        <div className="room-card-bottom-gradient" />
      </div>

      {/* Body with Playfair name, muted meta, gold price, buttons */}
      <div className="room-card-body">
        <h3 className="room-card-title font-serif">
          {room_type}
        </h3>

        <p className="room-card-meta">
          Up to {displayCapacity} Guests • {displayView} • {displaySize}
        </p>

        <div className="room-card-price-row">
          <span className="room-card-price-val font-serif">
            {formatLKR(displayPrice)}
          </span>
          <span className="room-card-price-unit">/ night</span>
        </div>

        <div className="room-card-actions">
          <button
            type="button"
            className="btn-ui btn-ui-primary btn-ui-sm room-action-btn"
            onClick={handleChoose}
          >
            Choose
          </button>
          <button
            type="button"
            className="btn-ui btn-ui-secondary btn-ui-sm room-action-btn"
            onClick={handleDetails}
          >
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
