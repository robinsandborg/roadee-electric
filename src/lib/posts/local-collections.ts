import {
  postTagsCollection,
  postUpvotesCollection,
  removePostTag,
  removePostUpvote,
  upsertPostTag,
  upsertPostUpvote,
  type PostTag,
  type PostUpvote,
} from "#/db-collections";

export function listUpvotesForPostUser(postId: string, userId: string): PostUpvote[] {
  const rows: PostUpvote[] = [];

  for (const [, upvote] of postUpvotesCollection.entries()) {
    if (upvote.postId === postId && upvote.userId === userId) {
      rows.push(upvote);
    }
  }

  return rows;
}

export function reconcileUpvotesForPostUser(
  postId: string,
  userId: string,
  canonicalUpvote: PostUpvote | null,
): void {
  for (const [upvoteId, upvote] of postUpvotesCollection.entries()) {
    if (upvote.postId === postId && upvote.userId === userId) {
      removePostUpvote(String(upvoteId));
    }
  }

  if (canonicalUpvote) {
    upsertPostUpvote(canonicalUpvote);
  }
}

export function replacePostTagsForPost(postId: string, nextPostTags: PostTag[]): void {
  for (const [postTagId, postTag] of postTagsCollection.entries()) {
    if (postTag.postId === postId) {
      removePostTag(String(postTagId));
    }
  }

  for (const postTag of nextPostTags) {
    upsertPostTag(postTag);
  }
}
