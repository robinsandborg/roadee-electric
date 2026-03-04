import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { postsService } from "#/lib/posts/service.server";
import { PostsServiceError } from "#/lib/posts/service";
import { authedProcedure, router } from "#/lib/trpc";

const JsonObjectSchema = z.record(z.string(), z.unknown());

const createPostInput = z.object({
  id: z.string().optional(),
  spaceSlug: z.string().min(1),
  title: z.string(),
  bodyRichText: JsonObjectSchema,
  imageUrl: z.string().nullable().optional(),
  imageMeta: JsonObjectSchema.nullable().optional(),
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
});

const updatePostInput = z.object({
  postId: z.string().min(1),
  title: z.string(),
  bodyRichText: JsonObjectSchema,
  imageUrl: z.string().nullable().optional(),
  imageMeta: JsonObjectSchema.nullable().optional(),
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
});

const createCommentInput = z.object({
  id: z.string().optional(),
  postId: z.string().min(1),
  bodyRichText: JsonObjectSchema,
});

const toggleUpvoteInput = z.object({
  id: z.string().optional(),
  postId: z.string().min(1),
});

export const postsRouter = router({
  create: authedProcedure.input(createPostInput).mutation(async ({ ctx, input }) => {
    try {
      return await postsService.createPost({
        ...input,
        actorUserId: ctx.session.user.id,
      });
    } catch (error) {
      throw mapPostsError(error);
    }
  }),

  update: authedProcedure.input(updatePostInput).mutation(async ({ ctx, input }) => {
    try {
      return await postsService.updateOwnPost({
        ...input,
        actorUserId: ctx.session.user.id,
      });
    } catch (error) {
      throw mapPostsError(error);
    }
  }),

  createComment: authedProcedure.input(createCommentInput).mutation(async ({ ctx, input }) => {
    try {
      return await postsService.createComment({
        ...input,
        actorUserId: ctx.session.user.id,
      });
    } catch (error) {
      throw mapPostsError(error);
    }
  }),

  toggleUpvote: authedProcedure.input(toggleUpvoteInput).mutation(async ({ ctx, input }) => {
    try {
      return await postsService.toggleUpvote({
        ...input,
        actorUserId: ctx.session.user.id,
      });
    } catch (error) {
      throw mapPostsError(error);
    }
  }),
});

function mapPostsError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof PostsServiceError) {
    switch (error.code) {
      case "space_not_found":
      case "post_not_found":
        return new TRPCError({ code: "NOT_FOUND", message: error.message });
      case "membership_required":
      case "forbidden":
        return new TRPCError({ code: "FORBIDDEN", message: error.message });
      case "conflict":
        return new TRPCError({ code: "CONFLICT", message: error.message });
      case "invalid_input":
      case "invalid_category_scope":
      case "invalid_tag_scope":
      default:
        return new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected error." });
}
