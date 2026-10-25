-- 002_drop_out_of_scope.sql
-- Drop housekeeping and attendance tables, normalize rooms.status

DROP TABLE IF EXISTS housekeeping_tasks;
DROP TABLE IF EXISTS attendance;

UPDATE rooms
SET status = 'available'
WHERE status IN ('reserved', 'dirty', 'cleaning', 'ready');

ALTER TABLE rooms
MODIFY COLUMN status ENUM('available', 'occupied', 'maintenance') DEFAULT 'available';
