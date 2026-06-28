// Shared helper components used across the app

// Status Badge
export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status?.replace('_', ' ')}</span>;
}

// Loading spinner centered on page
export function PageLoader() {
  return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );
}

// Empty state
export function EmptyState({ icon = '📭', title = 'No data found', message }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {message && <p style={{ fontSize:'0.85rem' }}>{message}</p>}
    </div>
  );
}

// Stat card for dashboard
export function StatCard({ icon, label, value, color = '#d4a843', bg }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg || 'rgba(212,168,67,0.12)', color }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// Page header
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Confirm modal
export function ConfirmModal({ open, title, message, onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{message}</p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >{danger ? 'Delete' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
