import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { z } from "zod";

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

export const messagesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (message) => message.id,
    schema: MessageSchema,
  }),
);

export const spacesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (space) => space.id,
    schema: SpaceSchema,
  }),
);

export const membershipsCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (membership) => membership.id,
    schema: MembershipSchema,
  }),
);

export const postsCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (post) => post.id,
    schema: PostSchema,
  }),
);

export const commentsCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (comment) => comment.id,
    schema: CommentSchema,
  }),
);

export const postUpvotesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (postUpvote) => postUpvote.id,
    schema: PostUpvoteSchema,
  }),
);

export const categoriesCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (category) => category.id,
    schema: CategorySchema,
  }),
);

export const tagsCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (tag) => tag.id,
    schema: TagSchema,
  }),
);

export const postTagsCollection = createCollection(
  localOnlyCollectionOptions({
    getKey: (postTag) => postTag.id,
    schema: PostTagSchema,
  }),
);

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
    insert(value: T): void;
    update(key: string, updater: (draft: T) => void): void;
  },
  id: string,
  value: T,
): void {
  try {
    collection.insert(value);
  } catch {
    collection.update(id, (draft) => {
      Object.assign(draft, value);
    });
  }
}

function removeById(
  collection: {
    delete(key: string): void;
  },
  id: string,
): void {
  try {
    collection.delete(id);
  } catch {
    // no-op
  }
}
