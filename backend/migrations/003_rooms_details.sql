-- 003_rooms_details.sql
-- Add capacity, bed_type, size_sqm, view_label, amenities, images to rooms

ALTER TABLE rooms
  ADD COLUMN capacity TINYINT NOT NULL DEFAULT 2,
  ADD COLUMN bed_type VARCHAR(40) DEFAULT NULL,
  ADD COLUMN size_sqm SMALLINT DEFAULT NULL,
  ADD COLUMN view_label VARCHAR(60) DEFAULT NULL,
  ADD COLUMN amenities JSON DEFAULT NULL,
  ADD COLUMN images JSON DEFAULT NULL;

UPDATE rooms
SET images = JSON_ARRAY(image_url)
WHERE image_url IS NOT NULL AND image_url != '' AND images IS NULL;
