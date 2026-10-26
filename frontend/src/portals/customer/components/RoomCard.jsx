import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLKR } from '../../../utils/format';
import { getRoomFallbackPhoto } from '../../../config/photos';
import { assetUrl } from '../../../config/env';

export default function RoomCard({ room, checkIn = '', checkOut = '', guests = '', onCheckDates }) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  const {
    room_id,
    room_type,
    from_price,
    price,
    price_per_night,
    max_capacity,
    capacity,
    view_label,
    size_sqm,
    image,
    images,
    total,
    nights,
  } = room;

  const displayPrice = price_per_night != null ? price_per_night : (from_price != null ? from_price : (price != null ? price : 0));
  const displayCapacity = max_capacity || capacity || 2;
  const displayView = view_label || 'Courtyard View';
  const displaySize = size_sqm ? `${size_sqm} m²` : '28 m²';
  const fallbackPhoto = getRoomFallbackPhoto(room_type || room_id);
  const rawImg = image || (images && images.length > 0 ? images[0] : null);
  const resolvedImg = rawImg && !imgFailed
    ? (rawImg.startsWith('/uploads/') ? assetUrl(rawImg) : rawImg)
    : null;

  const hasDates = Boolean(checkIn && checkOut && nights && total != null);

  // Build query string to preserve dates and guests
  const buildQuery = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set('check_in', checkIn);
    if (checkOut) params.set('check_out', checkOut);
    if (guests) params.set('guests', String(guests));
    const str = params.toString();
    return str ? `?${str}` : '';
  };

  const handlePrimaryClick = () => {
    const targetId = room_id || 1;
    if (hasDates) {
      navigate(`/rooms/${targetId}${buildQuery()}`);
    } else {
      if (onCheckDates) {
        onCheckDates();
      } else {
        navigate(`/rooms/${targetId}${buildQuery()}`);
      }
    }
  };

  const handleDetailsClick = () => {
    const targetId = room_id || 1;
    navigate(`/rooms/${targetId}${buildQuery()}`);
  };

  return (
    <article className="room-card-ui" aria-label={`${room_type} Room`}>
      {/* 208px Image with Zoom 1.06 on hover and bottom gradient */}
      <div className="room-card-media">
        {resolvedImg ? (
          <img
            src={resolvedImg}
            alt={`${room_type} Room at LuxeStay`}
            loading="lazy"
            className="room-card-image"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <picture className="room-card-picture">
            <source srcSet={fallbackPhoto.cardWebp} type="image/webp" />
            <img
              src={fallbackPhoto.cardJpg}
              alt={fallbackPhoto.alt || `${room_type} Room at LuxeStay`}
              loading="lazy"
              className="room-card-image"
            />
          </picture>
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

        {/* Price row */}
        {hasDates ? (
          <div className="room-card-price-row has-stay-total">
            <div className="room-card-total-group">
              <span className="room-card-price-val font-serif">
                {formatLKR(total)}
              </span>
              <span className="room-card-price-unit">
                {' '}total for {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
            </div>
            <div className="room-card-rate-sub">
              {formatLKR(displayPrice)} / night
            </div>
          </div>
        ) : (
          <div className="room-card-price-row">
            <span className="room-card-price-val font-serif">
              {formatLKR(displayPrice)}
            </span>
            <span className="room-card-price-unit">/ night</span>
          </div>
        )}

        <div className="room-card-actions">
          <button
            type="button"
            className="btn-ui btn-ui-primary btn-ui-sm room-action-btn"
            onClick={handlePrimaryClick}
          >
            {hasDates ? 'Choose' : 'Check dates'}
          </button>
          <button
            type="button"
            className="btn-ui btn-ui-secondary btn-ui-sm room-action-btn"
            onClick={handleDetailsClick}
          >
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
