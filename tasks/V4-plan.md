# V4 Plan: Clarification Document, Lifecycle Status, and Live-Sync Polish

## Objective

Enable staff to publish a "Product Understanding" clarification above each thread, move ideas through lifecycle states, and ensure these updates feel live across users.

## Scope

- In scope: clarification document authoring and display above thread.
- In scope: controlled status transitions (`suggestion`, `selected_for_development`, `beta_available`, `ga`).
- In scope: timeline/history rendering for status and clarification changes.
- In scope: sync observability for perceived live updates.
- Out of scope: notifications and external release announcement systems.

## PRD Coverage

- US-009, US-010 and sync goals from US-012.
- FR-10, FR-11, FR-12, FR-13, FR-14.

## Planned Work

1. Add clarification data model linked to post with immutable reference semantics.
2. Implement staff clarification editor and public clarification panel.
3. Add status transition controls guarded by role and allowed transition rules.
4. Add timeline events for status and clarification updates.
5. Add sync freshness indicator and multi-client verification harness.

## Data Model

- `clarifications`
  - `id`, `postId`, `spaceId`, `bodyRichText`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `version`
- `post_timeline_events`
  - `id`, `postId`, `spaceId`, `eventType`, `actorId`, `payloadJson`, `createdAt`
- Extend `posts`
  - `status` enum: `suggestion`, `selected_for_development`, `beta_available`, `ga`
  - `statusChangedAt`

## Routes and UI

- `/s/:spaceSlug/p/:postId`:
  - clarification panel above original thread content.
  - staff-only clarification editor.
  - status badge and transition actions.
  - lifecycle timeline with recent events.
  - live activity indicator for incoming replicated changes.

## Sync and Mutation Design

1. Electric Shapes include `clarifications`, `post_timeline_events`, and `posts.status`.
2. Trusted mutations:
   - `upsertClarification`
   - `transitionPostStatus`
3. Mutation behaviors:
   - Clarification updates append/update timeline event.
   - Status changes validate transition rules and append timeline event.
4. Local-first UX:
   - optimistic status badge updates.
   - optimistic clarification panel refresh with reconciliation.

## Authorization and Rules

- Only `owner` and `staff` can create/edit clarifications.
- Only `owner` and `staff` can change status.
- Allowed status transitions for V1:
  - `suggestion -> selected_for_development`
  - `selected_for_development -> beta_available`
  - `beta_available -> ga`

## Validation

1. Clarification appears above thread immediately after save and original post remains unchanged.
2. Status transition updates feed and detail views live across two concurrent clients.
3. Invalid transitions are blocked with clear error.
4. Timeline events show actor and timestamp for both clarification and status changes.
5. Freshness indicator reflects recent incoming updates.
6. Typecheck/lint passes.
7. Browser verification run for clarification/status/timeline flows.

## Risks and Mitigations

- Risk: timeline/event duplication on reconnect.
- Mitigation: idempotency key per mutation event and deterministic insert guards.
- Risk: status drift between local optimistic state and replicated canonical state.
- Mitigation: reconcile status from synced source-of-truth and surface non-blocking mismatch recovery.

## Exit Criteria

- Staff can operationalize ideas publicly without losing original context, and users see lifecycle movement in near-real-time.
