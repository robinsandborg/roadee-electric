import type { PoolClient } from "pg";
import { normalizeSpaceSlug } from "#/lib/space-slug";
import { getPostgresPool } from "#/lib/postgres.server";
import { PostsServiceError } from "#/lib/posts/service";
import type {
  CategoryRecord,
  CommentRecord,
  CreateCommentInput,
  CreatePostInput,
  FeedItem,
  GetPostThreadByIdInput,
  ListFeedBySpaceInput,
  ListTaxonomyBySpaceInput,
  PostRecord,
  PostTagRecord,
  PostThread,
  PostUpvoteRecord,
  TagRecord,
  ToggleUpvoteInput,
  ToggleUpvoteResult,
  UpdateOwnPostInput,
  PostsSnapshot,
} from "#/lib/posts/types";

type SpaceRow = {
  id: string;
  slug: string;
};

type PostRow = {
  id: string;
  space_id: string;
  author_id: string;
  title: string;
  body_rich_text: Record<string, unknown>;
  image_url: string | null;
  image_meta: Record<string, unknown> | null;
  category_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type CommentRow = {
  id: string;
  post_id: string;
  space_id: string;
  author_id: string;
  body_rich_text: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type PostUpvoteRow = {
  id: string;
  post_id: string;
  space_id: string;
  user_id: string;
  created_at: Date;
};

type CategoryRow = {
  id: string;
  space_id: string;
  name: string;
  kind: string;
  created_at: Date;
};

type TagRow = {
  id: string;
  space_id: string;
  name: string;
  created_at: Date;
};

type PostTagRow = {
  id: string;
  post_id: string;
  tag_id: string;
  space_id: string | null;
};

export async function createPostInDb(
  input: CreatePostInput,
): Promise<{ post: PostRecord; postTags: PostTagRecord[]; txid: number }> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const space = await getSpaceBySlug(client, input.spaceSlug);
    if (!space) {
      throw new PostsServiceError("space_not_found", "Space not found.");
    }

    await assertMembership(client, space.id, input.actorUserId);

    const { categoryId, tagIds } = await resolveTaxonomyForMutation(client, {
      spaceId: space.id,
      categoryId: input.categoryId ?? null,
      categoryName: input.categoryName ?? null,
      tagIds: input.tagIds ?? [],
      tagNames: input.tagNames ?? [],
    });

    const now = new Date();
    const postId = input.id ?? crypto.randomUUID();

    const postResult = await client.query<PostRow>(
      `
        INSERT INTO posts (
          id,
          space_id,
          author_id,
          title,
          body_rich_text,
          image_url,
          image_meta,
          category_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $9)
        RETURNING id, space_id, author_id, title, body_rich_text, image_url, image_meta, category_id, created_at, updated_at
      `,
      [
        postId,
        space.id,
        input.actorUserId,
        input.title.trim(),
        JSON.stringify(input.bodyRichText),
        input.imageUrl ?? null,
        JSON.stringify(input.imageMeta ?? null),
        categoryId,
        now,
      ],
    );

    const postTags = await replacePostTags(client, {
      postId,
      spaceId: space.id,
      tagIds,
    });
    const txid = await getCurrentTxId(client);

    await client.query("COMMIT");

    return {
      post: mapPostRow(postResult.rows[0]!),
      postTags,
      txid,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOwnPostInDb(
  input: UpdateOwnPostInput,
): Promise<{ post: PostRecord; postTags: PostTagRecord[]; txid: number }> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query<PostRow>(
      `
        SELECT id, space_id, author_id, title, body_rich_text, image_url, image_meta, category_id, created_at, updated_at
        FROM posts
        WHERE id = $1
        FOR UPDATE
      `,
      [input.postId],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      throw new PostsServiceError("post_not_found", "Post not found.");
    }

    await assertMembership(client, existing.space_id, input.actorUserId);
    if (existing.author_id !== input.actorUserId) {
      throw new PostsServiceError("forbidden", "Only the post author can edit this post.");
    }

    const { categoryId, tagIds } = await resolveTaxonomyForMutation(client, {
      spaceId: existing.space_id,
      categoryId: input.categoryId ?? null,
      categoryName: input.categoryName ?? null,
      tagIds: input.tagIds ?? [],
      tagNames: input.tagNames ?? [],
    });

    const updatedResult = await client.query<PostRow>(
      `
        UPDATE posts
        SET
          title = $2,
          body_rich_text = $3::jsonb,
          image_url = $4,
          image_meta = $5::jsonb,
          category_id = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, space_id, author_id, title, body_rich_text, image_url, image_meta, category_id, created_at, updated_at
      `,
      [
        input.postId,
        input.title.trim(),
        JSON.stringify(input.bodyRichText),
        input.imageUrl ?? null,
        JSON.stringify(input.imageMeta ?? null),
        categoryId,
      ],
    );

    const postTags = await replacePostTags(client, {
      postId: input.postId,
      spaceId: existing.space_id,
      tagIds,
    });
    const txid = await getCurrentTxId(client);

    await client.query("COMMIT");

    return {
      post: mapPostRow(updatedResult.rows[0]!),
      postTags,
      txid,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function createCommentInDb(
  input: CreateCommentInput,
): Promise<{ comment: CommentRecord; txid: number }> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const post = await getPostById(client, input.postId, true);
    if (!post) {
      throw new PostsServiceError("post_not_found", "Post not found.");
    }

    await assertMembership(client, post.space_id, input.actorUserId);

    const commentId = input.id ?? crypto.randomUUID();
    const now = new Date();
    const commentResult = await client.query<CommentRow>(
      `
        INSERT INTO comments (
          id,
          post_id,
          space_id,
          author_id,
          body_rich_text,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
        RETURNING id, post_id, space_id, author_id, body_rich_text, created_at, updated_at
      `,
      [
        commentId,
        post.id,
        post.space_id,
        input.actorUserId,
        JSON.stringify(input.bodyRichText),
        now,
      ],
    );
    const txid = await getCurrentTxId(client);

    await client.query("COMMIT");

    return {
      comment: mapCommentRow(commentResult.rows[0]!),
      txid,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleUpvoteInDb(input: ToggleUpvoteInput): Promise<ToggleUpvoteResult> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const post = await getPostById(client, input.postId, true);
    if (!post) {
      throw new PostsServiceError("post_not_found", "Post not found.");
    }

    await assertMembership(client, post.space_id, input.actorUserId);

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.postId}:${input.actorUserId}`,
    ]);

    const deleted = await client.query<PostUpvoteRow>(
      `
        DELETE FROM post_upvotes
        WHERE post_id = $1 AND user_id = $2
        RETURNING id, post_id, space_id, user_id, created_at
      `,
      [input.postId, input.actorUserId],
    );

    if (deleted.rows[0]) {
      const txid = await getCurrentTxId(client);
      await client.query("COMMIT");
      return {
        upvoted: false,
        upvote: null,
        txid,
      };
    }

    const inserted = await client.query<PostUpvoteRow>(
      `
        INSERT INTO post_upvotes (id, post_id, space_id, user_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, post_id, space_id, user_id, created_at
      `,
      [input.id ?? crypto.randomUUID(), input.postId, post.space_id, input.actorUserId],
    );
    const txid = await getCurrentTxId(client);

    await client.query("COMMIT");

    return {
      upvoted: true,
      upvote: mapPostUpvoteRow(inserted.rows[0]!),
      txid,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function listFeedBySpaceInDb(
  input: ListFeedBySpaceInput,
): Promise<{ spaceId: string; feed: FeedItem[] }> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const space = await getSpaceBySlug(client, input.spaceSlug);
    if (!space) {
      throw new PostsServiceError("space_not_found", "Space not found.");
    }

    await assertMembership(client, space.id, input.actorUserId);

    const postsResult = await client.query<PostRow>(
      `
        SELECT id, space_id, author_id, title, body_rich_text, image_url, image_meta, category_id, created_at, updated_at
        FROM posts
        WHERE space_id = $1
        ORDER BY created_at DESC
      `,
      [space.id],
    );

    const posts = postsResult.rows.map(mapPostRow);
    const postIds = posts.map((post) => post.id);

    const [commentCounts, upvoteCounts, actorUpvotes, categories, tagsByPost] = await Promise.all([
      listCommentCountsByPostId(client, postIds),
      listUpvoteCountsByPostId(client, postIds),
      listActorUpvotePostIds(client, postIds, input.actorUserId),
      listCategoriesForPosts(client, posts),
      listTagsForPosts(client, postIds),
    ]);

    const feed = posts.map((post) => ({
      post,
      category: post.categoryId ? (categories.get(post.categoryId) ?? null) : null,
      tags: tagsByPost.get(post.id) ?? [],
      upvoteCount: upvoteCounts.get(post.id) ?? 0,
      commentCount: commentCounts.get(post.id) ?? 0,
      hasUpvoted: actorUpvotes.has(post.id),
    }));

    return {
      spaceId: space.id,
      feed,
    };
  } finally {
    client.release();
  }
}

export async function getPostThreadByIdInDb(input: GetPostThreadByIdInput): Promise<PostThread> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const post = await getPostById(client, input.postId, false);
    if (!post) {
      throw new PostsServiceError("post_not_found", "Post not found.");
    }

    await assertMembership(client, post.space_id, input.actorUserId);

    const postRecord = mapPostRow(post);

    const [commentsResult, commentCounts, upvoteCounts, actorUpvotes, categories, tagsByPost] =
      await Promise.all([
        client.query<CommentRow>(
          `
            SELECT id, post_id, space_id, author_id, body_rich_text, created_at, updated_at
            FROM comments
            WHERE post_id = $1
            ORDER BY created_at ASC
          `,
          [input.postId],
        ),
        listCommentCountsByPostId(client, [input.postId]),
        listUpvoteCountsByPostId(client, [input.postId]),
        listActorUpvotePostIds(client, [input.postId], input.actorUserId),
        listCategoriesForPosts(client, [postRecord]),
        listTagsForPosts(client, [input.postId]),
      ]);

    return {
      item: {
        post: postRecord,
        category: postRecord.categoryId ? (categories.get(postRecord.categoryId) ?? null) : null,
        tags: tagsByPost.get(postRecord.id) ?? [],
        upvoteCount: upvoteCounts.get(postRecord.id) ?? 0,
        commentCount: commentCounts.get(postRecord.id) ?? 0,
        hasUpvoted: actorUpvotes.has(postRecord.id),
      },
      comments: commentsResult.rows.map(mapCommentRow),
    };
  } finally {
    client.release();
  }
}

export async function listTaxonomyBySpaceInDb(
  input: ListTaxonomyBySpaceInput,
): Promise<{ spaceId: string; categories: CategoryRecord[]; tags: TagRecord[] }> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const space = await getSpaceBySlug(client, input.spaceSlug);
    if (!space) {
      throw new PostsServiceError("space_not_found", "Space not found.");
    }

    await assertMembership(client, space.id, input.actorUserId);

    const [categoriesResult, tagsResult] = await Promise.all([
      client.query<CategoryRow>(
        `
          SELECT id, space_id, name, kind, created_at
          FROM categories
          WHERE space_id = $1
          ORDER BY created_at ASC
        `,
        [space.id],
      ),
      client.query<TagRow>(
        `
          SELECT id, space_id, name, created_at
          FROM tags
          WHERE space_id = $1
          ORDER BY created_at ASC
        `,
        [space.id],
      ),
    ]);

    return {
      spaceId: space.id,
      categories: categoriesResult.rows.map(mapCategoryRow),
      tags: tagsResult.rows.map(mapTagRow),
    };
  } finally {
    client.release();
  }
}

export async function listSnapshotBySpaceInDb(
  input: ListTaxonomyBySpaceInput,
): Promise<{ spaceId: string; snapshot: PostsSnapshot }> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const space = await getSpaceBySlug(client, input.spaceSlug);
    if (!space) {
      throw new PostsServiceError("space_not_found", "Space not found.");
    }

    await assertMembership(client, space.id, input.actorUserId);

    const snapshot = await listPostsShapeRowsForSpaceIdsFromDb([space.id]);

    return {
      spaceId: space.id,
      snapshot,
    };
  } finally {
    client.release();
  }
}

export async function resolveScopedSpaceIdsForUserFromDb(input: {
  userId: string;
  spaceSlug?: string;
}): Promise<string[]> {
  const pool = getPostgresPool();
  const normalizedSlug = input.spaceSlug ? normalizeSpaceSlug(input.spaceSlug) : null;

  const result = await pool.query<{ id: string }>(
    `
      SELECT s.id
      FROM spaces AS s
      INNER JOIN memberships AS m ON m.space_id = s.id
      WHERE m.user_id = $1
      ${normalizedSlug ? "AND s.slug = $2" : ""}
      ORDER BY s.created_at DESC
    `,
    normalizedSlug ? [input.userId, normalizedSlug] : [input.userId],
  );

  return result.rows.map((row) => row.id);
}

export async function resolveSpaceIdsBySlugFromDb(input: { spaceSlug: string }): Promise<string[]> {
  const normalizedSlug = normalizeSpaceSlug(input.spaceSlug);
  if (!normalizedSlug) {
    return [];
  }

  const pool = getPostgresPool();
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM spaces
      WHERE slug = $1
    `,
    [normalizedSlug],
  );

  return result.rows.map((row) => row.id);
}

export async function listPostsShapeRowsForSpaceIdsFromDb(
  spaceIds: string[],
): Promise<PostsSnapshot> {
  if (spaceIds.length === 0) {
    return {
      posts: [],
      comments: [],
      postUpvotes: [],
      categories: [],
      tags: [],
      postTags: [],
    };
  }

  const pool = getPostgresPool();

  const [postsResult, commentsResult, upvotesResult, categoriesResult, tagsResult, postTagsResult] =
    await Promise.all([
      pool.query<PostRow>(
        `
          SELECT id, space_id, author_id, title, body_rich_text, image_url, image_meta, category_id, created_at, updated_at
          FROM posts
          WHERE space_id = ANY($1::text[])
        `,
        [spaceIds],
      ),
      pool.query<CommentRow>(
        `
          SELECT id, post_id, space_id, author_id, body_rich_text, created_at, updated_at
          FROM comments
          WHERE space_id = ANY($1::text[])
        `,
        [spaceIds],
      ),
      pool.query<PostUpvoteRow>(
        `
          SELECT id, post_id, space_id, user_id, created_at
          FROM post_upvotes
          WHERE space_id = ANY($1::text[])
        `,
        [spaceIds],
      ),
      pool.query<CategoryRow>(
        `
          SELECT id, space_id, name, kind, created_at
          FROM categories
          WHERE space_id = ANY($1::text[])
        `,
        [spaceIds],
      ),
      pool.query<TagRow>(
        `
          SELECT id, space_id, name, created_at
          FROM tags
          WHERE space_id = ANY($1::text[])
        `,
        [spaceIds],
      ),
      pool.query<PostTagRow>(
        `
          SELECT id, post_id, tag_id, space_id
          FROM post_tags
          WHERE space_id = ANY($1::text[])
        `,
        [spaceIds],
      ),
    ]);

  return {
    posts: postsResult.rows.map(mapPostRow),
    comments: commentsResult.rows.map(mapCommentRow),
    postUpvotes: upvotesResult.rows.map(mapPostUpvoteRow),
    categories: categoriesResult.rows.map(mapCategoryRow),
    tags: tagsResult.rows.map(mapTagRow),
    postTags: postTagsResult.rows.map(mapPostTagRow),
  };
}

async function getSpaceBySlug(client: PoolClient, spaceSlug: string): Promise<SpaceRow | null> {
  const normalized = normalizeSpaceSlug(spaceSlug);
  const result = await client.query<SpaceRow>(
    `
      SELECT id, slug
      FROM spaces
      WHERE slug = $1
    `,
    [normalized],
  );
  return result.rows[0] ?? null;
}

async function getPostById(
  client: PoolClient,
  postId: string,
  forUpdate: boolean,
): Promise<PostRow | null> {
  const result = await client.query<PostRow>(
    `
      SELECT id, space_id, author_id, title, body_rich_text, image_url, image_meta, category_id, created_at, updated_at
      FROM posts
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [postId],
  );
  return result.rows[0] ?? null;
}

async function assertMembership(
  client: PoolClient,
  spaceId: string,
  userId: string,
): Promise<void> {
  const membership = await client.query<{ id: string }>(
    `
      SELECT id
      FROM memberships
      WHERE space_id = $1 AND user_id = $2
    `,
    [spaceId, userId],
  );

  if (!membership.rows[0]) {
    throw new PostsServiceError("membership_required", "You are not a member of this space.");
  }
}

async function resolveTaxonomyForMutation(
  client: PoolClient,
  input: {
    spaceId: string;
    categoryId: string | null;
    categoryName: string | null;
    tagIds: string[];
    tagNames: string[];
  },
): Promise<{ categoryId: string | null; tagIds: string[] }> {
  let categoryId = input.categoryId;
  if (categoryId) {
    const category = await client.query<{ id: string }>(
      `
        SELECT id
        FROM categories
        WHERE id = $1 AND space_id = $2
      `,
      [categoryId, input.spaceId],
    );
    if (!category.rows[0]) {
      throw new PostsServiceError(
        "invalid_category_scope",
        "Category does not belong to this space.",
      );
    }
  }

  const normalizedCategoryName = String(input.categoryName ?? "").trim();
  if (!categoryId && normalizedCategoryName) {
    const existingCategory = await client.query<{ id: string }>(
      `
        SELECT id
        FROM categories
        WHERE space_id = $1 AND LOWER(name) = LOWER($2)
      `,
      [input.spaceId, normalizedCategoryName],
    );

    if (existingCategory.rows[0]) {
      categoryId = existingCategory.rows[0].id;
    } else {
      const insertedCategory = await client.query<{ id: string }>(
        `
          INSERT INTO categories (id, space_id, name, kind, created_at)
          VALUES ($1, $2, $3, 'general', NOW())
          RETURNING id
        `,
        [crypto.randomUUID(), input.spaceId, normalizedCategoryName],
      );
      categoryId = insertedCategory.rows[0]!.id;
    }
  }

  const cleanedTagIds = Array.from(new Set(input.tagIds.filter(Boolean)));
  if (cleanedTagIds.length > 0) {
    const validTags = await client.query<{ id: string }>(
      `
        SELECT id
        FROM tags
        WHERE space_id = $1 AND id = ANY($2::text[])
      `,
      [input.spaceId, cleanedTagIds],
    );

    if (validTags.rows.length !== cleanedTagIds.length) {
      throw new PostsServiceError(
        "invalid_tag_scope",
        "One or more tags do not belong to this space.",
      );
    }
  }

  const tagIds = [...cleanedTagIds];
  for (const rawName of input.tagNames) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }

    const existingTag = await client.query<{ id: string }>(
      `
        SELECT id
        FROM tags
        WHERE space_id = $1 AND LOWER(name) = LOWER($2)
      `,
      [input.spaceId, name],
    );

    if (existingTag.rows[0]) {
      tagIds.push(existingTag.rows[0].id);
      continue;
    }

    const insertedTag = await client.query<{ id: string }>(
      `
        INSERT INTO tags (id, space_id, name, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `,
      [crypto.randomUUID(), input.spaceId, name],
    );

    tagIds.push(insertedTag.rows[0]!.id);
  }

  return {
    categoryId,
    tagIds: Array.from(new Set(tagIds)),
  };
}

async function replacePostTags(
  client: PoolClient,
  input: { postId: string; spaceId: string; tagIds: string[] },
): Promise<PostTagRecord[]> {
  await client.query(
    `
      DELETE FROM post_tags
      WHERE post_id = $1
    `,
    [input.postId],
  );

  if (input.tagIds.length === 0) {
    return [];
  }

  const inserted: PostTagRecord[] = [];
  for (const tagId of input.tagIds) {
    const result = await client.query<PostTagRow>(
      `
        INSERT INTO post_tags (id, post_id, tag_id, space_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, post_id, tag_id, space_id
      `,
      [crypto.randomUUID(), input.postId, tagId, input.spaceId],
    );
    inserted.push(mapPostTagRow(result.rows[0]!));
  }

  return inserted;
}

async function listCommentCountsByPostId(
  client: PoolClient,
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const result = await client.query<{ post_id: string; count: string }>(
    `
      SELECT post_id, COUNT(*)::text AS count
      FROM comments
      WHERE post_id = ANY($1::text[])
      GROUP BY post_id
    `,
    [postIds],
  );

  return new Map(result.rows.map((row) => [row.post_id, Number(row.count)]));
}

async function listUpvoteCountsByPostId(
  client: PoolClient,
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const result = await client.query<{ post_id: string; count: string }>(
    `
      SELECT post_id, COUNT(*)::text AS count
      FROM post_upvotes
      WHERE post_id = ANY($1::text[])
      GROUP BY post_id
    `,
    [postIds],
  );

  return new Map(result.rows.map((row) => [row.post_id, Number(row.count)]));
}

async function listActorUpvotePostIds(
  client: PoolClient,
  postIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (postIds.length === 0) {
    return new Set();
  }

  const result = await client.query<{ post_id: string }>(
    `
      SELECT post_id
      FROM post_upvotes
      WHERE post_id = ANY($1::text[]) AND user_id = $2
    `,
    [postIds, userId],
  );

  return new Set(result.rows.map((row) => row.post_id));
}

async function listCategoriesForPosts(
  client: PoolClient,
  posts: PostRecord[],
): Promise<Map<string, CategoryRecord>> {
  const categoryIds = Array.from(new Set(posts.map((post) => post.categoryId).filter(Boolean)));
  if (categoryIds.length === 0) {
    return new Map();
  }

  const result = await client.query<CategoryRow>(
    `
      SELECT id, space_id, name, kind, created_at
      FROM categories
      WHERE id = ANY($1::text[])
    `,
    [categoryIds],
  );

  return new Map(result.rows.map((row) => [row.id, mapCategoryRow(row)]));
}

async function listTagsForPosts(
  client: PoolClient,
  postIds: string[],
): Promise<Map<string, TagRecord[]>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const result = await client.query<{
    post_id: string;
    tag_id: string;
    space_id: string;
    name: string;
    created_at: Date;
  }>(
    `
      SELECT pt.post_id, t.id AS tag_id, t.space_id, t.name, t.created_at
      FROM post_tags AS pt
      INNER JOIN tags AS t ON t.id = pt.tag_id
      WHERE pt.post_id = ANY($1::text[])
      ORDER BY t.created_at ASC
    `,
    [postIds],
  );

  const byPostId = new Map<string, TagRecord[]>();
  for (const row of result.rows) {
    const tag: TagRecord = {
      id: row.tag_id,
      spaceId: row.space_id,
      name: row.name,
      createdAt: row.created_at.toISOString(),
    };
    const current = byPostId.get(row.post_id) ?? [];
    current.push(tag);
    byPostId.set(row.post_id, current);
  }

  return byPostId;
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // no-op
  }
}

async function getCurrentTxId(client: PoolClient): Promise<number> {
  const result = await client.query<{ txid: string }>(
    `
      SELECT txid_current()::text AS txid
    `,
  );
  return Number(result.rows[0]?.txid ?? "0");
}

function mapPostRow(row: PostRow): PostRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    authorId: row.author_id,
    title: row.title,
    bodyRichText: row.body_rich_text ?? {},
    imageUrl: row.image_url,
    imageMeta: row.image_meta ?? null,
    categoryId: row.category_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapCommentRow(row: CommentRow): CommentRecord {
  return {
    id: row.id,
    postId: row.post_id,
    spaceId: row.space_id,
    authorId: row.author_id,
    bodyRichText: row.body_rich_text ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPostUpvoteRow(row: PostUpvoteRow): PostUpvoteRecord {
  return {
    id: row.id,
    postId: row.post_id,
    spaceId: row.space_id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
  };
}

function mapCategoryRow(row: CategoryRow): CategoryRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    kind: row.kind,
    createdAt: row.created_at.toISOString(),
  };
}

function mapTagRow(row: TagRow): TagRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
  };
}

function mapPostTagRow(row: PostTagRow): PostTagRecord {
  return {
    id: row.id,
    postId: row.post_id,
    tagId: row.tag_id,
    spaceId: row.space_id,
  };
}
