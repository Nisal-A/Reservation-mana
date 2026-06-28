-- ============================================================
-- Hotel Reservation Management System - Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS hotel_reservation;
USE hotel_reservation;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'reception', 'customer') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT PRIMARY KEY AUTO_INCREMENT,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    room_type VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status ENUM('available', 'occupied', 'maintenance') DEFAULT 'available',
    description TEXT,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- RESERVATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    room_id INT NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled') DEFAULT 'pending',
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin user (password: admin)
INSERT INTO users (username, password, role) VALUES
('admin', '$2b$10$Pd2VsqfVMcvZtbVZtDpwJOxNje8bjCdQItZRg6m4pPyNriolM/hN6', 'admin');

-- Second admin user (password: admin2)
INSERT INTO users (username, password, role) VALUES
('admin2', '$2b$10$qdbMbKo5HSrhgpUVJ8.OV.Wj5IT9BZ5YH6aZ.cVDc6uQfwXxMaHDu', 'admin');

-- Default reception user (password: user1)
INSERT INTO users (username, password, role) VALUES
('user1', '$2b$10$bqKOS0ZmfSz/zWQlqDGCtuEDFW6wLiz//pF9eaFx7.wO/rPqoTCQu', 'reception');

-- Sample rooms
INSERT INTO rooms (room_number, room_type, price, status, description) VALUES
('101', 'Single', 80.00, 'available', 'Cozy single room with city view, queen bed, and modern amenities.'),
('102', 'Single', 80.00, 'available', 'Comfortable single room with garden view and en-suite bathroom.'),
('201', 'Double', 140.00, 'available', 'Spacious double room with king bed, flat-screen TV, and mini-bar.'),
('202', 'Double', 140.00, 'available', 'Elegant double room with panoramic sea view and private balcony.'),
('301', 'Suite', 280.00, 'available', 'Luxurious suite with separate living area, jacuzzi, and premium amenities.'),
('302', 'Suite', 280.00, 'maintenance', 'Grand suite with butler service, private pool access, and mountain view.'),
('401', 'Deluxe', 220.00, 'available', 'Premium deluxe room with king bed, lounge area, and rooftop access.'),
('402', 'Deluxe', 220.00, 'available', 'Modern deluxe room with smart home features and exclusive lounge access.');
