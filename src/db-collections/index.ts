import { snakeCamelMapper } from "@electric-sql/client";
import { electricCollectionOptions, isChangeMessage } from "@tanstack/electric-db-collection";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { z } from "zod";
import {
  createCommentRequest,
  createPostRequest,
  toggleUpvoteRequest,
  updateOwnPostRequest,
} from "#/lib/posts/api-client";
import {
  getCategoriesShapeUrl,
  getCommentsShapeUrl,
  getMembershipsShapeUrl,
  getPostTagsShapeUrl,
  getPostsShapeUrl,
  getPostUpvotesShapeUrl,
  getSpacesShapeUrl,
  getTagsShapeUrl,
  isElectricShapeSyncEnabled,
} from "#/lib/electric/client";
import { promoteMemberToStaffRequest } from "#/lib/spaces/api-client";

const JsonObjectSchema = z.record(z.string(), z.unknown());

const SpaceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MessageSchema = z.object({
  id: z.number(),
  text: z.string(),
  user: z.string(),
});

const MembershipRoleSchema = z.enum(["owner", "staff", "user"]);

const MembershipSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  userId: z.string(),
  role: MembershipRoleSchema,
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PostSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  authorId: z.string(),
  title: z.string(),
  bodyRichText: JsonObjectSchema,
  imageUrl: z.string().nullable(),
  imageMeta: JsonObjectSchema.nullable(),
  categoryId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  spaceId: z.string(),
  authorId: z.string(),
  bodyRichText: JsonObjectSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PostUpvoteSchema = z.object({
  id: z.string(),
  postId: z.string(),
  spaceId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
});

const CategorySchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  kind: z.string(),
  createdAt: z.string(),
});

const TagSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

const PostTagSchema = z.object({
  id: z.string(),
  postId: z.string(),
  tagId: z.string(),
  spaceId: z.string().nullable(),
});

export type Space = z.infer<typeof SpaceSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type PostUpvote = z.infer<typeof PostUpvoteSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Tag = z.infer<typeof TagSchema>;
export type PostTag = z.infer<typeof PostTagSchema>;

const electricEnabled = typeof window !== "undefined" && isElectricShapeSyncEnabled();
const electricColumnMapper = snakeCamelMapper();
const SYNC_WAIT_TIMEOUT_MS = 12_000;
const SERVER_MUTATION_METADATA = { source: "server" } as const;

const spacesShapeUrl = getSpacesShapeUrl();
const membershipsShapeUrl = getMembershipsShapeUrl();
const postsShapeUrl = getPostsShapeUrl();
const commentsShapeUrl = getCommentsShapeUrl();
const postUpvotesShapeUrl = getPostUpvotesShapeUrl();
const categoriesShapeUrl = getCategoriesShapeUrl();
const tagsShapeUrl = getTagsShapeUrl();
const postTagsShapeUrl = getPostTagsShapeUrl();

function createElectricOrLocalCollection<T extends object>(input: {
  id: string;
  shapeUrl: string | null;
  getKey: (item: T) => string | number;
  onInsert?: (params: any) => Promise<void>;
  onUpdate?: (params: any) => Promise<void>;
  onDelete?: (params: any) => Promise<void>;
}) {
  if (electricEnabled && input.shapeUrl) {
    return createCollection<T>(
      electricCollectionOptions<any>({
        id: input.id,
        getKey: input.getKey,
        syncMode: "eager",
        onInsert: input.onInsert,
        onUpdate: input.onUpdate,
        onDelete: input.onDelete,
        shapeOptions: {
          url: input.shapeUrl,
          liveSse: true,
          columnMapper: electricColumnMapper,
        },
      }) as never,
    );
  }

  return createCollection<T>(
    localOnlyCollectionOptions<T>({
      getKey: input.getKey,
    }) as never,
  );
}

function readMutationMetadata(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function isServerMutation(metadata: Record<string, unknown>): boolean {
  return metadata.source === "server";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function waitForUpsertById(collection: any, id: string): Promise<void> {
  await collection.utils.awaitMatch((message: any) => {
    if (!isChangeMessage(message)) {
      return false;
    }

    if (message.headers.operation !== "insert" && message.headers.operation !== "update") {
      return false;
    }

    const payload = message.value as Record<string, unknown> | undefined;
    return String(payload?.id ?? message.key ?? "") === id;
  }, SYNC_WAIT_TIMEOUT_MS);
}

async function waitForDeleteById(collection: any, id: string): Promise<void> {
  await collection.utils.awaitMatch((message: any) => {
    if (!isChangeMessage(message)) {
      return false;
    }

    if (message.headers.operation !== "delete") {
      return false;
    }

    const payload = message.value as Record<string, unknown> | undefined;
    return String(payload?.id ?? message.key ?? "") === id;
  }, SYNC_WAIT_TIMEOUT_MS);
}

function createServerOnlyMutationHandler(operation: string) {
  return async ({ transaction }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (!isServerMutation(metadata)) {
        throw new Error(`Unsupported ${operation} mutation source for server-managed collection.`);
      }
    }
  };
}

const spacesHandlers = {
  onInsert: createServerOnlyMutationHandler("space insert"),
  onUpdate: createServerOnlyMutationHandler("space update"),
  onDelete: createServerOnlyMutationHandler("space delete"),
};

const membershipsHandlers = {
  onInsert: createServerOnlyMutationHandler("membership insert"),
  onDelete: createServerOnlyMutationHandler("membership delete"),
  onUpdate: async ({ transaction, collection }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "promote-member") {
        throw new Error("Unsupported membership update action.");
      }

      const spaceSlug = asString(metadata.spaceSlug);
      const targetUserId = asString(metadata.targetUserId);
      if (!spaceSlug || !targetUserId) {
        throw new Error("promote-member metadata is missing required values.");
      }

      await promoteMemberToStaffRequest({
        spaceSlug,
        targetUserId,
      });

      await waitForUpsertById(collection, asString(mutation.original.id));
    }
  },
};

const postsHandlers = {
  onDelete: createServerOnlyMutationHandler("post delete"),
  onInsert: async ({ transaction, collection }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "create-post") {
        throw new Error("Unsupported post insert action.");
      }

      const post = mutation.modified as Post;
      const spaceSlug = asString(metadata.spaceSlug);
      if (!spaceSlug) {
        throw new Error("create-post metadata is missing spaceSlug.");
      }

      await createPostRequest({
        id: asString(post.id),
        spaceSlug,
        title: asString(post.title),
        bodyRichText: asJsonObject(post.bodyRichText),
        imageUrl: asNullableString(post.imageUrl),
        imageMeta:
          post.imageMeta && typeof post.imageMeta === "object" && !Array.isArray(post.imageMeta)
            ? post.imageMeta
            : null,
        categoryId: asNullableString(post.categoryId),
        categoryName: asNullableString(metadata.categoryName),
        tagIds: asStringArray(metadata.tagIds),
        tagNames: asStringArray(metadata.tagNames),
      });

      await waitForUpsertById(collection, asString(post.id));
    }
  },
  onUpdate: async ({ transaction, collection }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "update-post") {
        throw new Error("Unsupported post update action.");
      }

      const post = mutation.modified as Post;
      await updateOwnPostRequest({
        postId: asString(mutation.original.id),
        title: asString(post.title),
        bodyRichText: asJsonObject(post.bodyRichText),
        imageUrl: asNullableString(post.imageUrl),
        imageMeta:
          post.imageMeta && typeof post.imageMeta === "object" && !Array.isArray(post.imageMeta)
            ? post.imageMeta
            : null,
        categoryId: asNullableString(post.categoryId),
        categoryName: asNullableString(metadata.categoryName),
        tagIds: asStringArray(metadata.tagIds),
        tagNames: asStringArray(metadata.tagNames),
      });

      await waitForUpsertById(collection, asString(mutation.original.id));
    }
  },
};

const commentsHandlers = {
  onUpdate: createServerOnlyMutationHandler("comment update"),
  onDelete: createServerOnlyMutationHandler("comment delete"),
  onInsert: async ({ transaction, collection }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "create-comment") {
        throw new Error("Unsupported comment insert action.");
      }

      const comment = mutation.modified as Comment;
      await createCommentRequest({
        id: asString(comment.id),
        postId: asString(comment.postId),
        bodyRichText: asJsonObject(comment.bodyRichText),
      });

      await waitForUpsertById(collection, asString(comment.id));
    }
  },
};

const postUpvotesHandlers = {
  onUpdate: createServerOnlyMutationHandler("post upvote update"),
  onInsert: async ({ transaction, collection }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "toggle-upvote-on") {
        throw new Error("Unsupported post upvote insert action.");
      }

      const upvote = mutation.modified as PostUpvote;
      const result = await toggleUpvoteRequest({
        id: asString(upvote.id),
        postId: asString(upvote.postId),
      });

      if (!result.upvoted || !result.upvote) {
        throw new Error("Server did not create the expected upvote.");
      }

      await waitForUpsertById(collection, asString(result.upvote.id));
    }
  },
  onDelete: async ({ transaction, collection }: any) => {
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "toggle-upvote-off") {
        throw new Error("Unsupported post upvote delete action.");
      }

      const original = mutation.original as PostUpvote;
      const result = await toggleUpvoteRequest({
        postId: asString(original.postId),
      });

      if (result.upvoted) {
        throw new Error("Server did not remove the upvote.");
      }

      await waitForDeleteById(collection, asString(original.id));
    }
  },
};

const categoriesHandlers = {
  onInsert: createServerOnlyMutationHandler("category insert"),
  onUpdate: createServerOnlyMutationHandler("category update"),
  onDelete: createServerOnlyMutationHandler("category delete"),
};

const tagsHandlers = {
  onInsert: createServerOnlyMutationHandler("tag insert"),
  onUpdate: createServerOnlyMutationHandler("tag update"),
  onDelete: createServerOnlyMutationHandler("tag delete"),
};

const postTagsHandlers = {
  onInsert: createServerOnlyMutationHandler("post tag insert"),
  onUpdate: createServerOnlyMutationHandler("post tag update"),
  onDelete: createServerOnlyMutationHandler("post tag delete"),
};

export const messagesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (message) => message.id,
    schema: MessageSchema,
  }),
);

export const spacesCollection = createElectricOrLocalCollection<Space>({
  id: "spaces",
  shapeUrl: spacesShapeUrl,
  getKey: (space) => space.id,
  ...spacesHandlers,
});

export const membershipsCollection = createElectricOrLocalCollection<Membership>({
  id: "memberships",
  shapeUrl: membershipsShapeUrl,
  getKey: (membership) => membership.id,
  ...membershipsHandlers,
});

export const postsCollection = createElectricOrLocalCollection<Post>({
  id: "posts",
  shapeUrl: postsShapeUrl,
  getKey: (post) => post.id,
  ...postsHandlers,
});

export const commentsCollection = createElectricOrLocalCollection<Comment>({
  id: "comments",
  shapeUrl: commentsShapeUrl,
  getKey: (comment) => comment.id,
  ...commentsHandlers,
});

export const postUpvotesCollection = createElectricOrLocalCollection<PostUpvote>({
  id: "postUpvotes",
  shapeUrl: postUpvotesShapeUrl,
  getKey: (postUpvote) => postUpvote.id,
  ...postUpvotesHandlers,
});

export const categoriesCollection = createElectricOrLocalCollection<Category>({
  id: "categories",
  shapeUrl: categoriesShapeUrl,
  getKey: (category) => category.id,
  ...categoriesHandlers,
});

export const tagsCollection = createElectricOrLocalCollection<Tag>({
  id: "tags",
  shapeUrl: tagsShapeUrl,
  getKey: (tag) => tag.id,
  ...tagsHandlers,
});

export const postTagsCollection = createElectricOrLocalCollection<PostTag>({
  id: "postTags",
  shapeUrl: postTagsShapeUrl,
  getKey: (postTag) => postTag.id,
  ...postTagsHandlers,
});

export function upsertSpace(space: Space): void {
  upsertById(spacesCollection, space.id, space);
}

export function upsertMembership(membership: Membership): void {
  upsertById(membershipsCollection, membership.id, membership);
}

export function upsertPost(post: Post): void {
  upsertById(postsCollection, post.id, post);
}

export function upsertComment(comment: Comment): void {
  upsertById(commentsCollection, comment.id, comment);
}

export function upsertPostUpvote(postUpvote: PostUpvote): void {
  upsertById(postUpvotesCollection, postUpvote.id, postUpvote);
}

export function upsertCategory(category: Category): void {
  upsertById(categoriesCollection, category.id, category);
}

export function upsertTag(tag: Tag): void {
  upsertById(tagsCollection, tag.id, tag);
}

export function upsertPostTag(postTag: PostTag): void {
  upsertById(postTagsCollection, postTag.id, postTag);
}

export function removeSpace(id: string): void {
  removeById(spacesCollection, id);
}

export function removeMembership(id: string): void {
  removeById(membershipsCollection, id);
}

export function removePost(id: string): void {
  removeById(postsCollection, id);
}

export function removeComment(id: string): void {
  removeById(commentsCollection, id);
}

export function removePostUpvote(id: string): void {
  removeById(postUpvotesCollection, id);
}

export function removeCategory(id: string): void {
  removeById(categoriesCollection, id);
}

export function removeTag(id: string): void {
  removeById(tagsCollection, id);
}

export function removePostTag(id: string): void {
  removeById(postTagsCollection, id);
}

function upsertById<T extends object>(
  collection: {
    insert(value: T, config?: { metadata?: unknown }): void;
    update(key: string, config: { metadata?: unknown }, updater: (draft: T) => void): void;
  },
  id: string,
  value: T,
): void {
  try {
    collection.insert(value, { metadata: SERVER_MUTATION_METADATA });
  } catch {
    collection.update(
      id,
      { metadata: SERVER_MUTATION_METADATA },
      (draft) => {
        Object.assign(draft, value);
      },
    );
  }
}

function removeById(
  collection: {
    delete(key: string, config?: { metadata?: unknown }): void;
  },
  id: string,
): void {
  try {
    collection.delete(id, { metadata: SERVER_MUTATION_METADATA });
  } catch {
    // no-op
  }
}
