-- ============================================================
-- LuxeStay Enterprise Migration Script
-- Run this against the hotel_reservation database.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

USE hotel_reservation;

-- ============================================================
-- FEATURE 2: Dynamic Pricing — pricing_rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_rules (
  rule_id     INT PRIMARY KEY AUTO_INCREMENT,
  rule_name   VARCHAR(100) NOT NULL,
  rule_type   ENUM('weekend','holiday','peak_season','off_season','room_type_multiplier') NOT NULL,
  value       DECIMAL(5,2) NOT NULL COMMENT 'Positive = surcharge %, Negative = discount %',
  applies_to  VARCHAR(50) DEFAULT NULL COMMENT 'room_type name if type=room_type_multiplier',
  start_date  DATE DEFAULT NULL,
  end_date    DATE DEFAULT NULL,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pricing_type (rule_type),
  INDEX idx_pricing_active (is_active)
);

-- Seed default pricing rules
INSERT IGNORE INTO pricing_rules (rule_id, rule_name, rule_type, value, applies_to, start_date, end_date) VALUES
(1, 'Weekend Surcharge',    'weekend',    15.00, NULL, NULL, NULL),
(2, 'Peak Season',          'peak_season', 25.00, NULL, '2024-06-01', '2024-08-31'),
(3, 'Off-Season Discount',  'off_season', -10.00, NULL, '2024-11-01', '2024-02-28'),
(4, 'Suite Premium',        'room_type_multiplier', 20.00, 'Suite', NULL, NULL),
(5, 'Deluxe Premium',       'room_type_multiplier', 10.00, 'Deluxe', NULL, NULL);

-- ============================================================
-- FEATURE 2: Add price breakdown columns to reservations
-- ============================================================
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS base_amount      DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS surcharge_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_amount  DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_amount       DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_breakdown  JSON DEFAULT NULL;

-- ============================================================
-- FEATURE 4: Employee Attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT NOT NULL,
  date          DATE NOT NULL,
  clock_in      DATETIME DEFAULT NULL,
  clock_out     DATETIME DEFAULT NULL,
  break_start   DATETIME DEFAULT NULL,
  break_end     DATETIME DEFAULT NULL,
  total_hours   DECIMAL(5,2) DEFAULT NULL,
  status        ENUM('present','late','absent','half_day') DEFAULT 'present',
  notes         TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY uq_attendance_user_date (user_id, date),
  INDEX idx_attendance_date (date),
  INDEX idx_attendance_status (status)
);

-- ============================================================
-- FEATURE 5: Housekeeping Tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  task_id      INT PRIMARY KEY AUTO_INCREMENT,
  room_id      INT NOT NULL,
  assigned_to  INT DEFAULT NULL,
  status       ENUM('pending','in_progress','completed','skipped') DEFAULT 'pending',
  priority     ENUM('normal','urgent') DEFAULT 'normal',
  notes        TEXT,
  started_at   DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_hk_room (room_id),
  INDEX idx_hk_status (status),
  INDEX idx_hk_created (created_at)
);

-- ============================================================
-- FEATURE 5: Extend rooms.status for housekeeping states
-- (safe: only adds new enum values, existing values unchanged)
-- ============================================================
ALTER TABLE rooms
  MODIFY COLUMN status ENUM('available','occupied','reserved','dirty','cleaning','ready','maintenance') DEFAULT 'available';

-- ============================================================
-- FEATURE 8: Customer Reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  review_id      INT PRIMARY KEY AUTO_INCREMENT,
  reservation_id INT NOT NULL UNIQUE,
  customer_id    INT NOT NULL,
  room_id        INT NOT NULL,
  rating         TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text    TEXT,
  image_url      VARCHAR(255) DEFAULT NULL,
  status         ENUM('pending','approved','rejected') DEFAULT 'pending',
  admin_note     VARCHAR(255) DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  INDEX idx_review_room (room_id),
  INDEX idx_review_status (status),
  INDEX idx_review_rating (rating)
);

SELECT 'Enterprise migration complete.' AS result;
