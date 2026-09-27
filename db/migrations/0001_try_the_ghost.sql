-- TRY THE GHOST / I WANT THIS
-- 画像そのものは保存しない。ユーザー情報と生成・WANT履歴だけを保存する。
-- 日時はすべて UTC の ISO 8601 文字列（例: 2026-09-27T03:00:00.000Z）。
-- jst_date は日本時間（Asia/Tokyo）の日付（例: 2026-09-27）で、1日3回制限の判定に使う。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  line_user_id TEXT,
  line_friend_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users (line_user_id);

-- status: pending（生成中）/ succeeded（生成済み）/ failed（失敗。回数に数えない）
CREATE TABLE IF NOT EXISTS try_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  line_user_id TEXT NOT NULL,
  ghost_id TEXT NOT NULL,
  color_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  jst_date TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT
);

-- 同じユーザー／同じLINE user ID で同じGHOSTは1回まで（失敗分は除く）
CREATE UNIQUE INDEX IF NOT EXISTS uq_try_generations_user_ghost
  ON try_generations (user_id, ghost_id) WHERE status <> 'failed';
CREATE UNIQUE INDEX IF NOT EXISTS uq_try_generations_line_ghost
  ON try_generations (line_user_id, ghost_id) WHERE status <> 'failed';
CREATE INDEX IF NOT EXISTS idx_try_generations_user_day ON try_generations (user_id, jst_date);
CREATE INDEX IF NOT EXISTS idx_try_generations_line_day ON try_generations (line_user_id, jst_date);
CREATE INDEX IF NOT EXISTS idx_try_generations_ip ON try_generations (ip_hash, generated_at);

-- source: product_page（商品ページのI WANT THIS）/ post_try（TRY THE GHOST後のI WANT THIS）
CREATE TABLE IF NOT EXISTS wants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  ghost_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('product_page', 'post_try')),
  color_name TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, ghost_id, source)
);

CREATE INDEX IF NOT EXISTS idx_wants_ghost_source ON wants (ghost_id, source);

-- LINE Login のたびに、認証日時と友だち確認結果を記録する
CREATE TABLE IF NOT EXISTS line_friend_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  line_user_id TEXT NOT NULL,
  friend_flag INTEGER NOT NULL,
  authenticated_at TEXT NOT NULL,
  friend_verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_line_friend_checks_user ON line_friend_checks (user_id, authenticated_at);
