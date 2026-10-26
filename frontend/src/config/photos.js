/**
 * frontend/src/config/photos.js
 * Centralized registry for the prepared hotel photography.
 */

export const heroPhotos = [
  {
    id: 'hero-1',
    webp: '/site/hero-1-1920.webp',
    jpg: '/site/hero-1-1920.jpg',
    cardWebp: '/site/hero-1-800.webp',
    cardJpg: '/site/hero-1-800.jpg',
    alt: 'LuxeStay luxury rooftop swimming pool and lounge at dusk with illuminated palm trees',
  },
  {
    id: 'hero-2',
    webp: '/site/hero-2-1920.webp',
    jpg: '/site/hero-2-1920.jpg',
    cardWebp: '/site/hero-2-800.webp',
    cardJpg: '/site/hero-2-800.jpg',
    alt: 'Couple enjoying sunset infinity pool overlooking the ocean framed by palm trees',
  },
];

export const aboutPhoto = {
  id: 'about',
  webp: '/site/hero-1-1920.webp',
  jpg: '/site/hero-1-1920.jpg',
  cardWebp: '/site/hero-1-800.webp',
  cardJpg: '/site/hero-1-800.jpg',
  alt: 'LuxeStay resort architecture and twilight poolside terrace',
};

/**
 * Deterministically returns one of the prepared photos based on roomType or roomId.
 * Same room always gets the exact same photo.
 *
 * @param {string|number} [roomTypeOrId]
 * @returns {{ webp: string, jpg: string, cardWebp: string, cardJpg: string, alt: string, id: string }}
 */
export function getRoomFallbackPhoto(roomTypeOrId) {
  if (roomTypeOrId === undefined || roomTypeOrId === null) {
    return heroPhotos[0];
  }

  const str = String(roomTypeOrId).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }

  return heroPhotos[hash % heroPhotos.length];
}

export default {
  heroPhotos,
  aboutPhoto,
  getRoomFallbackPhoto,
};
