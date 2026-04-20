-- Add email column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- OTP verification codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  code VARCHAR(6) NOT NULL,
  username VARCHAR(50),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email_code
  ON verification_codes(email, code)
  WHERE used = FALSE;
