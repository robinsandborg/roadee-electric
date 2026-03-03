import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { z } from "zod";

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

export type Space = z.infer<typeof SpaceSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;
export type Message = z.infer<typeof MessageSchema>;

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

export function upsertSpace(space: Space): void {
  try {
    spacesCollection.insert(space);
  } catch {
    spacesCollection.update(space.id, (draft) => {
      Object.assign(draft, space);
    });
  }
}

export function upsertMembership(membership: Membership): void {
  try {
    membershipsCollection.insert(membership);
  } catch {
    membershipsCollection.update(membership.id, (draft) => {
      Object.assign(draft, membership);
    });
  }
}

export function removeSpace(id: string): void {
  try {
    spacesCollection.delete(id);
  } catch {
    // no-op
  }
}

export function removeMembership(id: string): void {
  try {
    membershipsCollection.delete(id);
  } catch {
    // no-op
  }
}
