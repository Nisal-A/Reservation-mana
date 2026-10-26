const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../src/config/db');
const env = require('../../src/config/env');

let counter = 1000;
function uniqueId() {
  counter += 1;
  return `${Date.now().toString().slice(-6)}${counter}`;
}

async function createUser(overrides = {}) {
  const uid = uniqueId();
  const username = overrides.username || `user_${uid}`;
  const rawPassword = overrides.password || 'Password123!';
  const hashedPassword = overrides.hashedPassword || (await bcrypt.hash(rawPassword, 10));
  const role = overrides.role || 'customer';
  const isActive = overrides.is_active !== undefined ? (overrides.is_active ? 1 : 0) : 1;

  const [res] = await pool.query(
    'INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, role, isActive]
  );

  const user = {
    user_id: res.insertId,
    username,
    role,
    is_active: Boolean(isActive),
    rawPassword,
  };

  return user;
}

function createToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

async function createCustomer(overrides = {}) {
  const uid = uniqueId();
  const name = overrides.name || `Guest ${uid}`;
  const email = overrides.email || `guest_${uid}@luxestay.test`;
  const phone = overrides.phone || '+94770000000';
  const userId = overrides.user_id || null;

  const [res] = await pool.query(
    'INSERT INTO customers (user_id, name, email, phone) VALUES (?, ?, ?, ?)',
    [userId, name, email, phone]
  );

  return {
    customer_id: res.insertId,
    user_id: userId,
    name,
    email,
    phone,
  };
}

async function createCustomerUser(overrides = {}) {
  const user = await createUser({
    ...overrides,
    role: 'customer',
  });
  const customer = await createCustomer({
    ...overrides,
    user_id: user.user_id,
  });

  return {
    user,
    customer,
    token: createToken(user),
  };
}

async function createStaffUser(role = 'admin', overrides = {}) {
  const user = await createUser({
    ...overrides,
    role,
  });
  return {
    user,
    token: createToken(user),
  };
}

async function createRoom(overrides = {}) {
  const uid = uniqueId();
  const roomNumber = overrides.room_number || `R-${uid.slice(-4)}`;
  const roomType = overrides.room_type || 'Deluxe Suite';
  const price = overrides.price !== undefined ? overrides.price : 15000.0;
  const status = overrides.status || 'available';
  const capacity = overrides.capacity !== undefined ? overrides.capacity : 2;
  const bedType = overrides.bed_type || 'King';
  const sizeSqm = overrides.size_sqm !== undefined ? overrides.size_sqm : 35;
  const viewLabel = overrides.view_label || 'Ocean View';
  const amenities = JSON.stringify(overrides.amenities || ['WiFi', 'Air Conditioning']);
  const images = JSON.stringify(overrides.images || ['/uploads/rooms/sample.webp']);
  const description = overrides.description || 'Spacious luxury room.';

  const [res] = await pool.query(
    `INSERT INTO rooms (
      room_number, room_type, price, status, capacity, bed_type, size_sqm, view_label, amenities, images, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [roomNumber, roomType, price, status, capacity, bedType, sizeSqm, viewLabel, amenities, images, description]
  );

  return {
    room_id: res.insertId,
    room_number: roomNumber,
    room_type: roomType,
    price: Number(price),
    status,
    capacity,
    bed_type: bedType,
    size_sqm: sizeSqm,
    view_label: viewLabel,
    amenities: JSON.parse(amenities),
    images: JSON.parse(images),
    description,
  };
}

async function createReservation(overrides = {}) {
  const uid = uniqueId();
  const customerId = overrides.customer_id;
  const roomId = overrides.room_id;
  const checkInDate = overrides.check_in_date || '2026-11-01';
  const checkOutDate = overrides.check_out_date || '2026-11-03';
  const nightlyRate = overrides.nightly_rate !== undefined ? overrides.nightly_rate : 15000.0;
  const totalAmount = overrides.total_amount !== undefined ? overrides.total_amount : 30000.0;
  const status = overrides.status || 'pending';
  const guests = overrides.guests !== undefined ? overrides.guests : 2;
  const bookingSource = overrides.booking_source || 'online';
  const paymentStatus = overrides.payment_status || 'unpaid';
  const createdAt = overrides.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const year = checkInDate.slice(0, 4);

  const [res] = await pool.query(
    `INSERT INTO reservations (
      customer_id, room_id, check_in_date, check_out_date, total_amount, nightly_rate,
      status, guests, booking_source, payment_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      roomId,
      checkInDate,
      checkOutDate,
      totalAmount,
      nightlyRate,
      status,
      guests,
      bookingSource,
      paymentStatus,
      createdAt,
    ]
  );

  const reservationId = res.insertId;
  const bookingRef = overrides.booking_ref || `LS-${year}-${String(reservationId).padStart(6, '0')}`;

  await pool.query('UPDATE reservations SET booking_ref = ? WHERE reservation_id = ?', [
    bookingRef,
    reservationId,
  ]);

  return {
    reservation_id: reservationId,
    booking_ref: bookingRef,
    customer_id: customerId,
    room_id: roomId,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    nightly_rate: Number(nightlyRate),
    total_amount: Number(totalAmount),
    status,
    guests,
    booking_source: bookingSource,
    payment_status: paymentStatus,
    created_at: createdAt,
  };
}

async function createPayment(overrides = {}) {
  const reservationId = overrides.reservation_id;
  const amount = overrides.amount !== undefined ? overrides.amount : 30000.0;
  const kind = overrides.kind || 'payment';
  const method = overrides.method || 'cash';
  const reference = overrides.reference || null;
  const note = overrides.note || 'Test payment';
  const recordedBy = overrides.recorded_by || null;
  const createdAt = overrides.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [res] = await pool.query(
    `INSERT INTO payments (
      reservation_id, amount, kind, method, reference, note, recorded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [reservationId, amount, kind, method, reference, note, recordedBy, createdAt]
  );

  return {
    payment_id: res.insertId,
    reservation_id: reservationId,
    amount: Number(amount),
    kind,
    method,
    reference,
    note,
    recorded_by: recordedBy,
    created_at: createdAt,
  };
}

async function createReview(overrides = {}) {
  const customerId = overrides.customer_id;
  const roomId = overrides.room_id;
  const reservationId = overrides.reservation_id;
  const rating = overrides.rating !== undefined ? overrides.rating : 5;
  const reviewText = overrides.review_text || overrides.comment || 'Wonderful luxury stay!';
  const status = overrides.status || (overrides.is_approved ? 'approved' : 'pending');

  const [res] = await pool.query(
    `INSERT INTO reviews (
      customer_id, room_id, reservation_id, rating, review_text, status
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [customerId, roomId, reservationId, rating, reviewText, status]
  );

  return {
    review_id: res.insertId,
    customer_id: customerId,
    room_id: roomId,
    reservation_id: reservationId,
    rating,
    review_text: reviewText,
    status,
  };
}

module.exports = {
  createUser,
  createToken,
  createCustomer,
  createCustomerUser,
  createStaffUser,
  createRoom,
  createReservation,
  createPayment,
  createReview,
};
