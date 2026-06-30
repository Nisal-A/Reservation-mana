/**
 * Reviews.jsx — Customer Reviews Page
 * Customers can rate and review their completed stays.
 */
import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState, StatusBadge } from '../../components/UI';

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 1.5 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= (hover || value) ? 'filled' : ''}`}
          style={{ fontSize: `${size}rem`, cursor: onChange ? 'pointer' : 'default' }}
          onClick={() => onChange && onChange(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function StarDisplay({ value }) {
  return (
    <div className="star-display">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={`star ${n <= value ? 'filled' : ''}`}>★</span>
      ))}
    </div>
  );
}

export default function Reviews() {
  const [eligible, setEligible] = useState([]);
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // reservation to review
  const [rating,   setRating]   = useState(0);
  const [text,     setText]     = useState('');
  const [image,    setImage]    = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
    try {
      const [elRes, rvRes] = await Promise.all([
        api.get('/reviews/eligible'),
        api.get('/reviews'),
      ]);
      setEligible(elRes.data);
      setReviews(rvRes.data);
    } catch { toast.error('Failed to load reviews'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openReview = (res) => {
    setSelected(res);
    setRating(0);
    setText('');
    setImage(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (rating === 0) { toast.error('Please select a star rating'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('reservation_id', selected.reservation_id);
      fd.append('rating', rating);
      fd.append('review_text', text);
      if (image) fd.append('image', image);
      await api.post('/reviews', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Review submitted! It will appear after admin approval.');
      setSelected(null);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <PageLoader />;

  const unreviewed = eligible.filter(e => !e.reviewed);
  const reviewed   = eligible.filter(e => e.reviewed);

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="My Reviews"
        subtitle="Rate and review your completed stays"
      />

      {/* Eligible to review */}
      {unreviewed.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">⭐ Stays Awaiting Review</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
            {unreviewed.map(r => (
              <div key={r.reservation_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Room {r.room_number}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{r.room_type}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {r.check_in_date?.slice(0,10)} → {r.check_out_date?.slice(0,10)}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openReview(r)} style={{ marginTop: 8 }}>
                  ✍️ Write Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My submitted reviews */}
      <div className="section-title">📋 My Submitted Reviews</div>
      {reviews.length === 0 ? (
        <EmptyState icon="⭐" title="No reviews yet" message="Your reviews will appear here after you write them." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reviews.map(r => (
            <div key={r.review_id} className="review-card">
              <div className="review-header">
                <div>
                  <div style={{ fontWeight: 700 }}>Room {r.room_number} — {r.room_type}</div>
                  <StarDisplay value={r.rating} />
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.review_text && <p className="review-text">{r.review_text}</p>}
              {r.image_url && <img src={`http://localhost:3001${r.image_url}`} alt="Review" className="review-image" />}
              {r.status === 'pending' && (
                <div className="alert alert-info" style={{ marginTop: 12, fontSize: '0.82rem' }}>
                  ⏳ Your review is pending admin approval.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Review Room {selected.room_number}</div>
              <button className="icon-btn" onClick={() => setSelected(null)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="form-group" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
                <label className="form-label">Your Rating *</label>
                <StarRating value={rating} onChange={setRating} />
                {rating > 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-gold)', marginTop: 4 }}>
                    {['','Very Bad','Bad','Average','Good','Excellent'][rating]}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Your Review</label>
                <textarea className="form-input" rows={4} placeholder="Share your experience..." value={text} onChange={e => setText(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Add Photo (optional)</label>
                <input className="form-input" type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || rating === 0}>
                  {submitting ? 'Submitting...' : '⭐ Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
