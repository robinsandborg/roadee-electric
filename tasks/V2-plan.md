# V2 Implementation Task List: Core Posts, Comments, Upvotes, Categories/Tags, and Images

## Goal

Ship V2 community thread workflows so any space member can create rich posts (with optional image), comment, and upvote with local-first sync behavior, while only authors can edit their own posts.

## Scope and PRD Mapping

- User stories: US-006, US-007, US-011, US-013.
- Requirements: FR-6, FR-7, FR-8, FR-14, FR-16, FR-17, FR-19.
- Out of scope: moderation delete flows, clarification document, lifecycle status transitions.

## Execution Order

1. Task 0 (prerequisites, auth persistence, and dependencies)
2. Task 1 (Postgres schema)
3. Task 2 (TanStack DB models and collection upserts)
4. Task 3 (V2 service and repository layer)
5. Task 4 (V2 API routes)
6. Task 5 (Electric shape endpoints and sync wiring)
7. Task 6 (feed and detail route UI)
8. Task 7 (composer, edit flow, and UploadThing)
9. Task 8 (comments and upvotes optimistic interactions)
10. Task 9 (tests and verification)

## Concrete Tasks

### Task 0: Baseline setup for V2

- [ ] Configure Better Auth database persistence in `src/lib/auth.ts`:
  - add Postgres database adapter/pool using `DATABASE_URL`.
  - ensure auth sessions/users are DB-backed (not stateless-only).
- [ ] Standardize and document auth-table ownership:
  - app auth persistence uses Better Auth tables for this app database.
  - `neon_auth.*` tables can be ignored unless Neon Auth is intentionally adopted.
- [ ] Add auth migration/setup command sequence to `README.md`:
  - `pnpm dlx @better-auth/cli migrate`
  - any required `BETTER_AUTH_*` and `DATABASE_URL` prerequisites.
- [ ] Add V2 env var docs to `README.md`:
  - UploadThing keys and app URL callback settings.
  - Any new Electric shape route references.
- [ ] Add/install required rich-text and upload dependencies in `package.json`.
- [ ] Confirm `src/lib/routes.ts` supports V2 routes:
  - `/s/$spaceSlug/new`
  - `/s/$spaceSlug/p/$postId`
  - optional `/s/$spaceSlug/p/$postId/edit`
- [ ] Keep V1 routes functional while V2 routes are being introduced.

Definition of done:

- Sign-in creates persisted auth records in DB (user/session/account tables).
- App boots with V2 env vars documented.
- Route constants exist for all V2 navigation targets.

### Task 1: Postgres schema for posts, comments, upvotes, categories, and tags

- [ ] Create `db/migrations/002_v2_posts_threads.sql`.
- [ ] Create paired rollback migration `db/migrations/002_v2_posts_threads.down.sql`.
- [ ] Add table `posts` with:
  - `id`, `space_id`, `author_id`, `title`, `body_rich_text`, `image_url`, `image_meta`, `category_id`, `created_at`, `updated_at`.
- [ ] Add table `comments` with:
  - `id`, `post_id`, `space_id`, `author_id`, `body_rich_text`, `created_at`, `updated_at`.
- [ ] Add table `post_upvotes` with:
  - `id`, `post_id`, `space_id`, `user_id`, `created_at`.
  - unique `(post_id, user_id)`.
- [ ] Add taxonomy tables:
  - `categories` (`id`, `space_id`, `name`, `kind`, `created_at`)
  - `tags` (`id`, `space_id`, `name`, `created_at`)
  - `post_tags` (`id`, `post_id`, `tag_id`)
- [ ] Add space-scoped constraints/indexes:
  - all relevant foreign keys to `spaces`.
  - unique category name per space.
  - unique tag name per space.

Definition of done:

- Migration applies and rolls back cleanly on local DB.
- Unique upvote rule and space-scoped taxonomy constraints are enforced in DB.

### Task 2: TanStack DB collections and V2 types

- [ ] Extend `src/db-collections/index.ts` with V2 schemas/types:
  - `Post`, `Comment`, `PostUpvote`, `Category`, `Tag`, `PostTag`.
- [ ] Add collections:
  - `postsCollection`, `commentsCollection`, `postUpvotesCollection`, `categoriesCollection`, `tagsCollection`, `postTagsCollection`.
- [ ] Add helper upsert/remove functions for each V2 entity.
- [ ] Ensure collection keys are stable and string-based.
- [ ] Keep V1 collections untouched and compatible.

Definition of done:

- App typechecks with exported V2 collection types/functions.
- No existing V1 route breaks from db-collection changes.

### Task 3: V2 service and repository layer

- [ ] Add `src/lib/v2/types.ts` with normalized record types.
- [ ] Add `src/lib/v2/service.ts` for domain logic and error codes:
  - `createPost`
  - `updateOwnPost`
  - `createComment`
  - `toggleUpvote`
  - `listFeedBySpace`
  - `getPostThreadById`
- [ ] Add `src/lib/v2/repository.server.ts` with DB-backed operations mirroring service functions.
- [ ] Add authorization checks:
  - membership required for create/comment/upvote.
  - only author can update their post.
  - category/tag IDs must belong to same space.
- [ ] Add deterministic upvote conflict handling for concurrent toggle calls.

Definition of done:

- Service layer emits consistent error codes for API mapping.
- Repository enforces author and space-scope rules even with direct calls.

### Task 4: V2 HTTP API routes

- [ ] Add V2 client module: `src/lib/v2/api-client.ts`.
- [ ] Add API route files under `src/routes/api/v2/`:
  - `posts.ts` (`GET` feed, `POST` create)
  - `posts/$postId.ts` (`GET` detail, `PATCH` own edit)
  - `posts/$postId/comments.ts` (`POST` comment)
  - `posts/$postId/upvote.ts` (`POST` toggle)
  - optional `taxonomy.ts` (`GET` categories/tags for space)
- [ ] Reuse auth/session guard pattern from V1 (`requireSessionUser`).
- [ ] Return typed V2 payloads including derived counts where needed.
- [ ] Map V2 service errors to stable HTTP responses (`401`, `403`, `404`, `409`, `422`).

Definition of done:

- API endpoints support create/read/update/comment/upvote flows end-to-end.
- Error responses are predictable and user-actionable.

### Task 5: Electric shape routes and V2 sync wiring

- [ ] Add Electric shape proxies in `src/routes/api/electric/shapes/`:
  - `posts.ts`
  - `comments.ts`
  - `post-upvotes.ts`
  - `categories.ts`
  - `tags.ts`
  - `post-tags.ts`
- [ ] Filter shape reads by spaces visible to current user (membership-scoped).
- [ ] Add `src/lib/v2/sync.ts`:
  - pull shape snapshots (or fallback API snapshot).
  - upsert into V2 collections.
  - prune removed rows.
- [ ] Add `src/hooks/use-v2-sync.ts` with polling/refresh behavior aligned with V1.
- [ ] Wire V2 sync hook into V2 routes.

Definition of done:

- Two signed-in clients see V2 data updates without manual refresh.
- Shape fallback path works when Electric Cloud is not configured.

### Task 6: Feed and detail UI routes

- [ ] Update `src/routes/s/$spaceSlug.tsx`:
  - preserve join-by-slug behavior.
  - render post feed after membership is ready.
  - show category/tag chips and upvote counts.
- [ ] Add `src/routes/s/$spaceSlug/p/$postId.tsx`:
  - post content and metadata.
  - comments list.
  - upvote control.
  - author-only edit affordance.
- [ ] Add shared V2 UI components under `src/components/` (e.g. `posts/`).
- [ ] Handle loading, empty, not-found, and permission states explicitly.

Definition of done:

- Space page transitions from join state to live feed state.
- Post detail renders and responds to live updates.

### Task 7: Composer, own-post editing, and UploadThing integration

- [ ] Add route `src/routes/s/$spaceSlug/new.tsx` for post composer.
- [ ] Add rich-text editor field with normalized JSON payload shape.
- [ ] Add category selector and tag picker scoped to space taxonomy.
- [ ] Integrate UploadThing in create/edit flow:
  - upload first.
  - persist `imageUrl` + `imageMeta` in mutation payload.
- [ ] Add edit route or inline edit flow for authors only.
- [ ] Add optimistic create/update behavior with temporary IDs and reconciliation.

Definition of done:

- Post creation/edit works with and without image.
- Non-authors cannot access edit behavior via UI or direct API call.

### Task 8: Comments and upvotes optimistic interactions

- [ ] Implement optimistic `createComment` UX in detail route.
- [ ] Implement optimistic `toggleUpvote` UX in feed and detail route.
- [ ] Reconcile optimistic state with canonical replicated rows.
- [ ] Prevent duplicate local upvote artifacts during race conditions.
- [ ] Ensure list/detail counts stay consistent after sync reconciliation.

Definition of done:

- Comment appears instantly and remains after refresh.
- Upvote state updates immediately and converges across clients.

### Task 9: Test coverage and verification

- [ ] Add/extend service tests for V2 business logic in `src/lib/v2/service.test.ts`.
- [ ] Add auth persistence verification:
  - sign in with Google/GitHub in local/dev.
  - confirm user/session rows are persisted in configured Better Auth tables.
- [ ] Add route/component tests for:
  - feed rendering and empty state.
  - composer validation and submit.
  - author-only edit controls.
  - comment submission UX.
  - upvote toggle behavior.
- [ ] Add API tests for forbidden edit and invalid category/tag scope.
- [ ] Run quality gates:
  - `pnpm test`
  - `pnpm format-and-lint`
  - `pnpm build`
- [ ] Run browser verification with two users for create/comment/upvote/edit/image flows.

Definition of done:

- Automated checks pass.
- Manual browser run confirms cross-client sync and optimistic UX behavior.

## Final Acceptance Checklist

- [ ] Auth users/sessions persist in DB via Better Auth adapter (not cookie-only state).
- [ ] Member can create a post with rich text and optional image.
- [ ] Feed at `/s/:spaceSlug` shows posts with category/tag chips and upvote counts.
- [ ] Post detail at `/s/:spaceSlug/p/:postId` shows content, comments, and upvote control.
- [ ] Any member can comment and upvote in a joined space.
- [ ] Upvote is unique per user/post and stable under concurrent toggles.
- [ ] Only the post author can edit that post.
- [ ] Category/tag selection is validated against the same space.
- [ ] Data syncs live across two active clients via Electric + TanStack DB.
- [ ] Typecheck, lint, tests, and build all pass.
