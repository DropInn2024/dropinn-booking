CREATE TABLE IF NOT EXISTS bookings (
  bookingId     TEXT PRIMARY KEY,
  checkIn       TEXT NOT NULL,
  checkOut      TEXT NOT NULL,
  guestName     TEXT NOT NULL,
  guestPhone    TEXT NOT NULL,
  guestEmail    TEXT DEFAULT '',
  rooms         INTEGER DEFAULT 1,
  nights        INTEGER DEFAULT 1,
  extraBeds     INTEGER DEFAULT 0,
  packagePrice  REAL DEFAULT 0,
  extraBedPrice REAL DEFAULT 1000,
  originalTotal REAL DEFAULT 0,
  totalPrice    REAL DEFAULT 0,
  discountCode  TEXT DEFAULT '',
  discountAmount REAL DEFAULT 0,
  notes         TEXT DEFAULT '',
  status        TEXT DEFAULT '洽談中',
  source        TEXT DEFAULT 'web',
  createdAt     TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedAt     TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_checkIn  ON bookings(checkIn);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON bookings(status);
