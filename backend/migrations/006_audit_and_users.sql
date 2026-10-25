-- 006_audit_and_users.sql
-- Create audit_log table and extend users table with is_active and last_login_at

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id   INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(40) NOT NULL,
  entity_id  VARCHAR(40) NULL,
  details    JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

ALTER TABLE users
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN last_login_at DATETIME NULL;
