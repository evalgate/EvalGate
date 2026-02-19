-- Add revoked_reason to shared_exports (admin only; never exposed in public 410 response)
ALTER TABLE shared_exports ADD COLUMN revoked_reason TEXT;
