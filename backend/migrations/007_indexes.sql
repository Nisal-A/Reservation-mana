-- 007_indexes.sql
-- Add performance indexes

CREATE INDEX idx_reservations_room_dates ON reservations (room_id, check_in_date, check_out_date);
CREATE INDEX idx_reservations_status_checkin ON reservations (status, check_in_date);
CREATE INDEX idx_reservations_customer ON reservations (customer_id);
CREATE INDEX idx_reservations_checkout ON reservations (check_out_date);
CREATE INDEX idx_reservations_created ON reservations (created_at);
CREATE INDEX idx_reservations_booking_source ON reservations (booking_source);

CREATE INDEX idx_payments_reservation ON payments (reservation_id);
CREATE INDEX idx_payments_created ON payments (created_at);

CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);
CREATE INDEX idx_audit_created ON audit_log (created_at);

CREATE INDEX idx_rooms_type_status ON rooms (room_type, status);
