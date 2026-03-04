DROP INDEX IF EXISTS idx_post_tags_space_id;

ALTER TABLE post_tags
  DROP CONSTRAINT IF EXISTS post_tags_post_id_space_id_fkey;

ALTER TABLE post_tags
  DROP COLUMN IF EXISTS space_id;
