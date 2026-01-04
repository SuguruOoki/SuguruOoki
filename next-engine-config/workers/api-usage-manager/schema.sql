-- Next Engine API使用量管理用D1データベーススキーマ

-- API使用状況テーブル
CREATE TABLE IF NOT EXISTS api_usage (
  period TEXT PRIMARY KEY,        -- "2026-01" 形式
  data TEXT NOT NULL,             -- JSON形式の使用状況データ
  updated_at TEXT NOT NULL,       -- 最終更新日時
  created_at TEXT DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_api_usage_period ON api_usage(period);
CREATE INDEX IF NOT EXISTS idx_api_usage_updated_at ON api_usage(updated_at);

-- 履歴テーブル（オプション：過去の使用状況を保持）
CREATE TABLE IF NOT EXISTS api_usage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL,
  data TEXT NOT NULL,
  archived_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_usage_history_period ON api_usage_history(period);
