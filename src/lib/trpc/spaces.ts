import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invalidateScopedSpaceIdsCacheForUser } from "#/lib/posts/shape.server";
import {
  createSpaceWithOwnerInDb,
  joinSpaceBySlugInDb,
  promoteMemberToStaffInDb,
} from "#/lib/spaces/repository.server";
import { SpacesServiceError } from "#/lib/spaces/service";
import { isValidSpaceSlug, normalizeSpaceSlug } from "#/lib/space-slug";
import { authedProcedure, router } from "#/lib/trpc";

const createSpaceInput = z.object({
  id: z.string().optional(),
  ownerMembershipId: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
});

const joinSpaceInput = z.object({
  membershipId: z.string().optional(),
  spaceSlug: z.string().min(1),
});

const promoteMemberInput = z.object({
  spaceSlug: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const spacesRouter = router({
  create: authedProcedure.input(createSpaceInput).mutation(async ({ ctx, input }) => {
    const slug = normalizeSpaceSlug(input.slug);
    if (!isValidSpaceSlug(slug)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Slug must be lowercase letters, numbers, and dashes.",
      });
    }

    try {
      const created = await createSpaceWithOwnerInDb({
        ...input,
        slug,
        createdBy: ctx.session.user.id,
      });

      invalidateScopedSpaceIdsCacheForUser(ctx.session.user.id);
      return created;
    } catch (error) {
      throw mapSpacesError(error);
    }
  }),

  join: authedProcedure.input(joinSpaceInput).mutation(async ({ ctx, input }) => {
    try {
      const joined = await joinSpaceBySlugInDb({
        ...input,
        userId: ctx.session.user.id,
      });

      invalidateScopedSpaceIdsCacheForUser(ctx.session.user.id);
      return joined;
    } catch (error) {
      throw mapSpacesError(error);
    }
  }),

  promote: authedProcedure.input(promoteMemberInput).mutation(async ({ ctx, input }) => {
    try {
      const promoted = await promoteMemberToStaffInDb({
        ...input,
        actorUserId: ctx.session.user.id,
      });

      invalidateScopedSpaceIdsCacheForUser(ctx.session.user.id);
      invalidateScopedSpaceIdsCacheForUser(input.targetUserId);
      return promoted;
    } catch (error) {
      throw mapSpacesError(error);
    }
  }),
});

function mapSpacesError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof SpacesServiceError) {
    switch (error.code) {
      case "space_not_found":
      case "target_not_found":
        return new TRPCError({ code: "NOT_FOUND", message: error.message });
      case "forbidden":
      case "membership_required":
        return new TRPCError({ code: "FORBIDDEN", message: error.message });
      case "slug_conflict":
        return new TRPCError({ code: "CONFLICT", message: error.message });
      case "invalid_slug":
      default:
        return new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected error." });
}
