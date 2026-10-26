import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import api from '../../../api/axios';
import { siteContent } from '../../../config/siteContent';
import { aboutPhoto } from '../../../config/photos';
import HeroSlider from '../components/HeroSlider';
import SearchBar from '../components/SearchBar';
import RoomCard from '../components/RoomCard';
import ServicesList from '../components/ServicesList';
import ReviewCarousel from '../components/ReviewCarousel';
import { SectionTitle, Skeleton } from '../../../components/UI';

export default function Home() {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState(null);

  const fetchRoomTypes = () => {
    setLoadingRooms(true);
    setRoomsError(null);
    api.get('/public/room-types')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setRoomTypes(res.data.slice(0, 4));
        } else {
          setRoomTypes([]);
        }
      })
      .catch((err) => {
        setRoomsError(err.response?.data?.message || 'Failed to load featured suites.');
      })
      .finally(() => setLoadingRooms(false));
  };

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  const hasContactInfo = siteContent.address || siteContent.phone || siteContent.email || (siteContent.mapEmbedUrl && siteContent.mapEmbedUrl !== 'none');

  return (
    <div className="customer-home-page">
      {/* 1 & 2: Hero Slider & Floating SearchBar */}
      <HeroSlider>
        <SearchBar />
      </HeroSlider>

      {/* 3: Rooms and Suites */}
      <section className="public-section rooms-suite-section" aria-label="Rooms and Suites">
        <div className="public-container">
          <div className="section-header-row">
            <SectionTitle
              eyebrow="Accommodations"
              title="Rooms & Suites"
              subtitle="Immerse yourself in understated elegance, hand-crafted furnishings, and serene privacy."
            />
            <Link
              to="/rooms"
              className="btn-ui btn-ui-secondary btn-ui-md view-all-desktop-btn"
            >
              <span>View all rooms</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Loading Skeleton */}
          {loadingRooms && (
            <div className="rooms-grid-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card-ui" style={{ padding: 0, overflow: 'hidden' }}>
                  <Skeleton height="208px" />
                  <div style={{ padding: 20 }}>
                    <Skeleton height="24px" width="60%" style={{ marginBottom: 12 }} />
                    <Skeleton height="16px" width="80%" style={{ marginBottom: 16 }} />
                    <Skeleton height="20px" width="40%" style={{ marginBottom: 20 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Skeleton height="36px" width="50%" />
                      <Skeleton height="36px" width="50%" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State with Retry */}
          {roomsError && (
            <div className="error-state-ui">
              <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{roomsError}</p>
              <button
                type="button"
                className="btn-ui btn-ui-secondary btn-ui-sm"
                onClick={fetchRoomTypes}
              >
                <RefreshCw size={15} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Rooms Grid 1 / 2 / 4 columns */}
          {!loadingRooms && !roomsError && roomTypes.length > 0 && (
            <div className="rooms-grid-4">
              {roomTypes.map((room) => (
                <RoomCard key={room.room_type} room={room} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingRooms && !roomsError && roomTypes.length === 0 && (
            <div className="empty-state-ui">
              <Sparkles size={32} style={{ color: 'var(--gold)', marginBottom: 12 }} />
              <h3 className="empty-state-title">No Rooms Available</h3>
              <p className="empty-state-text">Check back soon for available suites and villas.</p>
            </div>
          )}

          {/* Mobile View All Button */}
          <div className="view-all-mobile-wrapper">
            <Link
              to="/rooms"
              className="btn-ui btn-ui-secondary btn-ui-md"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>View all rooms</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 4: About Section */}
      <section className="public-section about-section" aria-label="About LuxeStay">
        <div className="public-container">
          <div className="about-card-ui">
            <div className="about-grid">
              <div className="about-text-content">
                <SectionTitle
                  eyebrow="Our Story"
                  title={`Welcome to ${siteContent.hotelName || 'LuxeStay'}`}
                  subtitle={siteContent.about || siteContent.tagline}
                />
              </div>
              <div className="about-image-wrapper">
                <picture className="about-picture">
                  <source srcSet={aboutPhoto.cardWebp} type="image/webp" />
                  <img
                    src={aboutPhoto.cardJpg}
                    alt={aboutPhoto.alt}
                    loading="lazy"
                    className="about-image"
                  />
                </picture>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5: Services & Amenities */}
      <ServicesList />

      {/* 6: Guest Testimonials Carousel */}
      <ReviewCarousel />

      {/* 7: Contact Block */}
      {hasContactInfo && (
        <section id="contact" className="public-section contact-section" aria-label="Contact Information">
          <div className="public-container">
            <SectionTitle
              eyebrow="Get In Touch"
              title="Connect With Concierge"
              subtitle="We are delighted to assist with reservations, bespoke requests, and private transfers."
            />

            <div className={`contact-layout-grid ${siteContent.mapEmbedUrl && siteContent.mapEmbedUrl !== 'none' ? 'with-map' : 'no-map'}`}>
              <div className="contact-details-card">
                {siteContent.address && (
                  <div className="contact-item">
                    <div className="contact-icon-box">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <span className="contact-item-label">Location</span>
                      <p className="contact-item-val">{siteContent.address}</p>
                    </div>
                  </div>
                )}

                {siteContent.phone && (
                  <div className="contact-item">
                    <div className="contact-icon-box">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="contact-item-label">Telephone</span>
                      <a href={`tel:${siteContent.phone}`} className="contact-item-link">
                        {siteContent.phone}
                      </a>
                    </div>
                  </div>
                )}

                {siteContent.email && (
                  <div className="contact-item">
                    <div className="contact-icon-box">
                      <Mail size={20} />
                    </div>
                    <div>
                      <span className="contact-item-label">Email</span>
                      <a href={`mailto:${siteContent.email}`} className="contact-item-link">
                        {siteContent.email}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Map Iframe when mapEmbedUrl is not 'none' */}
              {siteContent.mapEmbedUrl && siteContent.mapEmbedUrl !== 'none' && (
                <div className="contact-map-card">
                  <iframe
                    title="Hotel Location Map"
                    src={siteContent.mapEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0, minHeight: '320px', borderRadius: 'var(--radius)' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
