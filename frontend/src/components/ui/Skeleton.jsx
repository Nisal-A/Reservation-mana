import React from 'react';

/**
 * Skeleton loading placeholder with pulse on --input background.
 */
export function Skeleton({
  width,
  height,
  borderRadius = 'var(--radius)',
  className = '',
  lines = 1,
  style,
}) {
  if (lines > 1) {
    return (
      <div className={`skeleton-multi-lines ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-ui"
            style={{
              width: i === lines - 1 && lines > 1 ? '70%' : width || '100%',
              height: height || '16px',
              borderRadius,
              marginBottom: i < lines - 1 ? '8px' : 0,
              ...style,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton-ui ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
        ...style,
      }}
    />
  );
}

export default Skeleton;
