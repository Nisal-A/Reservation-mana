import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Star,
  UploadCloud,
  MessageSquare,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { assetUrl } from '../../../config/env';
import { formatDate } from '../../../utils/format';
import {
  Button,
  FormField,
  Textarea,
  RatingStars,
  StatusText,
  Eyebrow,
  EmptyState,
  Skeleton,
} from '../../../components/UI';

export default function Reviews() {
  const [searchParams] = useSearchParams();
  const requestedResId = searchParams.get('reservation_id');

  const [eligibleStays, setEligibleStays] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedResId, setSelectedResId] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  // Fetch eligible stays and existing customer reviews
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eligibleRes, reviewsRes] = await Promise.all([
        api.get('/reviews/eligible'),
        api.get('/reviews'),
      ]);

      const eligibleList = Array.isArray(eligibleRes.data)
        ? eligibleRes.data.filter((s) => Number(s.reviewed) === 0)
        : [];
      setEligibleStays(eligibleList);

      const customerReviews = Array.isArray(reviewsRes.data) ? reviewsRes.data : [];
      setReviews(customerReviews);

      // Auto-select requested reservation ID or default to first eligible stay
      if (requestedResId && eligibleList.some((s) => String(s.reservation_id) === String(requestedResId))) {
        setSelectedResId(String(requestedResId));
      } else if (eligibleList.length > 0) {
        setSelectedResId(String(eligibleList[0].reservation_id));
      } else {
        setSelectedResId('');
      }
    } catch {
      toast.error('Failed to load reviews information.');
    } finally {
      setLoading(false);
    }
  }, [requestedResId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle file select (.jpg, .jpeg, .png, .webp, max 5MB)
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFormErrors((prev) => ({
        ...prev,
        image: 'Only .jpg, .png, and .webp images are allowed.',
      }));
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setFormErrors((prev) => ({
        ...prev,
        image: 'Image file size must not exceed 5MB.',
      }));
      return;
    }

    setFormErrors((prev) => ({ ...prev, image: null }));
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errors = {};
    if (!selectedResId) {
      errors.reservation_id = 'Please select a completed stay to review.';
    }
    if (!rating || rating < 1 || rating > 5) {
      errors.rating = 'Please choose a rating between 1 and 5 stars.';
    }
    if (reviewText && reviewText.length > 1000) {
      errors.review_text = 'Review cannot exceed 1000 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('reservation_id', selectedResId);
      formData.append('rating', String(rating));
      if (reviewText.trim()) {
        formData.append('review_text', reviewText.trim());
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await api.post('/reviews', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(res.data.message || 'Review submitted successfully! It will appear once approved.');

      // Reset form
      setReviewText('');
      setRating(5);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh list
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit review.';
      toast.error(msg);
      if (err.response?.data?.errors) {
        const fieldErrors = {};
        err.response.data.errors.forEach((eItem) => {
          if (eItem.path?.[0]) fieldErrors[eItem.path[0]] = eItem.message;
        });
        setFormErrors(fieldErrors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="public-section">
        <div className="public-container" style={{ maxWidth: 880 }}>
          <Skeleton height={32} width={220} style={{ marginBottom: 12 }} />
          <Skeleton height={18} width={360} style={{ marginBottom: 32 }} />
          <Skeleton height={320} style={{ marginBottom: 32 }} />
          <Skeleton height={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="public-section reviews-page">
      <div className="public-container" style={{ maxWidth: 880 }}>
        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Eyebrow text="GUEST EXPERIENCES" />
          <h1
            className="font-serif"
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
              color: 'var(--text)',
              marginTop: 8,
              marginBottom: 10,
            }}
          >
            My Reviews & Feedback
          </h1>
          <p style={{ color: 'var(--text-body)', margin: 0, fontSize: 14 }}>
            Share your experience for completed stays and see your past reviews.
          </p>
        </div>

        {/* SECTION 1: Review Submission */}
        {eligibleStays.length > 0 ? (
          <div className="lux-card" style={{ padding: 32, marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Star size={20} style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>
                Write a Review
              </h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--muted)' }}>
              Select a completed stay to review. All reviews undergo brief moderation before publishing.
            </p>

            <form onSubmit={handleSubmitReview} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Stay Selector */}
                <FormField
                  label="Completed Stay"
                  required
                  error={formErrors.reservation_id}
                >
                  <select
                    className="select-ui"
                    value={selectedResId}
                    onChange={(e) => {
                      setSelectedResId(e.target.value);
                      if (formErrors.reservation_id) {
                        setFormErrors({ ...formErrors, reservation_id: null });
                      }
                    }}
                  >
                    {eligibleStays.map((stay) => (
                      <option key={stay.reservation_id} value={stay.reservation_id}>
                        {stay.room_type} (Ref: {stay.booking_ref}) · {formatDate(stay.check_in_date)} to {formatDate(stay.check_out_date)}
                      </option>
                    ))}
                  </select>
                </FormField>

                {/* Rating Stars Input */}
                <FormField
                  label="Your Rating"
                  required
                  error={formErrors.rating}
                  hint="Select 1 to 5 stars for your stay."
                >
                  <div style={{ padding: '6px 0' }}>
                    <RatingStars
                      value={rating}
                      onChange={(val) => {
                        setRating(val);
                        if (formErrors.rating) setFormErrors({ ...formErrors, rating: null });
                      }}
                      size={28}
                    />
                  </div>
                </FormField>

                {/* Review Text */}
                <FormField
                  label="Review Comments"
                  error={formErrors.review_text}
                  hint={`${1000 - reviewText.length} characters remaining`}
                >
                  <Textarea
                    placeholder="Describe your stay, the room comfort, amenities, and hospitality..."
                    rows={4}
                    maxLength={1000}
                    value={reviewText}
                    onChange={(e) => {
                      setReviewText(e.target.value);
                      if (formErrors.review_text) {
                        setFormErrors({ ...formErrors, review_text: null });
                      }
                    }}
                    error={formErrors.review_text}
                  />
                </FormField>

                {/* Optional Photo Upload */}
                <FormField
                  label="Add a Photo (Optional)"
                  error={formErrors.image}
                  hint="Upload a photo from your stay (.jpg, .png, .webp, max 5MB)."
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {!imagePreview ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: '1px dashed var(--border-strong)',
                          borderRadius: 'var(--radius)',
                          padding: '24px 16px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: 'rgba(255, 255, 255, 0.01)',
                          transition: 'border-color 0.2s',
                        }}
                      >
                        <UploadCloud size={28} style={{ color: 'var(--gold)', margin: '0 auto 8px' }} />
                        <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                          Click to select a photo
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                          JPEG, PNG, or WEBP up to 5MB
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 10,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          maxWidth: 320,
                        }}
                      >
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{
                            width: 64,
                            height: 64,
                            objectFit: 'cover',
                            borderRadius: 'var(--radius)',
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              color: 'var(--text)',
                              fontSize: 13,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {imageFile?.name}
                          </div>
                          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                            {(imageFile ? imageFile.size / 1024 / 1024 : 0).toFixed(2)} MB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          aria-label="Remove photo"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </div>
                </FormField>

                {/* Submit Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                  >
                    Submit Review
                  </Button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div
            className="lux-card"
            style={{
              padding: 24,
              marginBottom: 48,
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 14 }}>
              You do not have any pending completed stays to review. Reviews can be submitted once a stay is checked out.
            </p>
          </div>
        )}

        {/* SECTION 2: Customer's Existing Reviews */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <MessageSquare size={20} style={{ color: 'var(--gold)' }} />
            <h2 className="font-serif" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>
              My Past Reviews
            </h2>
          </div>

          {reviews.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={44} />}
              title="No Reviews Yet"
              message="Your submitted reviews will appear here along with their moderation status."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {reviews.map((rev) => (
                <div
                  key={rev.review_id}
                  className="lux-card"
                  style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 16 }}>
                          {rev.room_type || 'Room Stay'}
                        </span>
                        {rev.room_number && (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            · Room {rev.room_number}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <RatingStars value={rev.rating} readOnly size={15} />
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          · {formatDate(rev.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Moderation StatusText: pending, approved, rejected */}
                    <div>
                      <StatusText status={rev.status} />
                    </div>
                  </div>

                  {/* Review Text */}
                  {rev.review_text && (
                    <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 14, lineHeight: 1.6 }}>
                      {rev.review_text}
                    </p>
                  )}

                  {/* Photo thumbnail */}
                  {rev.image_url && (
                    <div>
                      <a
                        href={assetUrl(rev.image_url)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-block' }}
                      >
                        <img
                          src={assetUrl(rev.image_url)}
                          alt="Review attachment"
                          style={{
                            maxWidth: 160,
                            maxHeight: 120,
                            objectFit: 'cover',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                          }}
                        />
                      </a>
                    </div>
                  )}

                  {/* Admin Note if any */}
                  {rev.admin_note && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(200, 169, 106, 0.05)',
                        borderLeft: '2px solid var(--gold)',
                        borderRadius: '0 var(--radius) var(--radius) 0',
                        fontSize: 13,
                        color: 'var(--text-body)',
                      }}
                    >
                      <strong style={{ color: 'var(--gold)', display: 'block', marginBottom: 2 }}>
                        Hotel Response:
                      </strong>
                      {rev.admin_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
