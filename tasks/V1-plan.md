# V1 Plan: Auth, Spaces, and Membership

## Objective

Enable authenticated users to create product spaces and allow authenticated users to join spaces by link with idempotent membership creation.

## Scope

- In scope: Google/GitHub auth flow integration points.
- In scope: `spaces` and `memberships` data model, create/join flows.
- In scope: colleague promotion to staff.
- Out of scope: posts/comments/upvotes.

## PRD Coverage

- US-001, US-002, US-003, US-004.
- FR-1, FR-2, FR-3, FR-4, FR-5, FR-15, FR-16, FR-17, FR-18.

## Planned Work

1. Define `spaces` and `memberships` tables in Postgres and mirror collections in TanStack DB.
2. Configure ElectricSQL Shapes for current-user-visible spaces/memberships.
3. Implement create-space flow with owner membership bootstrap.
4. Implement auto-join by slug flow as `user` role.
5. Implement staff promotion action with trusted authorization check.

## Data Model

- `spaces`
  - `id`, `slug` (unique), `name`, `description`, `createdBy`, `createdAt`, `updatedAt`
- `memberships`
  - `id`, `spaceId`, `userId`, `role` (`owner` | `staff` | `user`), `title`, `createdAt`, `updatedAt`
  - Unique index: (`spaceId`, `userId`)

## Routes and UI

- `/spaces/new`: create space form.
- `/s/:spaceSlug`: join gate + space shell.
- `/s/:spaceSlug/settings/members`: membership management screen for staff actions.

## Sync and Mutation Design

1. TanStack DB collections:
   - `spacesCollection`
   - `membershipsCollection`
2. Electric Shapes:
   - Spaces where user has membership.
   - Membership rows for those spaces.
3. Mutations:
   - `createSpace` optimistic insert + rollback on slug conflict.
   - `joinSpaceBySlug` optimistic membership upsert.
   - `promoteMemberToStaff` non-public trusted mutation endpoint.

## Authorization Rules

- Any authenticated user may create a space.
- Any authenticated user may join a space via valid slug link.
- Only `owner` or `staff` may promote colleagues to `staff`.

## Validation

1. Create space persists and appears live in another signed-in client with matching permissions.
2. Join by slug is idempotent and does not duplicate memberships.
3. Non-staff cannot promote staff.
4. Typecheck/lint passes.
5. Browser verification run for create/join/promote flows.

## Risks and Mitigations

- Risk: slug collisions under concurrent creation.
- Mitigation: unique DB index + optimistic UI fallback with slug suggestion.
- Risk: unauthorized staff promotion via direct mutation call.
- Mitigation: enforce role checks server-side/trusted boundary.

## Exit Criteria

- Two users can complete create-and-join flow end-to-end with correct roles and synced state.
