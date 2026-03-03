import {
  createCommentInDb,
  createPostInDb,
  getPostThreadByIdInDb,
  listFeedBySpaceInDb,
  listSnapshotBySpaceInDb,
  listTaxonomyBySpaceInDb,
  toggleUpvoteInDb,
  updateOwnPostInDb,
} from "#/lib/posts/repository.server";
import { createPostsService } from "#/lib/posts/service";

export const postsService = createPostsService({
  createPost: createPostInDb,
  updateOwnPost: updateOwnPostInDb,
  createComment: createCommentInDb,
  toggleUpvote: toggleUpvoteInDb,
  listFeedBySpace: listFeedBySpaceInDb,
  getPostThreadById: getPostThreadByIdInDb,
  listTaxonomyBySpace: listTaxonomyBySpaceInDb,
  listSnapshotBySpace: listSnapshotBySpaceInDb,
});
