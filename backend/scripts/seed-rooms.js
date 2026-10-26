const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

// Minimal valid 1x1 JPEG buffer to guarantee real image bytes if none provided
const SAMPLE_JPEG = Buffer.from([
  0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x01,0x01,0x00,0x48,
  0x00,0x48,0x00,0x00,0xff,0xdb,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,
  0x07,0x07,0x07,0x09,0x09,0x08,0x0a,0x0c,0x14,0x0d,0x0c,0x0b,0x0b,0x0c,0x19,0x12,
  0x13,0x0f,0x14,0x1d,0x1a,0x1f,0x1e,0x1d,0x1a,0x1c,0x1c,0x20,0x24,0x2e,0x27,0x20,
  0x22,0x2c,0x23,0x1c,0x1c,0x28,0x37,0x29,0x2c,0x30,0x31,0x34,0x34,0x34,0x1f,0x27,
  0x39,0x3d,0x38,0x32,0x3c,0x2e,0x33,0x34,0x32,0xff,0xc0,0x00,0x0b,0x08,0x00,0x01,
  0x00,0x01,0x01,0x01,0x11,0x00,0xff,0xc4,0x00,0x1f,0x00,0x00,0x01,0x05,0x01,0x01,
  0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,
  0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0xff,0xda,0x00,0x08,0x01,0x01,0x00,0x00,0x3f,
  0x00,0xbf,0x80,0xff,0xd9
]);

const ROOMS_DATA = [
  {
    room_number: '101',
    room_type: 'Single',
    price: 80.00,
    capacity: 1,
    bed_type: 'Queen Bed',
    size_sqm: 25,
    view_label: 'City View',
    amenities: ['Free Wi-Fi', 'En-suite Bathroom', 'Smart TV', 'Air Conditioning', 'Work Desk'],
    image_name: 'single-1.jpg',
    description: 'Cozy single room with city view, queen bed, and modern amenities.',
    status: 'available',
  },
  {
    room_number: '102',
    room_type: 'Single',
    price: 80.00,
    capacity: 1,
    bed_type: 'Queen Bed',
    size_sqm: 25,
    view_label: 'Garden View',
    amenities: ['Free Wi-Fi', 'En-suite Bathroom', 'Smart TV', 'Air Conditioning', 'Garden Balcony'],
    image_name: 'single-2.jpg',
    description: 'Comfortable single room with garden view and en-suite bathroom.',
    status: 'available',
  },
  {
    room_number: '201',
    room_type: 'Double',
    price: 140.00,
    capacity: 2,
    bed_type: 'King Bed',
    size_sqm: 40,
    view_label: 'Sea View',
    amenities: ['Free Wi-Fi', 'King Bed', 'Flat-screen TV', 'Mini-bar', 'Balcony', 'Ocean Breeze'],
    image_name: 'double-1.jpg',
    description: 'Spacious double room with king bed, flat-screen TV, and mini-bar.',
    status: 'available',
  },
  {
    room_number: '202',
    room_type: 'Double',
    price: 140.00,
    capacity: 2,
    bed_type: 'King Bed',
    size_sqm: 40,
    view_label: 'Panoramic Sea View',
    amenities: ['Free Wi-Fi', 'King Bed', 'Flat-screen TV', 'Mini-bar', 'Private Balcony', 'Ocean Breeze'],
    image_name: 'double-2.jpg',
    description: 'Elegant double room with panoramic sea view and private balcony.',
    status: 'available',
  },
  {
    room_number: '301',
    room_type: 'Suite',
    price: 280.00,
    capacity: 4,
    bed_type: 'King Bed & Sofa Bed',
    size_sqm: 85,
    view_label: 'Mountain & Pool View',
    amenities: ['Free Wi-Fi', 'Jacuzzi', 'Separate Living Area', 'Butler Service', 'Private Pool Access', 'Espresso Machine'],
    image_name: 'suite-1.jpg',
    description: 'Luxurious suite with separate living area, jacuzzi, and premium amenities.',
    status: 'available',
  },
  {
    room_number: '302',
    room_type: 'Suite',
    price: 280.00,
    capacity: 4,
    bed_type: 'King Bed & Sofa Bed',
    size_sqm: 85,
    view_label: 'Mountain View',
    amenities: ['Free Wi-Fi', 'Jacuzzi', 'Private Balcony', 'Butler Service', 'Private Pool Access'],
    image_name: 'suite-2.jpg',
    description: 'Grand suite with butler service, private pool access, and mountain view.',
    status: 'maintenance',
  },
  {
    room_number: '401',
    room_type: 'Deluxe',
    price: 220.00,
    capacity: 2,
    bed_type: 'King Bed',
    size_sqm: 55,
    view_label: 'Rooftop Skyline',
    amenities: ['Free Wi-Fi', 'King Bed', 'Lounge Area', 'Rooftop Access', 'Rain Shower', 'Complimentary Breakfast'],
    image_name: 'deluxe-1.jpg',
    description: 'Premium deluxe room with king bed, lounge area, and rooftop access.',
    status: 'available',
  },
  {
    room_number: '402',
    room_type: 'Deluxe',
    price: 220.00,
    capacity: 2,
    bed_type: 'King Bed',
    size_sqm: 55,
    view_label: 'Ocean & Skyline View',
    amenities: ['Free Wi-Fi', 'Smart Home Controls', 'Lounge Area', 'Exclusive Lounge Access', 'Mini-bar'],
    image_name: 'deluxe-2.jpg',
    description: 'Modern deluxe room with smart home features and exclusive lounge access.',
    status: 'available',
  },
];

async function seedRooms() {
  // 1. Check if rooms table is empty
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM rooms');
  if (rows[0].count > 0) {
    console.log(`Rooms table already contains ${rows[0].count} rooms. Never overwriting existing rooms.`);
    process.exit(0);
  }

  console.log('Rooms table is empty. Starting room seeding...');

  // 2. Setup target photos directory
  const destDir = path.join(__dirname, '../public/uploads/rooms');
  fs.mkdirSync(destDir, { recursive: true });

  // 3. Copy photos from custom source folder if specified via CLI or env
  const args = process.argv.slice(2);
  const photosDirIndex = args.indexOf('--photos-dir');
  const photosDirArg = photosDirIndex !== -1 ? args[photosDirIndex + 1] : null;
  const sourceFolder = photosDirArg || process.env.ROOM_PHOTOS_FOLDER || null;

  if (sourceFolder && fs.existsSync(sourceFolder)) {
    console.log(`Copying photos from ${sourceFolder} to ${destDir}...`);
    const files = fs.readdirSync(sourceFolder);
    for (const file of files) {
      fs.copyFileSync(path.join(sourceFolder, file), path.join(destDir, file));
    }
  }

  // 4. Ensure each room has an image on disk
  for (const r of ROOMS_DATA) {
    const filePath = path.join(destDir, r.image_name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, SAMPLE_JPEG);
    }
  }

  // 5. Insert rooms
  for (let idx = 0; idx < ROOMS_DATA.length; idx++) {
    const r = ROOMS_DATA[idx];
    const isEven = idx % 2 === 1;
    const primary = isEven ? '/site/hero-2-800.webp' : '/site/hero-1-800.webp';
    const secondary = isEven ? '/site/hero-1-800.webp' : '/site/hero-2-800.webp';
    const imagesArray = JSON.stringify([primary, secondary]);
    const amenitiesJson = JSON.stringify(r.amenities);

    await pool.query(
      `INSERT INTO rooms (
        room_number, room_type, price, capacity, bed_type,
        size_sqm, view_label, amenities, images, image_url,
        description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.room_number,
        r.room_type,
        r.price,
        r.capacity,
        r.bed_type,
        r.size_sqm,
        r.view_label,
        amenitiesJson,
        imagesArray,
        primary,
        r.description,
        r.status,
      ]
    );
    console.log(`Inserted Room ${r.room_number} (${r.room_type})`);
  }

  console.log('✅ Room seeding completed successfully.');
  process.exit(0);
}

seedRooms().catch((err) => {
  console.error('❌ Error seeding rooms:', err);
  process.exit(1);
});
