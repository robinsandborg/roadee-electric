ALTER TABLE post_tags
  ADD COLUMN IF NOT EXISTS space_id TEXT;

UPDATE post_tags AS pt
SET space_id = p.space_id
FROM posts AS p
WHERE p.id = pt.post_id
  AND (pt.space_id IS NULL OR pt.space_id <> p.space_id);

ALTER TABLE post_tags
  ALTER COLUMN space_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'post_tags_post_id_space_id_fkey'
  ) THEN
    ALTER TABLE post_tags
      ADD CONSTRAINT post_tags_post_id_space_id_fkey
      FOREIGN KEY (post_id, space_id) REFERENCES posts(id, space_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_tags_space_id ON post_tags(space_id);
