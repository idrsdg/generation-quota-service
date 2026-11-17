-- Up Migration

CREATE TABLE generations (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    text NOT NULL CHECK (char_length(user_id) BETWEEN 1 AND 128),
  prompt     text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 2000),
  result     text NOT NULL,
  cached     boolean NOT NULL,
  -- Millisecond precision on purpose: a JavaScript Date holds milliseconds,
  -- so the pagination cursor round-trips through the API without losing digits.
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

-- Matches the history query exactly: one user, newest first, id as tie-breaker.
CREATE INDEX generations_user_history_idx
  ON generations (user_id, created_at DESC, id DESC);

-- One row per user per UTC day. A new day is simply a new row, so nothing has to "reset".
CREATE TABLE daily_quotas (
  user_id text     NOT NULL,
  day     date     NOT NULL,
  -- Last line of defence: the database itself refuses a sixth generation.
  used    smallint NOT NULL CHECK (used BETWEEN 0 AND 5),
  PRIMARY KEY (user_id, day)
);

-- Down Migration

DROP TABLE daily_quotas;
DROP TABLE generations;
