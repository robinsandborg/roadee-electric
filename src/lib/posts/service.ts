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
  TagRecord,
  ToggleUpvoteInput,
  ToggleUpvoteResult,
  UpdateOwnPostInput,
  PostsSnapshot,
} from "#/lib/posts/types";

export type PostsServiceErrorCode =
  | "invalid_input"
  | "space_not_found"
  | "post_not_found"
  | "membership_required"
  | "forbidden"
  | "invalid_category_scope"
  | "invalid_tag_scope"
  | "conflict";

export class PostsServiceError extends Error {
  code: PostsServiceErrorCode;

  constructor(code: PostsServiceErrorCode, message: string) {
    super(message);
    this.name = "PostsServiceError";
    this.code = code;
  }
}

export type PostsRepository = {
  createPost(
    input: CreatePostInput,
  ): Promise<{ post: PostRecord; postTags: PostTagRecord[]; txid: number }>;
  updateOwnPost(
    input: UpdateOwnPostInput,
  ): Promise<{ post: PostRecord; postTags: PostTagRecord[]; txid: number }>;
  createComment(input: CreateCommentInput): Promise<{ comment: CommentRecord; txid: number }>;
  toggleUpvote(input: ToggleUpvoteInput): Promise<ToggleUpvoteResult>;
  listFeedBySpace(input: ListFeedBySpaceInput): Promise<{
    spaceId: string;
    feed: FeedItem[];
  }>;
  getPostThreadById(input: GetPostThreadByIdInput): Promise<PostThread>;
  listTaxonomyBySpace(input: ListTaxonomyBySpaceInput): Promise<{
    spaceId: string;
    categories: CategoryRecord[];
    tags: TagRecord[];
  }>;
  listSnapshotBySpace(input: ListTaxonomyBySpaceInput): Promise<{
    spaceId: string;
    snapshot: PostsSnapshot;
  }>;
};

export function createPostsService(repository: PostsRepository) {
  return {
    async createPost(input: CreatePostInput) {
      const title = input.title.trim();
      if (!title) {
        throw new PostsServiceError("invalid_input", "Title is required.");
      }
      if (!isRichTextObject(input.bodyRichText)) {
        throw new PostsServiceError("invalid_input", "bodyRichText must be a JSON object.");
      }

      return repository.createPost({
        ...input,
        title,
        categoryName: normalizeOptionalName(input.categoryName),
        tagIds: dedupeStrings(input.tagIds ?? []),
        tagNames: dedupeStrings(
          (input.tagNames ?? []).map((value) => value.trim()).filter(Boolean),
        ),
      });
    },

    async updateOwnPost(input: UpdateOwnPostInput) {
      const title = input.title.trim();
      if (!title) {
        throw new PostsServiceError("invalid_input", "Title is required.");
      }
      if (!isRichTextObject(input.bodyRichText)) {
        throw new PostsServiceError("invalid_input", "bodyRichText must be a JSON object.");
      }

      return repository.updateOwnPost({
        ...input,
        title,
        categoryName: normalizeOptionalName(input.categoryName),
        tagIds: dedupeStrings(input.tagIds ?? []),
        tagNames: dedupeStrings(
          (input.tagNames ?? []).map((value) => value.trim()).filter(Boolean),
        ),
      });
    },

    async createComment(input: CreateCommentInput) {
      if (!isRichTextObject(input.bodyRichText)) {
        throw new PostsServiceError("invalid_input", "bodyRichText must be a JSON object.");
      }
      return repository.createComment(input);
    },

    async toggleUpvote(input: ToggleUpvoteInput) {
      return repository.toggleUpvote(input);
    },

    async listFeedBySpace(input: ListFeedBySpaceInput) {
      if (!input.spaceSlug.trim()) {
        throw new PostsServiceError("invalid_input", "spaceSlug is required.");
      }
      return repository.listFeedBySpace(input);
    },

    async getPostThreadById(input: GetPostThreadByIdInput) {
      if (!input.postId.trim()) {
        throw new PostsServiceError("invalid_input", "postId is required.");
      }
      return repository.getPostThreadById(input);
    },

    async listTaxonomyBySpace(input: ListTaxonomyBySpaceInput) {
      if (!input.spaceSlug.trim()) {
        throw new PostsServiceError("invalid_input", "spaceSlug is required.");
      }
      return repository.listTaxonomyBySpace(input);
    },

    async listSnapshotBySpace(input: ListTaxonomyBySpaceInput) {
      if (!input.spaceSlug.trim()) {
        throw new PostsServiceError("invalid_input", "spaceSlug is required.");
      }
      return repository.listSnapshotBySpace(input);
    },
  };
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeOptionalName(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRichTextObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
