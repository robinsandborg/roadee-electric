# PRD: Community Feedback Platform

## 1. Introduction/Overview

Build a community-led feedback platform where product companies create a dedicated space, users join by link, and everyone collaborates on suggestions. Users can create and discuss posts, upvote ideas, and track lifecycle progress from suggestion to GA. Staff can moderate content and publish a clear "Product Understanding" clarification above the original thread without altering the user's original request.

The product will prioritize local-first UX and live sync speed as a key competitive advantage.

## 2. Goals

- Let any authenticated user create a product space.
- Let users join a space by link and participate immediately.
- Make idea collaboration live: upvotes/comments/status updates appear without page refresh.
- Keep user-generated original requests intact while allowing staff clarification.
- Support product feedback taxonomy with categories and tags.
- Ship on a client-first architecture (TanStack Start SPA + TanStack DB + ElectricSQL).

## 3. User Stories

### US-001: Create product space
**Description:** As an authenticated user, I want to create a product space so that I can run a feedback community for my product.

**Acceptance Criteria:**
- [ ] "Create space" form exists for authenticated users.
- [ ] Space has required fields: name, slug, description.
- [ ] Created space is immediately available in local state and synced to other clients.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Join space by link
**Description:** As an authenticated user, I want to join a space by opening its link so that I can participate without requiring manual staff approval.

**Acceptance Criteria:**
- [ ] Visiting `/s/:spaceSlug` prompts login if unauthenticated.
- [ ] Authenticated users are auto-added as `user` member on first visit.
- [ ] Joining is idempotent (repeat visits do not duplicate membership).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Social sign-in
**Description:** As a user, I want to sign in with Google or GitHub so that onboarding is fast.

**Acceptance Criteria:**
- [ ] Google OAuth login works end-to-end.
- [ ] GitHub OAuth login works end-to-end.
- [ ] First login creates a user profile record.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Add staff colleagues
**Description:** As a space owner/staff member, I want to add colleagues as staff so that we can jointly manage the community.

**Acceptance Criteria:**
- [ ] Staff can invite existing users to `staff` role.
- [ ] Role change is reflected immediately in member list UI.
- [ ] Non-staff users cannot grant staff role.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Staff identity visibility
**Description:** As a community user, I want to clearly see staff titles and profiles so that I know when a response is official.

**Acceptance Criteria:**
- [ ] Staff comments/posts show badge and staff title.
- [ ] Non-staff users do not show staff badge.
- [ ] Profile card is visible from post/comment author row.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Create suggestion posts
**Description:** As a user, I want to create posts with rich text, category, tags, and an optional image so that I can communicate ideas clearly.

**Acceptance Criteria:**
- [ ] Post editor supports rich text body.
- [ ] Post requires exactly one category.
- [ ] Post supports multiple tags.
- [ ] Post supports optional image upload via UploadThing.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Comment, upvote, and edit own posts
**Description:** As a user, I want to discuss and support ideas so that good suggestions rise.

**Acceptance Criteria:**
- [ ] Users can add comments to posts.
- [ ] Users can upvote posts once and remove their own upvote.
- [ ] Users can edit only their own posts.
- [ ] Upvote count updates live for all connected users without manual refresh.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-008: Staff moderation controls
**Description:** As staff, I want to delete posts/comments that violate rules so that community quality stays high.

**Acceptance Criteria:**
- [ ] Staff can delete any post.
- [ ] Staff can delete any comment.
- [ ] Non-staff users cannot see moderation delete actions.
- [ ] Deleted content is soft-deleted with moderator attribution in audit fields.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-009: Clarification document above thread
**Description:** As staff, I want to publish a "Product Understanding" clarification above a suggestion so that users can see our interpreted scope while preserving their original request.

**Acceptance Criteria:**
- [ ] Staff can create/update a clarification document linked to a post.
- [ ] Clarification renders above thread content for all users immediately.
- [ ] Original post content is preserved and never overwritten by clarification updates.
- [ ] Clarification keeps version history (`createdAt`, `updatedAt`, editor).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-010: Post lifecycle status progression
**Description:** As staff, I want to move posts through suggestion, selected, beta, and GA so users can track progress.

**Acceptance Criteria:**
- [ ] Allowed statuses: `suggestion`, `selected_for_development`, `beta_available`, `ga`.
- [ ] Staff can transition status forward using controlled actions.
- [ ] Status changes appear live across clients.
- [ ] Timeline/history is visible on the post.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-011: Category and tag management
**Description:** As staff, I want to manage available categories and tags per space so taxonomy matches our product.

**Acceptance Criteria:**
- [ ] Space has configurable categories (e.g. bug, feature, question).
- [ ] Space has configurable tags (e.g. feed, messages, search).
- [ ] New posts validate category and tags against active space definitions.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-012: Local-first sync engine integration
**Description:** As a developer, I want TanStack DB integrated with ElectricSQL so that all core entities are local-first and sync live across users.

**Acceptance Criteria:**
- [ ] Core entities (spaces, memberships, posts, comments, upvotes, clarifications, statuses, categories, tags) are represented in TanStack DB collections.
- [ ] ElectricSQL Shapes are defined per space with row-level filtering.
- [ ] Mutations are optimistic in TanStack DB and reconcile with ElectricSQL replication.
- [ ] Offline-created mutations queue locally and sync when reconnecting.
- [ ] Typecheck/lint passes.

### US-013: Image upload pipeline
**Description:** As a developer, I want UploadThing integrated for post images so uploads are reliable and secure.

**Acceptance Criteria:**
- [ ] UploadThing route is configured for authenticated uploads.
- [ ] Uploaded image URL + metadata are persisted on the post record.
- [ ] Image renders in post list and post detail.
- [ ] Failed uploads return user-visible error state without breaking draft post.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: The system must allow any authenticated user to create a product space.
- FR-2: The system must allow any authenticated user with a valid space link to join that space as a `user`.
- FR-3: Authentication providers in V1 must include Google and GitHub.
- FR-4: The system must support roles `owner`, `staff`, and `user` scoped per space.
- FR-5: The system must let staff assign staff role to colleagues in the same space.
- FR-6: Posts must support rich text content and one optional image.
- FR-7: Each post must have exactly one category and zero or more tags.
- FR-8: Users must be able to create posts, comment on posts, upvote posts, and edit only their own posts.
- FR-9: Staff must be able to delete posts and delete comments.
- FR-10: The system must preserve original post content when staff create/edit clarification documents.
- FR-11: Clarification documents must render above the associated thread and be immediately visible to all users.
- FR-12: Post lifecycle statuses must include `suggestion`, `selected_for_development`, `beta_available`, and `ga`.
- FR-13: Staff must be able to transition post lifecycle status; non-staff cannot.
- FR-14: Status, comments, and upvote changes must sync live across connected clients without manual refresh.
- FR-15: The frontend architecture must use TanStack Start in SPA mode with client-side-first logic.
- FR-16: ElectricSQL must be the sync backend and source for multi-user replication.
- FR-17: TanStack DB must be the reactive client database used to read/write synced entities locally.
- FR-18: Server-side code must be limited to cases requiring secrets/trust boundaries (OAuth callbacks, UploadThing signing/authorization, privileged moderation validation where needed).
- FR-19: UploadThing must be used for post image storage and delivery.
- FR-20: SEO-specific rendering/optimization is not required for V1.

## 5. Non-Goals (Out of Scope)

- Email or push notifications for status changes, comments, or mentions.
- Advanced moderation tooling (spam ML, automated abuse scoring, ban evasion detection).
- Public SEO landing page optimization and SSR indexing work.
- Enterprise org hierarchies, SSO/SAML, and custom RBAC beyond owner/staff/user.
- Advanced analytics dashboards beyond minimal product health counters.

## 6. Design Considerations

- Staff identity should be visually distinct and consistent across posts and comments.
- Clarification document should be visually anchored above thread content and labeled as staff-authored interpretation.
- Status progression should be highly legible and visible in both list and detail views.
- Post creation should keep taxonomy selection simple: one category control and multi-tag control.
- Real-time behavior should be visible in UI (for example, upvote counter changing live while viewing).

## 7. Technical Considerations

- Frontend framework: TanStack Start configured for SPA mode.
- Data model and local state: TanStack DB as the primary read/write interface from UI components.
- Sync engine: ElectricSQL Shapes over Postgres for low-latency replication by space scope.
- Local-first behavior:
  - Reads come from local TanStack DB collections.
  - Writes apply optimistically locally, then sync through ElectricSQL.
  - Conflict handling should prefer deterministic merge rules (last-write-wins for editable text fields unless domain-specific rules are required).
- Server usage policy:
  - Default to client-side logic.
  - Add server functions/API only where secrets or authority are required.
- Images:
  - UploadThing handles file upload/storage.
  - Post records store URL plus metadata (size, mime, width/height if available).
- Security:
  - Enforce space-scoped authorization for every mutation path.
  - Ensure staff-only operations are validated at trusted boundary, not only in client UI.
- Performance:
  - Prioritize sync responsiveness for post/comment/upvote/status events over non-critical features.

## 8. Services To Set Up Together

1. Postgres database for ElectricSQL replication source.
2. ElectricSQL service connected to Postgres and configured with per-space shapes.
3. OAuth apps for Google and GitHub authentication credentials.
4. UploadThing app and upload route configuration for authenticated image uploads.
5. Environment variable setup in the app for auth providers, Electric endpoint, and UploadThing keys.

## 9. Success Metrics

- Users can create a space and publish first suggestion in one session without admin intervention.
- In multi-client testing, upvote count changes are reflected on other connected clients without page refresh.
- In multi-client testing, comment and status updates are visible live while viewers remain on page.
- At least 95% of tested core flows (create post, comment, upvote, status change, clarification publish) complete without sync inconsistency or manual retry.
- No SEO regressions are tracked for V1 scope (explicitly deprioritized).

## 10. Open Questions

- Should staff invitations require the target user to already be a member of the space, or can invite + role assignment happen in one step?
- Do we allow status rollback (for example `ga` back to `beta_available`) in V1, or forward-only transitions?
- Should clarification document edits be fully versioned and user-visible (history UI), or only latest version shown in V1?
- What are the initial moderation/audit retention requirements for soft-deleted content?
