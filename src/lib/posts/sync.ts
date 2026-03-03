import {
  categoriesCollection,
  commentsCollection,
  postTagsCollection,
  postsCollection,
  postUpvotesCollection,
  removeCategory,
  removeComment,
  removePost,
  removePostTag,
  removePostUpvote,
  removeTag,
  spacesCollection,
  tagsCollection,
  upsertCategory,
  upsertComment,
  upsertPost,
  upsertPostTag,
  upsertPostUpvote,
  upsertTag,
  type Category,
  type Comment,
  type Post,
  type PostTag,
  type PostUpvote,
  type Tag,
} from "#/db-collections";
import {
  getCategoriesShapeUrl,
  getCommentsShapeUrl,
  getPostTagsShapeUrl,
  getPostsShapeUrl,
  getPostUpvotesShapeUrl,
  getTagsShapeUrl,
  isElectricShapeSyncEnabled,
} from "#/lib/electric/client";
import { fetchPostsSpaceFeed } from "#/lib/posts/api-client";
import type { PostsSnapshot } from "#/lib/posts/types";

export async function syncPostsIntoCollections(spaceSlug: string): Promise<void> {
  const localSpaceId = findSpaceIdBySlug(spaceSlug);

  if (isElectricShapeSyncEnabled()) {
    const snapshot = await fetchShapeSnapshot(spaceSlug);
    applyPostsSnapshot(snapshot, { targetSpaceId: localSpaceId });
    return;
  }

  const payload = await fetchApiSnapshot(spaceSlug);
  applyPostsSnapshot(payload.snapshot, { targetSpaceId: payload.spaceId ?? localSpaceId });
}

export function applyPostsSnapshot(
  snapshot: PostsSnapshot,
  options?: { targetSpaceId?: string | null },
): void {
  for (const category of snapshot.categories) {
    upsertCategory(category);
  }

  for (const tag of snapshot.tags) {
    upsertTag(tag);
  }

  for (const post of snapshot.posts) {
    upsertPost(post);
  }

  for (const comment of snapshot.comments) {
    upsertComment(comment);
  }

  for (const upvote of snapshot.postUpvotes) {
    upsertPostUpvote(upvote);
  }

  for (const postTag of snapshot.postTags) {
    upsertPostTag(postTag);
  }

  pruneMissing(snapshot, options?.targetSpaceId ?? null);
}

function pruneMissing(snapshot: PostsSnapshot, targetSpaceId: string | null): void {
  const targetSpaceIds = new Set<string>([
    ...snapshot.posts.map((post) => post.spaceId),
    ...snapshot.comments.map((comment) => comment.spaceId),
    ...snapshot.postUpvotes.map((upvote) => upvote.spaceId),
    ...snapshot.categories.map((category) => category.spaceId),
    ...snapshot.tags.map((tag) => tag.spaceId),
  ]);

  if (targetSpaceId) {
    targetSpaceIds.add(targetSpaceId);
  }

  if (targetSpaceIds.size === 0) {
    return;
  }

  const postIds = new Set(snapshot.posts.map((post) => post.id));
  const commentIds = new Set(snapshot.comments.map((comment) => comment.id));
  const postUpvoteIds = new Set(snapshot.postUpvotes.map((postUpvote) => postUpvote.id));
  const categoryIds = new Set(snapshot.categories.map((category) => category.id));
  const tagIds = new Set(snapshot.tags.map((tag) => tag.id));
  const postTagIds = new Set(snapshot.postTags.map((postTag) => postTag.id));

  const currentTargetPostIds = new Set<string>();
  for (const [, post] of postsCollection.entries()) {
    if (targetSpaceIds.has(post.spaceId)) {
      currentTargetPostIds.add(post.id);
    }
  }

  for (const [commentId, comment] of commentsCollection.entries()) {
    if (targetSpaceIds.has(comment.spaceId) && !commentIds.has(comment.id)) {
      removeComment(String(commentId));
    }
  }

  for (const [postUpvoteId, postUpvote] of postUpvotesCollection.entries()) {
    if (targetSpaceIds.has(postUpvote.spaceId) && !postUpvoteIds.has(postUpvote.id)) {
      removePostUpvote(String(postUpvoteId));
    }
  }

  for (const [postTagId, postTag] of postTagsCollection.entries()) {
    if (currentTargetPostIds.has(postTag.postId) && !postTagIds.has(postTag.id)) {
      removePostTag(String(postTagId));
    }
  }

  for (const [postId, post] of postsCollection.entries()) {
    if (targetSpaceIds.has(post.spaceId) && !postIds.has(post.id)) {
      removePost(String(postId));
    }
  }

  for (const [categoryId, category] of categoriesCollection.entries()) {
    if (targetSpaceIds.has(category.spaceId) && !categoryIds.has(category.id)) {
      removeCategory(String(categoryId));
    }
  }

  for (const [tagId, tag] of tagsCollection.entries()) {
    if (targetSpaceIds.has(tag.spaceId) && !tagIds.has(tag.id)) {
      removeTag(String(tagId));
    }
  }
}

async function fetchApiSnapshot(spaceSlug: string): Promise<{
  snapshot: PostsSnapshot;
  spaceId: string;
}> {
  const payload = await fetchPostsSpaceFeed(spaceSlug);
  return {
    snapshot: payload.snapshot,
    spaceId: payload.spaceId,
  };
}

async function fetchShapeSnapshot(spaceSlug: string): Promise<PostsSnapshot> {
  const postsUrl = getPostsShapeUrl();
  const commentsUrl = getCommentsShapeUrl();
  const postUpvotesUrl = getPostUpvotesShapeUrl();
  const categoriesUrl = getCategoriesShapeUrl();
  const tagsUrl = getTagsShapeUrl();
  const postTagsUrl = getPostTagsShapeUrl();

  if (!postsUrl || !commentsUrl || !postUpvotesUrl || !categoriesUrl || !tagsUrl || !postTagsUrl) {
    const payload = await fetchApiSnapshot(spaceSlug);
    return payload.snapshot;
  }

  const [
    postsPayload,
    commentsPayload,
    postUpvotesPayload,
    categoriesPayload,
    tagsPayload,
    postTagsPayload,
  ] = await Promise.all([
    fetchShapeRows<Post>(withSpaceSlug(postsUrl, spaceSlug)),
    fetchShapeRows<Comment>(withSpaceSlug(commentsUrl, spaceSlug)),
    fetchShapeRows<PostUpvote>(withSpaceSlug(postUpvotesUrl, spaceSlug)),
    fetchShapeRows<Category>(withSpaceSlug(categoriesUrl, spaceSlug)),
    fetchShapeRows<Tag>(withSpaceSlug(tagsUrl, spaceSlug)),
    fetchShapeRows<PostTag>(withSpaceSlug(postTagsUrl, spaceSlug)),
  ]).catch(async () => {
    const payload = await fetchApiSnapshot(spaceSlug);
    return [
      payload.snapshot.posts,
      payload.snapshot.comments,
      payload.snapshot.postUpvotes,
      payload.snapshot.categories,
      payload.snapshot.tags,
      payload.snapshot.postTags,
    ] as [Post[], Comment[], PostUpvote[], Category[], Tag[], PostTag[]];
  });

  return {
    posts: postsPayload,
    comments: commentsPayload,
    postUpvotes: postUpvotesPayload,
    categories: categoriesPayload,
    tags: tagsPayload,
    postTags: postTagsPayload,
  };
}

function withSpaceSlug(url: string, spaceSlug: string): string {
  const withOrigin = new URL(url, window.location.origin);
  withOrigin.searchParams.set("spaceSlug", spaceSlug);
  return withOrigin.toString();
}

async function fetchShapeRows<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { credentials: "include" });
  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error("Shape proxy request failed.");
  }
  const rows = (payload as { rows?: unknown[] }).rows;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows as T[];
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function findSpaceIdBySlug(spaceSlug: string): string | null {
  for (const [, space] of spacesCollection.entries()) {
    if (space.slug === spaceSlug) {
      return space.id;
    }
  }
  return null;
}
