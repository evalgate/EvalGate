-- Delete duplicate api_keys (keep oldest per key_prefix) so 0011 unique constraint can apply
-- Run before 0011_add_uniqueness_constraints

DELETE FROM api_keys
WHERE id IN (
  SELECT a1.id FROM api_keys a1
  INNER JOIN api_keys a2 ON a1.key_prefix = a2.key_prefix AND a1.id > a2.id
);
