# V1 Implementation Task List: Auth, Spaces, and Membership

## Goal

Ship V1 flows so authenticated users can create spaces, join by slug link, and promote colleagues to `staff` with trusted authorization.

## Scope and PRD Mapping

- User stories: US-001, US-002, US-003, US-004.
- Requirements: FR-1, FR-2, FR-3, FR-4, FR-5, FR-15, FR-16, FR-17, FR-18.
- Out of scope: posts/comments/upvotes.

## Execution Order

1. Task 0 (prerequisites)
2. Task 1 (schema)
3. Task 2 (TanStack DB models)
4. Task 3 (ElectricSQL shape wiring)
5. Task 4 (create space flow)
6. Task 5 (join by slug flow)
7. Task 6 (staff promotion flow)
8. Task 7 (tests and verification)

## Concrete Tasks

### Task 0: Environment and auth baseline

- [ ] Confirm social provider env vars exist in `.env.local` for Google and GitHub.
- [ ] Verify `src/lib/auth.ts` still exposes Google + GitHub providers only for V1 sign-in path.
- [ ] Add missing V1 env var docs in `README.md` (Postgres + Electric endpoint + OAuth keys).
- [ ] Record local setup command sequence in this file (or `README.md`) so V1 is reproducible.

Definition of done:

- Sign-in chooser still works from landing page.
- Team can boot app with a documented env var set.

### Task 1: Postgres schema for spaces and memberships

- [ ] Create SQL migration file at `db/migrations/001_v1_spaces_memberships.sql`.
- [ ] Add `spaces` table with fields:
  - `id`, `slug` (unique), `name`, `description`, `created_by`, `created_at`, `updated_at`.
- [ ] Add `memberships` table with fields:
  - `id`, `space_id`, `user_id`, `role`, `title`, `created_at`, `updated_at`.
- [ ] Add constraints and indexes:
  - unique `spaces.slug`.
  - unique `(memberships.space_id, memberships.user_id)`.
  - foreign key `memberships.space_id -> spaces.id`.
  - check constraint on `memberships.role in ('owner','staff','user')`.
- [ ] Add rollback SQL in the same migration set (or paired down migration).

Definition of done:

- Migration applies cleanly on empty DB.
- Re-running migration is idempotent via migration tooling.

### Task 2: TanStack DB collections for synced entities

- [ ] Replace demo-only collection usage in `src/db-collections/index.ts` with V1 entities.
- [ ] Define `Space` and `Membership` schemas with `zod` and exported TS types.
- [ ] Add `spacesCollection` and `membershipsCollection` with deterministic keys.
- [ ] Keep collection naming aligned with planned V2/V3/V4 entities for incremental expansion.

Definition of done:

- App compiles with typed `spacesCollection` and `membershipsCollection` exports.
- No V1 routes depend on demo message collection types.

### Task 3: ElectricSQL shape subscriptions and replication wiring

- [ ] Add ElectricSQL client bootstrap module (for example `src/lib/electric/client.ts`).
- [ ] Add shape definitions for:
  - spaces where current user has membership.
  - memberships for spaces visible to current user.
- [ ] Wire shape lifecycle to auth session changes (subscribe on sign-in, cleanup on sign-out).
- [ ] Ensure replicated rows hydrate TanStack DB collections.
- [ ] Document server-side trust boundary: only promotion stays behind trusted mutation path.

Definition of done:

- Two authenticated clients for the same space receive space/membership changes without refresh.

### Task 4: `/spaces/new` create-space flow

- [ ] Replace placeholder component in `src/routes/spaces/new.tsx` with real form UI.
- [ ] Add form fields: `name`, `slug`, `description`; include client validation.
- [ ] Add `createSpace` mutation:
  - optimistic insert to local collections.
  - creates owner membership for creator in same transaction/mutation flow.
  - handles slug uniqueness conflict and returns user-facing recovery message.
- [ ] Redirect to `/s/:spaceSlug` on success.
- [ ] Ensure unauthenticated users are redirected to sign-in flow.

Definition of done:

- Creating a space inserts both `spaces` and owner `memberships` records.
- New space becomes visible on second signed-in client via replication.

### Task 5: `/s/:spaceSlug` join-by-link flow

- [ ] Replace placeholder in `src/routes/s/$spaceSlug.tsx` with join gate + space shell.
- [ ] Resolve space by slug and show not-found state for invalid slug.
- [ ] For authenticated users, run `joinSpaceBySlug` on first visit:
  - create membership with role `user`.
  - upsert semantics to keep operation idempotent.
- [ ] For unauthenticated users, send to sign-in then return to same slug route.
- [ ] Surface membership status in UI (joined vs already member).

Definition of done:

- Visiting same space route repeatedly does not create duplicate memberships.
- First join immediately appears in member list and replicated clients.

### Task 6: Staff promotion flow at `/s/:spaceSlug/settings/members`

- [ ] Add route `src/routes/s/$spaceSlug/settings/members.tsx`.
- [ ] Build member list UI with role badges and promote action controls.
- [ ] Add trusted mutation endpoint/function `promoteMemberToStaff`.
- [ ] Enforce authorization server-side:
  - only `owner` or `staff` in the target space can promote.
  - reject self-escalation attempts by non-staff callers.
- [ ] Hide/disable promotion controls for non-staff users in UI.

Definition of done:

- Staff and owner can promote colleagues.
- Non-staff direct calls return authorization error and no role change.

### Task 7: Test coverage and verification

- [ ] Add unit tests for slug conflict handling and membership idempotency.
- [ ] Add route-level/component tests for:
  - create space auth gating.
  - join-by-slug auto-membership behavior.
  - members settings authorization UI states.
- [ ] Add trusted mutation tests for `promoteMemberToStaff` role checks.
- [ ] Run quality gates:
  - `pnpm test`
  - `pnpm format-and-lint`
  - `pnpm build`
- [ ] Run browser verification for create/join/promote flows with two users.

Definition of done:

- All checks pass.
- Manual browser verification confirms end-to-end behavior.

## Final Acceptance Checklist

- [ ] Any authenticated user can create a space.
- [ ] Any authenticated user can join by valid slug link as `user`.
- [ ] Join operation is idempotent (no duplicate membership rows).
- [ ] Roles are enforced per space: `owner`, `staff`, `user`.
- [ ] Only `owner`/`staff` can promote colleagues to `staff`.
- [ ] Google and GitHub sign-in both work.
- [ ] Data syncs across two active clients via ElectricSQL + TanStack DB.
- [ ] Typecheck, lint, tests, and build all pass.
