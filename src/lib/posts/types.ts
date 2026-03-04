export type JsonObject = Record<string, unknown>;

export type PostRecord = {
  id: string;
  spaceId: string;
  authorId: string;
  title: string;
  bodyRichText: JsonObject;
  imageUrl: string | null;
  imageMeta: JsonObject | null;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentRecord = {
  id: string;
  postId: string;
  spaceId: string;
  authorId: string;
  bodyRichText: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type PostUpvoteRecord = {
  id: string;
  postId: string;
  spaceId: string;
  userId: string;
  createdAt: string;
};

export type CategoryRecord = {
  id: string;
  spaceId: string;
  name: string;
  kind: string;
  createdAt: string;
};

export type TagRecord = {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string;
};

export type PostTagRecord = {
  id: string;
  postId: string;
  tagId: string;
  spaceId: string | null;
};

export type PostsSnapshot = {
  posts: PostRecord[];
  comments: CommentRecord[];
  postUpvotes: PostUpvoteRecord[];
  categories: CategoryRecord[];
  tags: TagRecord[];
  postTags: PostTagRecord[];
};

export type FeedItem = {
  post: PostRecord;
  category: CategoryRecord | null;
  tags: TagRecord[];
  upvoteCount: number;
  commentCount: number;
  hasUpvoted: boolean;
};

export type PostThread = {
  item: FeedItem;
  comments: CommentRecord[];
};

export type CreatePostInput = {
  id?: string;
  spaceSlug: string;
  actorUserId: string;
  title: string;
  bodyRichText: JsonObject;
  imageUrl?: string | null;
  imageMeta?: JsonObject | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tagIds?: string[];
  tagNames?: string[];
};

export type UpdateOwnPostInput = {
  postId: string;
  actorUserId: string;
  title: string;
  bodyRichText: JsonObject;
  imageUrl?: string | null;
  imageMeta?: JsonObject | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tagIds?: string[];
  tagNames?: string[];
};

export type CreateCommentInput = {
  id?: string;
  postId: string;
  actorUserId: string;
  bodyRichText: JsonObject;
};

export type ToggleUpvoteInput = {
  id?: string;
  postId: string;
  actorUserId: string;
};

export type ListFeedBySpaceInput = {
  spaceSlug: string;
  actorUserId: string;
};

export type GetPostThreadByIdInput = {
  postId: string;
  actorUserId: string;
};

export type ListTaxonomyBySpaceInput = {
  spaceSlug: string;
  actorUserId: string;
};

export type ToggleUpvoteResult = {
  upvoted: boolean;
  upvote: PostUpvoteRecord | null;
  txid: number;
};
