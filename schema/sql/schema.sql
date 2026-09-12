-- Option: use pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL UNIQUE
);

-- Users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(200) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(100) UNIQUE,
  subject text,
  recipient text,
  service varchar(150),
  year integer,
  file_path text NOT NULL,
  file_name varchar(255),
  sha256 char(64) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_sha256 ON documents(sha256);
CREATE INDEX idx_documents_created_by ON documents(created_by);

-- QR Codes
CREATE TABLE qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  signature text NOT NULL,
  token text,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (qr_uuid)
);

CREATE INDEX idx_qr_qruuid ON qr_codes(qr_uuid);

-- Signed documents
CREATE TABLE signed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name varchar(255),
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Verifications
CREATE TABLE verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid REFERENCES qr_codes(id) ON DELETE SET NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  verifier_info jsonb,
  result varchar(50) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_created_at ON verifications(created_at);

-- Audit logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(150) NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
