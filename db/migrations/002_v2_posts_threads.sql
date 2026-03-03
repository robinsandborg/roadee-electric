CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_rich_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT,
  image_meta JSONB,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, space_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body_rich_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (post_id, space_id) REFERENCES posts(id, space_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_upvotes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (post_id, space_id) REFERENCES posts(id, space_id) ON DELETE CASCADE,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_tags (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (post_id, tag_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_space_name_unique
  ON categories(space_id, LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_space_name_unique
  ON tags(space_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_categories_space_id ON categories(space_id);
CREATE INDEX IF NOT EXISTS idx_tags_space_id ON tags(space_id);
CREATE INDEX IF NOT EXISTS idx_posts_space_id_created_at ON posts(space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_space_id ON comments(space_id);
CREATE INDEX IF NOT EXISTS idx_post_upvotes_post_id ON post_upvotes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_upvotes_space_id ON post_upvotes(space_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);
