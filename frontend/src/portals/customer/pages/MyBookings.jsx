import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BedDouble, Calendar, ArrowRight, Bookmark } from 'lucide-react';
import api from '../../../api/axios';
import { formatLKR, formatDate, nightsBetween } from '../../../utils/format';
import { StatusText, Skeleton, Pagination, Eyebrow, GoldDivider } from '../../../components/UI';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 10;

export default function MyBookings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get('/reservations/my')
      .then((res) => {
        setBookings(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setBookings([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter bookings by tab
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (activeTab === 'upcoming') {
        return ['pending', 'confirmed', 'checked_in'].includes(b.status);
      }
      if (activeTab === 'completed') {
        return b.status === 'checked_out';
      }
      if (activeTab === 'cancelled') {
        return ['cancelled', 'no_show'].includes(b.status);
      }
      return true;
    });
  }, [bookings, activeTab]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredBookings.slice(start, start + PAGE_SIZE);
  }, [filteredBookings, page]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      upcoming: bookings.filter((b) => ['pending', 'confirmed', 'checked_in'].includes(b.status)).length,
      completed: bookings.filter((b) => b.status === 'checked_out').length,
      cancelled: bookings.filter((b) => ['cancelled', 'no_show'].includes(b.status)).length,
    };
  }, [bookings]);

  return (
    <div className="public-section my-bookings-page">
      <div className="public-container" style={{ maxWidth: 960 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Eyebrow text="GUEST ITINERARY" />
          <h1 className="font-serif" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', color: 'var(--text)', marginTop: 8 }}>
            My Stays & Bookings
          </h1>
          <GoldDivider />
        </div>

        {/* Tabs Bar */}
        <div className="my-bookings-tabs-bar" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              className={`my-bookings-tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="my-bookings-tab-count">
                {counts[tab.id] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="my-bookings-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-ui my-booking-skeleton-card">
                <Skeleton height="140px" width="180px" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, padding: 16 }}>
                  <Skeleton height="20px" width="40%" style={{ marginBottom: 12 }} />
                  <Skeleton height="24px" width="60%" style={{ marginBottom: 12 }} />
                  <Skeleton height="16px" width="80%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State per Tab */}
        {!loading && filteredBookings.length === 0 && (
          <div className="card-ui my-bookings-empty-card">
            <Bookmark size={44} style={{ color: 'var(--gold)', opacity: 0.7, margin: '0 auto 16px' }} />
            <h3 className="font-serif" style={{ fontSize: '1.4rem', color: 'var(--text)', marginBottom: 8 }}>
              {activeTab === 'upcoming' && 'No Upcoming Reservations'}
              {activeTab === 'completed' && 'No Completed Stays Yet'}
              {activeTab === 'cancelled' && 'No Cancelled Bookings'}
            </h3>
            <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '0 auto 24px', fontSize: '0.9rem' }}>
              {activeTab === 'upcoming' && 'You have no active or upcoming stays booked. Explore our handcrafted rooms and suites for your next getaway.'}
              {activeTab === 'completed' && 'You have not completed any stays with us yet. Once you check out, past reservation details will appear here.'}
              {activeTab === 'cancelled' && 'You have no cancelled or missed reservations recorded on this account.'}
            </p>
            <Link to="/rooms" className="btn-ui btn-ui-primary btn-ui-md">
              <BedDouble size={16} />
              <span>Browse rooms</span>
            </Link>
          </div>
        )}

        {/* Bookings List (Horizontal Cards) */}
        {!loading && filteredBookings.length > 0 && (
          <div className="my-bookings-list">
            {paginatedList.map((booking) => {
              const nights = nightsBetween(booking.check_in_date, booking.check_out_date) || 1;
              const imagesArr = booking.room_images
                ? (typeof booking.room_images === 'string' ? JSON.parse(booking.room_images || '[]') : booking.room_images)
                : [];
              const thumbUrl = imagesArr[0] || booking.room_image_url || null;

              return (
                <article key={booking.reservation_id} className="card-ui my-booking-card">
                  {/* Thumbnail */}
                  <div className="my-booking-media">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={booking.room_type} />
                    ) : (
                      <div className="my-booking-media-placeholder">
                        <BedDouble size={32} style={{ color: 'var(--gold)', opacity: 0.6, marginBottom: 4 }} />
                        <span className="font-serif" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {booking.room_type}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Details */}
                  <div className="my-booking-body">
                    <div className="my-booking-top-row">
                      <div>
                        <span className="eyebrow" style={{ fontSize: '0.72rem' }}>
                          {booking.room_type}
                        </span>
                        <h2 className="font-serif my-booking-suite-title">
                          {booking.room_type} Suite {booking.room_number ? `(Room ${booking.room_number})` : ''}
                        </h2>
                      </div>
                      <div className="my-booking-status-tag">
                        <StatusText status={booking.status} />
                      </div>
                    </div>

                    <div className="my-booking-meta-row">
                      <div className="my-booking-meta-item">
                        <Calendar size={13} style={{ color: 'var(--gold)' }} />
                        <span>
                          {formatDate(booking.check_in_date)} – {formatDate(booking.check_out_date)}
                        </span>
                      </div>
                      <span className="my-booking-meta-divider">•</span>
                      <span className="my-booking-meta-nights">
                        {nights} {nights === 1 ? 'night' : 'nights'}
                      </span>
                    </div>

                    <div className="my-booking-bottom-row">
                      <div className="my-booking-ref-block">
                        <span className="my-booking-ref-label">Reference</span>
                        <span className="my-booking-ref-val font-mono">
                          {booking.booking_ref}
                        </span>
                      </div>

                      <div className="my-booking-price-block">
                        <span className="my-booking-price-label">Total</span>
                        <span className="my-booking-price-val font-serif">
                          {formatLKR(booking.total_amount)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn-ui btn-ui-secondary btn-ui-sm my-booking-view-btn"
                        onClick={() => navigate(`/account/bookings/${booking.booking_ref}`)}
                      >
                        <span>View details</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination (10 per page) */}
        {!loading && totalPages > 1 && (
          <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
