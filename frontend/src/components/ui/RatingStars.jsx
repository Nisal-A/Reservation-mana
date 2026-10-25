import React, { useState } from 'react';
import { Star } from 'lucide-react';

/**
 * RatingStars: displays or captures 1-5 star ratings using Lucide Star icons.
 * Never uses emoji stars.
 */
export function RatingStars({
  value = 0,
  max = 5,
  onChange,
  readOnly = false,
  size = 18,
  className = '',
}) {
  const [hoverVal, setHoverVal] = useState(null);

  const activeValue = hoverVal !== null ? hoverVal : Number(value || 0);

  return (
    <div
      className={`rating-stars-ui ${readOnly ? 'is-readonly' : 'is-interactive'} ${className}`}
      onMouseLeave={() => !readOnly && setHoverVal(null)}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const starNum = idx + 1;
        const isFilled = starNum <= activeValue;

        return (
          <button
            key={starNum}
            type="button"
            disabled={readOnly}
            className={`rating-star-btn ${isFilled ? 'is-filled' : ''}`}
            onClick={() => !readOnly && onChange && onChange(starNum)}
            onMouseEnter={() => !readOnly && setHoverVal(starNum)}
            aria-label={`${starNum} Star${starNum > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              style={{
                fill: isFilled ? 'var(--gold)' : 'transparent',
                color: isFilled ? 'var(--gold)' : 'rgba(200, 169, 106, 0.3)',
                transition: 'all 0.15s ease',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default RatingStars;
