// frontend/src/pages/admin/ReviewsAdmin.jsx
// Admin Review Moderation page
// Tabs: Pending, Approved, Rejected.
// Each review card shows rating, text, image (via assetUrl), customer, room type, and stay dates.
// Actions: Approve, Reject (with optional admin note), and Delete (ConfirmModal).
// Approved reviews are what the public site displays.

import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  XCircle,
  Trash2,
  Calendar,
  BedDouble,
  Clock,
  CheckCircle,
  MessageSquare,
  Sparkles,
  Info,
  Maximize2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { assetUrl } from '../../config/env';
import { formatDate } from '../../utils/format';
import {
  Button,
  StatusText,
  Modal,
  ConfirmModal,
  PageHeader,
  FormField,
  Textarea,
  RatingStars,
  Skeleton,
  EmptyState,
} from '../../components/UI';

const TABS = [
  { id: 'pending', label: 'Pending Moderation', icon: Clock },
  { id: 'approved', label: 'Approved (Public)', icon: CheckCircle },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
];

export default function ReviewsAdmin() {
  const [activeTab, setActiveTab] = useState('pending');
  const [reviews, setReviews] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  // Reject Modal State
  const [rejectTarget, setRejectTarget] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Lightbox Image Preview
  const [previewImage, setPreviewImage] = useState(null);

  // Action loading per review
  const [actionInProgress, setActionInProgress] = useState(null);

  // Fetch reviews for current active tab
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reviews', {
        params: { status: activeTab },
      });
      setReviews(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch overall counts across all three statuses for badges
  const fetchCounts = useCallback(async () => {
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        api.get('/reviews', { params: { status: 'pending' } }),
        api.get('/reviews', { params: { status: 'approved' } }),
        api.get('/reviews', { params: { status: 'rejected' } }),
      ]);
      setCounts({
        pending: pendingRes.data.length,
        approved: approvedRes.data.length,
        rejected: rejectedRes.data.length,
      });
    } catch {
      // Ignore count errors
    }
  }, []);

  useEffect(() => {
    fetchReviews();
    fetchCounts();
  }, [fetchReviews, fetchCounts]);

  // Approve review handler
  const handleApprove = async (review) => {
    setActionInProgress(review.review_id);
    try {
      await api.patch(`/reviews/${review.review_id}/approve`, {});
      toast.success(`Review from ${review.customer_name} approved! It is now live on the public site.`);
      fetchReviews();
      fetchCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve review');
    } finally {
      setActionInProgress(null);
    }
  };

  // Open Reject Modal
  const handleOpenReject = (review) => {
    setRejectTarget(review);
    setAdminNote(review.admin_note || '');
  };

  // Submit Reject
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectTarget) return;

    setRejectLoading(true);
    try {
      await api.patch(`/reviews/${rejectTarget.review_id}/reject`, {
        admin_note: adminNote.trim() || null,
      });
      toast.success(`Review from ${rejectTarget.customer_name} has been rejected.`);
      setRejectTarget(null);
      setAdminNote('');
      fetchReviews();
      fetchCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject review');
    } finally {
      setRejectLoading(false);
    }
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/reviews/${deleteTarget.review_id}`);
      toast.success('Review permanently deleted.');
      setDeleteTarget(null);
      fetchReviews();
      fetchCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete review');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Review Moderation"
        subtitle="Review guest feedback, moderate testimonials, and curate what appears on the public website"
      />

      {/* Info Callout */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: 24,
          background: 'rgba(200, 169, 106, 0.06)',
          border: '1px solid rgba(200, 169, 106, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Sparkles size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
          Only <strong>Approved</strong> reviews are displayed to guests on the public website homepage and rooms pages.
          Pending reviews await staff verification before publishing.
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
        }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id] || 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                border: 'none',
                background: 'transparent',
                color: isActive ? 'var(--gold)' : 'var(--muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9rem',
                borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(200, 169, 106, 0.2)' : 'var(--input)',
                  color: isActive ? 'var(--gold)' : 'var(--muted)',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Review List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton height="24px" width="180px" />
                <Skeleton height="24px" width="120px" />
              </div>
              <Skeleton height="18px" width="60%" />
              <Skeleton height="40px" width="100%" />
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <Skeleton height="36px" width="100px" />
                <Skeleton height="36px" width="100px" />
              </div>
            </div>
          ))
        ) : reviews.length === 0 ? (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <EmptyState
              icon={MessageSquare}
              title={`No ${activeTab} reviews`}
              message={
                activeTab === 'pending'
                  ? 'Great job! There are currently no pending reviews awaiting moderation.'
                  : activeTab === 'approved'
                  ? 'No approved reviews yet. Moderate incoming guest reviews to publish them on the public site.'
                  : 'No reviews have been rejected.'
              }
            />
          </div>
        ) : (
          reviews.map((r) => {
            const hasImage = Boolean(r.image_url);
            const isProcessing = actionInProgress === r.review_id;

            return (
              <div
                key={r.review_id}
                className="card"
                style={{
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  position: 'relative',
                  borderLeft:
                    r.status === 'approved'
                      ? '4px solid var(--success)'
                      : r.status === 'rejected'
                      ? '4px solid var(--danger)'
                      : '4px solid var(--warning)',
                }}
              >
                {/* Header: Customer, Rating, Status badge */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'rgba(200, 169, 106, 0.15)',
                        color: 'var(--gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1rem',
                        border: '1px solid rgba(200, 169, 106, 0.3)',
                      }}
                    >
                      {(r.customer_name || 'G').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>
                          {r.customer_name || 'Guest'}
                        </span>
                        <StatusText
                          status={
                            r.status === 'approved'
                              ? 'confirmed'
                              : r.status === 'rejected'
                              ? 'cancelled'
                              : 'pending'
                          }
                        >
                          {r.status.toUpperCase()}
                        </StatusText>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                        Submitted {r.created_at ? formatDate(r.created_at) : 'recently'}
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RatingStars value={r.rating} readOnly size={18} />
                    <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.95rem' }}>
                      {Number(r.rating).toFixed(1)} / 5.0
                    </span>
                  </div>
                </div>

                {/* Stay Metadata: Room & Stay Dates */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 18,
                    padding: '10px 14px',
                    borderRadius: 4,
                    background: 'var(--input)',
                    border: '1px solid var(--border)',
                    fontSize: '0.83rem',
                    color: 'var(--text-body)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BedDouble size={15} style={{ color: 'var(--gold)' }} />
                    <span>
                      Room <strong>{r.room_number || '—'}</strong> ({r.room_type || 'Standard'})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={15} style={{ color: 'var(--gold)' }} />
                    <span>
                      Stay:{' '}
                      <strong>
                        {r.check_in_date ? formatDate(r.check_in_date) : '—'} to{' '}
                        {r.check_out_date ? formatDate(r.check_out_date) : '—'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Review Content & Image */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <p
                      style={{
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        color: 'var(--text)',
                        fontStyle: 'italic',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      "{r.review_text || 'No written comment provided.'}"
                    </p>

                    {/* Admin Note if present */}
                    {r.admin_note && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: '8px 12px',
                          borderRadius: 4,
                          background: 'rgba(248, 113, 113, 0.08)',
                          border: '1px solid rgba(248, 113, 113, 0.25)',
                          fontSize: '0.82rem',
                          color: 'var(--danger)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Info size={14} style={{ flexShrink: 0 }} />
                        <span>
                          <strong>Admin Note:</strong> {r.admin_note}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Attached photo thumbnail via assetUrl */}
                  {hasImage && (
                    <div
                      style={{
                        position: 'relative',
                        width: 120,
                        height: 90,
                        borderRadius: 4,
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      onClick={() => setPreviewImage(assetUrl(r.image_url))}
                      title="Click to expand guest photo"
                    >
                      <img
                        src={assetUrl(r.image_url)}
                        alt={`Review photo by ${r.customer_name}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: 4,
                          bottom: 4,
                          background: 'rgba(0,0,0,0.7)',
                          borderRadius: 3,
                          padding: 2,
                          color: '#fff',
                          display: 'flex',
                        }}
                      >
                        <Maximize2 size={12} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingTop: 14,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Approve Button */}
                    {r.status !== 'approved' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(r)}
                        disabled={isProcessing}
                        loading={isProcessing}
                      >
                        <Check size={14} /> Approve Review
                      </Button>
                    )}

                    {/* Reject Button (with modal for optional admin note) */}
                    {r.status !== 'rejected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReject(r)}
                        disabled={isProcessing}
                      >
                        <XCircle size={14} /> Reject
                      </Button>
                    )}
                  </div>

                  {/* Delete Button (ConfirmModal) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(r)}
                    disabled={isProcessing}
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. REJECT MODAL (Optional Admin Note)
         ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => !rejectLoading && setRejectTarget(null)}
        title="Reject Review"
        size="md"
      >
        <form onSubmit={handleRejectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
            Rejecting this review will hide it from the public website. You may optionally attach an administrative note explaining the decision.
          </div>

          {rejectTarget && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 4,
                background: 'var(--input)',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Review from {rejectTarget.customer_name} ({Number(rejectTarget.rating).toFixed(1)} / 5.0 Stars)
              </div>
              <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                "{rejectTarget.review_text || 'No comment text'}"
              </div>
            </div>
          )}

          <FormField label="Admin Note (Optional)" hint="Add reason for moderation archive">
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Inappropriate language, off-topic content, or policy breach..."
              rows={3}
              maxLength={255}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejectLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={rejectLoading}
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
            >
              Reject Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          2. CONFIRM DELETE MODAL
         ───────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSubmit}
        title="Delete Customer Review"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete this review from ${deleteTarget.customer_name}? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Review"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteLoading}
      />

      {/* ─────────────────────────────────────────────────────────────
          3. IMAGE LIGHTBOX MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title="Attached Guest Photo"
        size="lg"
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 10 }}>
          {previewImage && (
            <img
              src={previewImage}
              alt="Review preview"
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                borderRadius: 4,
                objectFit: 'contain',
              }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
