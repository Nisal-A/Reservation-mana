import React from 'react';

/**
 * StatCard: display key metrics with champagne gold styling,
 * Playfair Display font for large numbers, icon badge, and subtitle.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color = 'var(--gold)',
  bg,
  className = '',
  onClick,
}) {
  return (
    <div
      className={`stat-card-ui ${onClick ? 'is-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <div
            className="stat-card-icon-badge"
            style={{
              color: color || 'var(--gold)',
              background: bg || 'rgba(200, 169, 106, 0.1)',
            }}
          >
            {React.isValidElement(Icon) ? Icon : <Icon size={18} />}
          </div>
        )}
      </div>

      <div className="stat-card-value">{value}</div>

      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}

export default StatCard;
