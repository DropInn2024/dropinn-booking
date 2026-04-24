-- SQLite 不支援 DROP CONSTRAINT，需要重建表格來移除 FK
-- drift_reviews 不應強制 userId 存在於 drift_users（owner 是虛擬帳號）

PRAGMA foreign_keys = OFF;

CREATE TABLE drift_reviews_new (
  reviewId  TEXT PRIMARY KEY,
  spotId    TEXT NOT NULL,
  userId    TEXT NOT NULL,
  author    TEXT NOT NULL,
  persona   TEXT DEFAULT '',
  note      TEXT NOT NULL,
  rating    INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', '+8 hours'))
);

INSERT INTO drift_reviews_new SELECT * FROM drift_reviews;

DROP TABLE drift_reviews;

ALTER TABLE drift_reviews_new RENAME TO drift_reviews;

CREATE INDEX IF NOT EXISTS idx_drift_reviews_spotId ON drift_reviews(spotId);
CREATE INDEX IF NOT EXISTS idx_drift_reviews_userId ON drift_reviews(userId);

PRAGMA foreign_keys = ON;
