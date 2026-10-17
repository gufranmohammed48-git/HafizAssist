-- New database and prefixed tables keep Desktop-HafizAssist records separate.
CREATE TABLE recite_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE recite_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES recite_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX recite_sessions_expiry ON recite_sessions(expires_at);
CREATE INDEX recite_sessions_user ON recite_sessions(user_id);

CREATE TABLE recite_oauth_states (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX recite_oauth_expiry ON recite_oauth_states(expires_at);

CREATE TABLE recite_progress (
  user_id TEXT PRIMARY KEY REFERENCES recite_users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at INTEGER NOT NULL
);
