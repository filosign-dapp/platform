-- enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (auth + wallet)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address text NOT NULL UNIQUE,    -- canonicalized (lowercase)
  email text,                             -- optional
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  is_onboarded boolean DEFAULT false
);

-- Profiles (public user metadata, editable)
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_cid text,            -- FilCDN/IPFS CID for image (optional)
  bio text,
  public_metadata jsonb,      -- any extra public metadata
  updated_at timestamptz DEFAULT now()
);

-- Key commitments (server-side only: store commitments & encrypted blob locations)
CREATE TABLE key_commitments (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salt_auth_commit bytea NOT NULL,     -- keccak256 or sha256 commitment
  salt_wrap_commit bytea NOT NULL,
  salt_pin_commit bytea NOT NULL,
  nonce_commit bytea NOT NULL,
  seed_commit bytea NOT NULL,
  pin_commit bytea,                    -- optional
  public_key bytea NOT NULL,           -- e.g., x25519/xpub representation
  encrypted_seed_cid text,             -- CID pointing to encrypted seed blob on FilCDN/Synapse
  version smallint NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Approvals (mirrors on-chain approvedSenders mapping)
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_wallet text NOT NULL,         -- wallet address of sender (string for quicker checks)
  approved boolean NOT NULL DEFAULT true,
  onchain_tx_hash text,                -- tx that minted/recorded approval (optional)
  onchain_block_num bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(recipient_id, sender_wallet)
);

CREATE INDEX idx_approvals_recipient ON approvals(recipient_id);
CREATE INDEX idx_approvals_sender ON approvals(sender_wallet);

-- Share requests (off-chain)
CREATE TABLE share_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_wallet text NOT NULL,      -- may be unregistered user
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, CANCELLED, ACCEPTED, REJECTED, EXPIRED
  message text,
  metadata jsonb,                      -- any metadata like expiration, tags, intended file CIDs
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_share_requests_recipient ON share_requests(recipient_wallet);

-- Files metadata (off-chain)
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cid_prefix bytea NOT NULL,
  cid_tail integer NOT NULL,
  cid_identifier bytea NOT NULL,       -- keccak256(prefix || tail)
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- uploader
  recipient_wallet text NOT NULL,      -- receiver wallet address
  file_name text,
  mime_type text,
  size_bytes bigint,
  encrypted_key_cid text,              -- CID pointing to symmetric key encrypted for recipient
  file_metadata jsonb,                 -- other metadata (created date inside doc, versioning)
  onchain_registered boolean DEFAULT false,
  onchain_tx_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cid_identifier)
);
CREATE INDEX idx_files_owner ON files(owner_id);
CREATE INDEX idx_files_recipient ON files(recipient_wallet);
CREATE INDEX idx_files_cididentifier ON files(cid_identifier);

-- File signatures (mirrors FSFileRegistry SignatureData)
CREATE TABLE file_signatures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  signer_wallet text NOT NULL,
  signature_visual_hash bytea NOT NULL,
  v smallint NOT NULL,
  r bytea NOT NULL,
  s bytea NOT NULL,
  timestamp timestamptz NOT NULL,
  onchain_tx_hash text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_signatures_file ON file_signatures(file_id);

-- Audit log (immutable)
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz DEFAULT now()
);

-- On-chain sync queue / pending tx
CREATE TABLE pending_tx (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash text UNIQUE,
  type text,            -- e.g., 'registerFile', 'approveSender', 'submitSignature'
  payload jsonb,
  tries smallint DEFAULT 0,
  last_attempt timestamptz,
  status text DEFAULT 'PENDING' -- PENDING, CONFIRMED, FAILED
);
CREATE INDEX idx_pending_tx_status ON pending_tx(status);
