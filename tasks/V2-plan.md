# V2 Plan: Core Posts, Comments, Upvotes, Categories/Tags, and Images

## Objective

Deliver the core community thread experience with local-first behavior: users create rich posts (with optional image), comment, upvote, and edit their own posts.

## Scope

- In scope: post creation and editing, comments, upvotes, category/tag taxonomy.
- In scope: UploadThing image uploads integrated into post creation/editing.
- In scope: optimistic local mutations with ElectricSQL replication.
- Out of scope: moderation actions and lifecycle/clarification features.

## PRD Coverage

- US-006, US-007, US-011, US-013.
- FR-6, FR-7, FR-8, FR-14, FR-16, FR-17, FR-19.

## Planned Work

1. Add post/thread data model and client collections.
2. Add category/tag management primitives per space.
3. Integrate rich-text editor and image upload in composer.
4. Implement comment and upvote interactions with optimistic updates.
5. Implement own-post edit flow with author guard.

## Data Model

- `posts`
  - `id`, `spaceId`, `authorId`, `title`, `bodyRichText`, `imageUrl`, `imageMeta`, `categoryId`, `status`, `createdAt`, `updatedAt`
- `comments`
  - `id`, `postId`, `spaceId`, `authorId`, `bodyRichText`, `createdAt`, `updatedAt`
- `post_upvotes`
  - `id`, `postId`, `spaceId`, `userId`, `createdAt`
  - Unique index: (`postId`, `userId`)
- `categories`
  - `id`, `spaceId`, `name`, `kind` (`bug` | `feature` | `question` | custom), `createdAt`
- `tags`
  - `id`, `spaceId`, `name`, `createdAt`
- `post_tags`
  - `id`, `postId`, `tagId`

## Routes and UI

- `/s/:spaceSlug`: post feed with category/tag chips and vote count.
- `/s/:spaceSlug/new`: post composer with rich text, category selector, tag picker, image upload.
- `/s/:spaceSlug/p/:postId`: post detail with comments and upvote action.

## Sync and Mutation Design

1. TanStack DB collections for posts/comments/upvotes/categories/tags/post_tags.
2. Electric Shapes filtered by `spaceId`.
3. Optimistic mutation flows:
   - `createPost` with temporary client ID and reconciliation.
   - `updateOwnPost` with author check.
   - `createComment`.
   - `toggleUpvote` with optimistic count delta.
4. UploadThing flow:
   - Upload image first.
   - Persist URL + metadata in post mutation payload.

## Authorization Rules

- Any member can create posts, comment, and upvote.
- Only post author can edit their post in V2.
- Category/tag validation must be space-scoped.

## Validation

1. New post appears locally immediately and on a second client without manual refresh.
2. Upvote toggle is reflected immediately on all connected clients.
3. Comment appears instantly in thread and persists after refresh.
4. UploadThing image is attached and rendered in post card and detail view.
5. Post edit is allowed for author and blocked for non-author.
6. Typecheck/lint passes.
7. Browser verification run for create/comment/upvote/edit/image flows.

## Risks and Mitigations

- Risk: rich-text payload incompatibility across optimistic and synced states.
- Mitigation: store normalized JSON schema and validate before mutation.
- Risk: duplicate upvotes under race conditions.
- Mitigation: DB uniqueness constraint + deterministic optimistic reconciliation.

## Exit Criteria

- End users can complete the full suggestion interaction loop in one space with live sync behavior.
