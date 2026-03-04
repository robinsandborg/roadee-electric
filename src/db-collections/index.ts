import { snakeCamelMapper } from "@electric-sql/client";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
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

const electricColumnMapper = snakeCamelMapper();

const spacesShapeUrl = getSpacesShapeUrl();
const membershipsShapeUrl = getMembershipsShapeUrl();
const postsShapeUrl = getPostsShapeUrl();
const commentsShapeUrl = getCommentsShapeUrl();
const postUpvotesShapeUrl = getPostUpvotesShapeUrl();
const categoriesShapeUrl = getCategoriesShapeUrl();
const tagsShapeUrl = getTagsShapeUrl();
const postTagsShapeUrl = getPostTagsShapeUrl();

type CollectionKey = string | number;
type MutationEnvelope<T extends object> = {
  metadata?: unknown;
  original: T;
  modified: T;
};
type InsertParams<T extends object> = { transaction: { mutations: Array<MutationEnvelope<T>> } };
type UpdateParams<T extends object> = { transaction: { mutations: Array<MutationEnvelope<T>> } };
type DeleteParams<T extends object> = { transaction: { mutations: Array<MutationEnvelope<T>> } };

function createElectricCollection<T extends object>(input: {
  id: string;
  shapeUrl: string | null;
  schema: z.ZodType<T>;
  getKey: (item: T) => CollectionKey;
  onInsert?: (params: InsertParams<T>) => Promise<{ txid: number | number[] } | void>;
  onUpdate?: (params: UpdateParams<T>) => Promise<{ txid: number | number[] } | void>;
  onDelete?: (params: DeleteParams<T>) => Promise<{ txid: number | number[] } | void>;
}) {
  return createCollection<T>(
    electricCollectionOptions<any>({
      id: input.id,
      schema: input.schema,
      getKey: input.getKey,
      onInsert: input.onInsert as never,
      onUpdate: input.onUpdate as never,
      onDelete: input.onDelete as never,
      shapeOptions: {
        url: requireShapeUrl(input.id, input.shapeUrl),
        liveSse: true,
        columnMapper: electricColumnMapper,
      },
    }) as never,
  );
}

function requireShapeUrl(collectionId: string, shapeUrl: string | null): string {
  if (shapeUrl && shapeUrl.trim().length > 0) {
    return shapeUrl;
  }
  throw new Error(
    `Missing Electric shape URL for "${collectionId}". Set VITE_ELECTRIC_SHAPE_PROXY_URL.`,
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

function assertServerOnlyMutation(
  operation: string,
  transaction: { mutations: Array<{ metadata?: unknown }> },
): void {
  for (const mutation of transaction.mutations) {
    const metadata = readMutationMetadata(mutation.metadata);
    if (!isServerMutation(metadata)) {
      throw new Error(`Unsupported ${operation} mutation source for server-managed collection.`);
    }
  }
}

const spacesHandlers = {
  onInsert: async ({ transaction }: InsertParams<Space>) => {
    assertServerOnlyMutation("space insert", transaction);
  },
  onUpdate: async ({ transaction }: UpdateParams<Space>) => {
    assertServerOnlyMutation("space update", transaction);
  },
  onDelete: async ({ transaction }: DeleteParams<Space>) => {
    assertServerOnlyMutation("space delete", transaction);
  },
};

const membershipsHandlers = {
  onInsert: async ({ transaction }: InsertParams<Membership>) => {
    assertServerOnlyMutation("membership insert", transaction);
  },
  onDelete: async ({ transaction }: DeleteParams<Membership>) => {
    assertServerOnlyMutation("membership delete", transaction);
  },
  onUpdate: async ({ transaction }: UpdateParams<Membership>) => {
    const txids: number[] = [];
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

      const result = await promoteMemberToStaffRequest({
        spaceSlug,
        targetUserId,
      });
      txids.push(result.txid);
    }

    if (txids.length === 1) {
      return { txid: txids[0] };
    }
    if (txids.length > 1) {
      return { txid: txids };
    }
  },
};

const postsHandlers = {
  onDelete: async ({ transaction }: DeleteParams<Post>) => {
    assertServerOnlyMutation("post delete", transaction);
  },
  onInsert: async ({ transaction }: InsertParams<Post>) => {
    const txids: number[] = [];
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

      const result = await createPostRequest({
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
      txids.push(result.txid);
    }
    if (txids.length === 1) {
      return { txid: txids[0] };
    }
    if (txids.length > 1) {
      return { txid: txids };
    }
  },
  onUpdate: async ({ transaction }: UpdateParams<Post>) => {
    const txids: number[] = [];
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "update-post") {
        throw new Error("Unsupported post update action.");
      }

      const post = mutation.modified as Post;
      const result = await updateOwnPostRequest({
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
      txids.push(result.txid);
    }
    if (txids.length === 1) {
      return { txid: txids[0] };
    }
    if (txids.length > 1) {
      return { txid: txids };
    }
  },
};

const commentsHandlers = {
  onUpdate: async ({ transaction }: UpdateParams<Comment>) => {
    assertServerOnlyMutation("comment update", transaction);
  },
  onDelete: async ({ transaction }: DeleteParams<Comment>) => {
    assertServerOnlyMutation("comment delete", transaction);
  },
  onInsert: async ({ transaction }: InsertParams<Comment>) => {
    const txids: number[] = [];
    for (const mutation of transaction.mutations) {
      const metadata = readMutationMetadata(mutation.metadata);
      if (isServerMutation(metadata)) {
        continue;
      }

      if (metadata.action !== "create-comment") {
        throw new Error("Unsupported comment insert action.");
      }

      const comment = mutation.modified as Comment;
      const result = await createCommentRequest({
        id: asString(comment.id),
        postId: asString(comment.postId),
        bodyRichText: asJsonObject(comment.bodyRichText),
      });
      txids.push(result.txid);
    }
    if (txids.length === 1) {
      return { txid: txids[0] };
    }
    if (txids.length > 1) {
      return { txid: txids };
    }
  },
};

const postUpvotesHandlers = {
  onUpdate: async ({ transaction }: UpdateParams<PostUpvote>) => {
    assertServerOnlyMutation("post upvote update", transaction);
  },
  onInsert: async ({ transaction }: InsertParams<PostUpvote>) => {
    const txids: number[] = [];
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
      txids.push(result.txid);
    }
    if (txids.length === 1) {
      return { txid: txids[0] };
    }
    if (txids.length > 1) {
      return { txid: txids };
    }
  },
  onDelete: async ({ transaction }: DeleteParams<PostUpvote>) => {
    const txids: number[] = [];
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
      txids.push(result.txid);
    }
    if (txids.length === 1) {
      return { txid: txids[0] };
    }
    if (txids.length > 1) {
      return { txid: txids };
    }
  },
};

const categoriesHandlers = {
  onInsert: async ({ transaction }: InsertParams<Category>) => {
    assertServerOnlyMutation("category insert", transaction);
  },
  onUpdate: async ({ transaction }: UpdateParams<Category>) => {
    assertServerOnlyMutation("category update", transaction);
  },
  onDelete: async ({ transaction }: DeleteParams<Category>) => {
    assertServerOnlyMutation("category delete", transaction);
  },
};

const tagsHandlers = {
  onInsert: async ({ transaction }: InsertParams<Tag>) => {
    assertServerOnlyMutation("tag insert", transaction);
  },
  onUpdate: async ({ transaction }: UpdateParams<Tag>) => {
    assertServerOnlyMutation("tag update", transaction);
  },
  onDelete: async ({ transaction }: DeleteParams<Tag>) => {
    assertServerOnlyMutation("tag delete", transaction);
  },
};

const postTagsHandlers = {
  onInsert: async ({ transaction }: InsertParams<PostTag>) => {
    assertServerOnlyMutation("post tag insert", transaction);
  },
  onUpdate: async ({ transaction }: UpdateParams<PostTag>) => {
    assertServerOnlyMutation("post tag update", transaction);
  },
  onDelete: async ({ transaction }: DeleteParams<PostTag>) => {
    assertServerOnlyMutation("post tag delete", transaction);
  },
};

export const messagesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (message) => message.id,
    schema: MessageSchema,
  }),
);

export const spacesCollection = createElectricCollection<Space>({
  id: "spaces",
  schema: SpaceSchema,
  shapeUrl: spacesShapeUrl,
  getKey: (space) => space.id,
  ...spacesHandlers,
});

export const membershipsCollection = createElectricCollection<Membership>({
  id: "memberships",
  schema: MembershipSchema,
  shapeUrl: membershipsShapeUrl,
  getKey: (membership) => membership.id,
  ...membershipsHandlers,
});

export const postsCollection = createElectricCollection<Post>({
  id: "posts",
  schema: PostSchema,
  shapeUrl: postsShapeUrl,
  getKey: (post) => post.id,
  ...postsHandlers,
});

export const commentsCollection = createElectricCollection<Comment>({
  id: "comments",
  schema: CommentSchema,
  shapeUrl: commentsShapeUrl,
  getKey: (comment) => comment.id,
  ...commentsHandlers,
});

export const postUpvotesCollection = createElectricCollection<PostUpvote>({
  id: "postUpvotes",
  schema: PostUpvoteSchema,
  shapeUrl: postUpvotesShapeUrl,
  getKey: (postUpvote) => postUpvote.id,
  ...postUpvotesHandlers,
});

export const categoriesCollection = createElectricCollection<Category>({
  id: "categories",
  schema: CategorySchema,
  shapeUrl: categoriesShapeUrl,
  getKey: (category) => category.id,
  ...categoriesHandlers,
});

export const tagsCollection = createElectricCollection<Tag>({
  id: "tags",
  schema: TagSchema,
  shapeUrl: tagsShapeUrl,
  getKey: (tag) => tag.id,
  ...tagsHandlers,
});

export const postTagsCollection = createElectricCollection<PostTag>({
  id: "postTags",
  schema: PostTagSchema,
  shapeUrl: postTagsShapeUrl,
  getKey: (postTag) => postTag.id,
  ...postTagsHandlers,
});
