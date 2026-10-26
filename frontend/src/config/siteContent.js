/**
 * siteContent.js
 * Single configuration object read by all public customer pages.
 * Empty values are omitted from rendering per AGENTS.md and prompt specification.
 */
export const siteContent = {
  hotelName: 'LuxeStay',
  tagline: '',
  address: '',
  phone: '+94 11 234 5678',
  email: '',
  mapEmbedUrl: 'none',
  logo: 'text logo',
  heroSlides: [
    {
      webp: '/site/hero-1-1920.webp',
      jpg: '/site/hero-1-1920.jpg',
      alt: 'LuxeStay luxury rooftop swimming pool and lounge at dusk with illuminated palm trees',
    },
    {
      webp: '/site/hero-2-1920.webp',
      jpg: '/site/hero-2-1920.jpg',
      alt: 'Couple enjoying sunset infinity pool overlooking the ocean framed by palm trees',
    },
  ],
  heroHeadline: '',
  heroSubtitle: '',
  about: '',
  services: [],
  checkInTime: '13:00',
  checkOutTime: '11:00',
  bookingPolicy: 'Cancellations must be made at least 24 hours prior to check-in. Payment is settled upon arrival at the hotel. Government-issued photo identification is required at check-in.',
};

export default siteContent;
