---
shaping: true
---

# Product Feedback Community Platform - Shaping

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Provide a community-led space where product users can interact with each other to give feedback and support feature requests. | Core goal |
| R1 | Allow a product company to sign up and create a dedicated product space. | Must-have |
| 🟡R1.1 | 🟡Provide a public landing page that explains the product and routes visitors to sign in, create a space, or join a space by link. | 🟡Must-have |
| R2 | Allow company staff to invite/add colleagues into their product space with staff permissions. | Must-have |
| R3 | Allow end users to sign up/sign in with social authentication. | Must-have |
| R4 | Users can create posts, comment on posts, upvote others' posts, and edit their own posts. | Must-have |
| R5 | Staff can moderate community content by deleting posts and deleting comments. | Must-have |
| R6 | When staff select a suggestion for work, they can add a formal staff clarification above the thread while preserving the original user request unchanged. | Must-have |
| R7 | Each post supports lifecycle states: suggestion -> selected for development -> beta availability -> GA. | Must-have |
| R8 | Posts support rich text and an image, and every post includes one category (for generic type) plus tags (for product-area specifics). | Must-have |

---

## A: Unified Thread with Staff Clarification Overlay

| Part | Mechanism | Flag |
|------|-----------|:----:|
| A1 | Tenant model: `spaces` owned by product companies, with scoped membership and routing by `spaceSlug`. | |
| A2 | Access model: role-based memberships (`owner`, `staff`, `user`) with invitation flow for colleagues into the same space. | |
| A3 | Auth model: social login providers for end users, with profile bootstrap on first sign-in. | |
| A4 | Identity presentation: public profile card on each thread interaction; staff badge with title shown beside name. | |
| A5 | Post model: single `posts` entity with rich-text body, optional image attachment, category, tags, and status field. | |
| A6 | Interaction model: threaded comments, post upvotes, author-only post edits with audit timestamps. | |
| A7 | Moderation model: staff-only delete actions for posts/comments with soft-delete and moderator attribution. | |
| A8 | Clarification overlay: staff-authored "Product Understanding" document linked above the original post and versioned independently. | |
| A9 | Status workflow: controlled transition rules `suggestion -> selected -> beta -> ga`, with timeline events visible in thread. | |
| 🟡A10 | 🟡Public landing route (`/`) with value proposition, sign-in CTA, create-space CTA, and join-by-link guidance. | |

---

## B: Split Idea Thread + Internal Spec Record

| Part | Mechanism | Flag |
|------|-----------|:----:|
| B1 | Tenant model: same space/membership model as A. | |
| B2 | Auth and identity model: same social login and profile system as A. | |
| B3 | Public idea threads store user proposal, comments, upvotes, and category/tags. | |
| B4 | Staff can move an idea into a separate "Roadmap Item" record that becomes the source of truth for delivery status. | |
| B5 | Public thread status mirrors roadmap status by async synchronization job. | |
| B6 | Staff clarification is stored only on the roadmap item, while thread shows a short linked summary. | |
| B7 | Moderation permissions as in A. | |
| B8 | Rich text and image support only on the idea thread; roadmap item uses plain text fields. | |
| 🟡B9 | 🟡Public landing route (`/`) with value proposition and auth/join CTAs. | |

---

## Fit Check

| Req | Requirement | Status | A | B |
|-----|-------------|--------|---|---|
| R0 | Provide a community-led space where product users can interact with each other to give feedback and support feature requests. | Core goal | ✅ | ✅ |
| R1 | Allow a product company to sign up and create a dedicated product space. | Must-have | ✅ | ✅ |
| 🟡R1.1 | 🟡Provide a public landing page that explains the product and routes visitors to sign in, create a space, or join a space by link. | 🟡Must-have | 🟡✅ | 🟡✅ |
| R2 | Allow company staff to invite/add colleagues into their product space with staff permissions. | Must-have | ✅ | ✅ |
| R3 | Allow end users to sign up/sign in with social authentication. | Must-have | ✅ | ✅ |
| R4 | Users can create posts, comment on posts, upvote others' posts, and edit their own posts. | Must-have | ✅ | ✅ |
| R5 | Staff can moderate community content by deleting posts and deleting comments. | Must-have | ✅ | ✅ |
| R6 | When staff select a suggestion for work, they can add a formal staff clarification above the thread while preserving the original user request unchanged. | Must-have | ✅ | ❌ |
| R7 | Each post supports lifecycle states: suggestion -> selected for development -> beta availability -> GA. | Must-have | ✅ | ✅ |
| R8 | Posts support rich text and an image, and every post includes one category (for generic type) plus tags (for product-area specifics). | Must-have | ✅ | ❌ |

**Notes:**
- B fails R6: clarification lives in a separate roadmap record, so the thread-level "document above the thread" is only an indirect summary.
- B fails R8: roadmap items do not preserve full rich text/image parity once promoted, which breaks consistent post capabilities.

---

## Selected Shape

Shape A is selected as the working direction because it satisfies all current requirements while preserving community context in a single thread.
