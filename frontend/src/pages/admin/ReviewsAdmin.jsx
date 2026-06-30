/**
 * ReviewsAdmin.jsx — Admin review moderation dashboard.
 * Approve, reject, or delete customer reviews.
 */
import { useState, useEffect } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState, StatusBadge, StatCard, ConfirmModal } from '../../components/UI';

function StarDisplay({ value }) {
  return (
    <div className="star-display" style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} className={`star ${n <= value ? 'filled' : ''}`} style={{ fontSize: '0.9rem' }}>★</span>
      ))}
    </div>
  );
}

export default function ReviewsAdmin() {
  const [reviews,     setReviews]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const { data } = await api.get('/reviews', { params });
      setReviews(data);
    } catch { toast.error('Failed to load reviews'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [filterStatus]);

  const approve = async (id) => {
    try {
      await api.patch(`/reviews/${id}/approve`);
      toast.success('Review approved');
      fetch();
    } catch { toast.error('Failed'); }
  };

  const reject = async (id) => {
    try {
      await api.patch(`/reviews/${id}/reject`);
      toast.success('Review rejected');
      fetch();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/reviews/${deleteTarget.review_id}`);
      toast.success('Review deleted');
      setDeleteTarget(null);
      fetch();
    } catch { toast.error('Delete failed'); setDeleteTarget(null); }
  };

  // Compute stats
  const pending  = reviews.filter(r => r.status === 'pending').length;
  const approved = reviews.filter(r => r.status === 'approved').length;
  const avgRating = reviews.filter(r => r.status === 'approved').length > 0
    ? (reviews.filter(r => r.status === 'approved').reduce((a, r) => a + r.rating, 0) / approved).toFixed(1)
    : '—';

  if (loading && reviews.length === 0) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Review Moderation"
        subtitle="Approve, reject, or remove customer reviews"
      />

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="⭐" label="Avg Rating" value={avgRating} color="var(--color-gold)" bg="var(--color-gold-glow)" />
        <StatCard icon="⏳" label="Pending" value={pending} color="var(--color-warning)" bg="var(--color-warning-bg)" />
        <StatCard icon="✅" label="Approved" value={approved} color="var(--color-success)" bg="var(--color-success-bg)" />
        <StatCard icon="📝" label="Total" value={reviews.length} color="var(--color-info)" bg="var(--color-info-bg)" />
      </div>

      {/* Filter */}
      <div className="filters-row">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${filterStatus === (s === 'all' ? '' : s) ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(s === 'all' ? '' : s)}
            style={{ textTransform: 'capitalize' }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : reviews.length === 0 ? (
        <EmptyState icon="⭐" title="No reviews" message="No reviews match the selected filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map(r => (
            <div key={r.review_id} className="review-card">
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="reviewer-avatar">
                    {(r.customer_name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.customer_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Room {r.room_number} — {r.room_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StarDisplay value={r.rating} />
                  <StatusBadge status={r.status} />
                </div>
              </div>

              {r.review_text && <p className="review-text">{r.review_text}</p>}
              {r.image_url && (
                <img src={`http://localhost:3001${r.image_url}`} alt="Review" className="review-image" style={{ maxHeight: 160 }} />
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {r.status !== 'approved'  && (
                  <button className="btn btn-sm btn-secondary" style={{ color: 'var(--color-success)' }} onClick={() => approve(r.review_id)}>
                    <Check size={14} /> Approve
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button className="btn btn-sm btn-secondary" style={{ color: 'var(--color-warning)' }} onClick={() => reject(r.review_id)}>
                    <X size={14} /> Reject
                  </button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(r)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Review"
        message={`Delete review by ${deleteTarget?.customer_name}? This is permanent.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
