# V3 Plan: Staff Identity and Moderation

## Objective

Make staff identity explicit in all discussions and ship staff-only moderation controls with auditable soft deletion.

## Scope

- In scope: staff title/profile presentation.
- In scope: delete post/comment actions for staff.
- In scope: moderation metadata and deleted-content rendering behavior.
- Out of scope: clarification document and lifecycle transitions.

## PRD Coverage

- US-005, US-008.
- FR-9 and supporting trust requirements tied to staff identity.

## Planned Work

1. Extend profile/membership projection to include staff title fields used in UI.
2. Add staff badge and profile popover across post/comment components.
3. Implement staff-only delete actions for posts and comments.
4. Add soft-delete model with audit metadata.
5. Ensure non-staff cannot access moderation actions through UI or direct calls.

## Data Model

- Extend `memberships` with visible `title` (if not already present in V1).
- Extend `posts` and `comments` with:
  - `deletedAt`, `deletedBy`, `deleteReason`
- Optional `moderation_events` table:
  - `id`, `spaceId`, `entityType`, `entityId`, `action`, `actorId`, `createdAt`

## Routes and UI

- Shared post/comment UI:
  - staff badge and title near author name.
  - staff-only delete action in overflow menu.
  - deleted state placeholder when soft-deleted.
- `/s/:spaceSlug/settings/members`:
  - staff title editor for colleagues.

## Sync and Mutation Design

1. Update Electric Shapes to include membership title and delete metadata fields.
2. Add trusted mutations:
   - `softDeletePost`
   - `softDeleteComment`
   - `updateStaffTitle`
3. Project deleted entities in list/detail as placeholders rather than removing immediately to keep thread context.

## Authorization Rules

- `softDeletePost` and `softDeleteComment` allowed only for `owner` and `staff`.
- `updateStaffTitle` allowed only for `owner` and `staff`.
- Non-staff direct mutation attempts must return authorization error.

## Validation

1. Staff badge and title render correctly in feed and detail.
2. Staff can delete post/comment and all clients update live.
3. Non-staff cannot invoke delete paths.
4. Deleted items show deterministic placeholder text.
5. Moderation metadata is persisted.
6. Typecheck/lint passes.
7. Browser verification run for identity and moderation flows.

## Risks and Mitigations

- Risk: hard delete accidentally used in some query paths.
- Mitigation: centralize delete behavior in one mutation layer with soft-delete only.
- Risk: identity confusion if staff title is stale on some clients.
- Mitigation: include title in synced membership projection and avoid duplicated local caches.

## Exit Criteria

- Community participants can clearly distinguish staff responses, and moderation is effective and auditable.
