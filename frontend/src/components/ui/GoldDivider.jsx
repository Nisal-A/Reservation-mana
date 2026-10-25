import React from 'react';

/**
 * GoldDivider: hairline line, 6px champagne-gold dot, hairline line.
 */
export function GoldDivider({ className = '', style }) {
  return (
    <div className={`gold-divider-ui ${className}`} style={style} role="separator">
      <span className="gold-divider-line" />
      <span className="gold-divider-dot" />
      <span className="gold-divider-line" />
    </div>
  );
}

export default GoldDivider;
