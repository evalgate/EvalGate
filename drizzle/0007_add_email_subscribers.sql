-- Create email_subscribers table for lead capture
CREATE TABLE IF NOT EXISTS email_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  tags TEXT,
  subscribed_at TEXT NOT NULL,
  unsubscribed_at TEXT,
  last_email_sent_at TEXT,
  email_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_source ON email_subscribers(source);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_subscribed_at ON email_subscribers(subscribed_at DESC);

-- Create index for active subscribers by source
CREATE INDEX IF NOT EXISTS idx_email_subscribers_active_source ON email_subscribers(status, source) WHERE status = 'active';

