import React from 'react';

const STATUS_MAP = {
  // Booking statuses
  pending:     { colorVar: 'var(--warning)', label: 'Pending' },
  confirmed:   { colorVar: 'var(--success)', label: 'Confirmed' },
  checked_in:  { colorVar: 'var(--info)',    label: 'Checked In' },
  checked_out: { colorVar: 'var(--muted)',   label: 'Checked Out' },
  cancelled:   { colorVar: 'var(--danger)',  label: 'Cancelled' },
  no_show:     { colorVar: 'var(--danger)',  label: 'No Show' },

  // Payment statuses
  unpaid:      { colorVar: 'var(--warning)', label: 'Unpaid' },
  partial:     { colorVar: 'var(--info)',    label: 'Partial' },
  paid:        { colorVar: 'var(--success)', label: 'Paid' },
  refunded:    { colorVar: 'var(--muted)',   label: 'Refunded' },

  // Room statuses
  available:   { colorVar: 'var(--success)', label: 'Available' },
  occupied:    { colorVar: 'var(--info)',    label: 'Occupied' },
  maintenance: { colorVar: 'var(--danger)',  label: 'Maintenance' },
};

/**
 * StatusText: plain coloured text with no pill backgrounds.
 */
export function StatusText({ status, className = '', children }) {
  const norm = String(status || '').toLowerCase().trim();
  const meta = STATUS_MAP[norm] || {
    colorVar: 'var(--muted)',
    label: (status || '—').replace(/_/g, ' '),
  };

  return (
    <span
      className={`status-text-ui ${className}`}
      style={{
        color: meta.colorVar,
        fontWeight: 600,
        fontSize: '0.875rem',
        letterSpacing: '0.02em',
        display: 'inline-block',
      }}
    >
      {children || meta.label}
    </span>
  );
}

// Backwards-compatible alias for StatusBadge
export const StatusBadge = StatusText;

export default StatusText;
