# V0 Plan: Landing Page

## Objective

Ship a production-ready public landing page at `/` that explains the product and routes users into sign-in, create-space flow, or join-space flow.

## Scope

- In scope: route UI, CTA behavior, auth-aware navigation.
- In scope: no SEO optimization work (matches PRD).
- Out of scope: core app functionality beyond routing handoff.

## PRD Coverage

- Requirements: FR-20 (SEO deprioritized), added shaping requirement R1.1.
- User impact: clear entry into onboarding and community flows.

## Planned Work

1. Create landing page component set.
2. Implement public `/` route with CTA actions.
3. Add auth-aware CTA logic (`create space` goes to auth first if needed).
4. Add join-by-link input that routes to `/s/:spaceSlug`.
5. Add basic UI tests for CTA navigation behavior.

## Implementation Detail

### Routes and Components

- Update [src/routes/index.tsx](/Users/robinsandborg/Projects/Personal/roadee-electric/src/routes/index.tsx) to render landing layout.
- Add landing-specific components under `src/components/landing/`:
  - `LandingHero.tsx`
  - `LandingActions.tsx`
  - `JoinSpaceForm.tsx`

### Client Logic

- Use existing auth client from [src/lib/auth-client.ts](/Users/robinsandborg/Projects/Personal/roadee-electric/src/lib/auth-client.ts).
- CTA behaviors:
  - `Sign in`: open Google/GitHub auth choices.
  - `Create space`: route to `/spaces/new` if authenticated; otherwise auth.
  - `Join space`: normalize slug input and route to `/s/:spaceSlug`.

### Styling

- Build a distinct branded page aligned with project style tokens.
- Ensure mobile and desktop layouts are both complete.

## Validation

1. Anonymous user on `/` can start sign-in and join-by-link path.
2. Authenticated user on `/` can navigate directly to create-space flow.
3. Invalid empty slug input shows inline validation.
4. Typecheck/lint passes.
5. Browser verification run for CTA flows.

## Risks and Mitigations

- Risk: CTA routing drift as auth routes evolve.
- Mitigation: centralize route constants and cover CTA flows with tests.

## Exit Criteria

- Landing page is default root route and all three CTA paths work end-to-end.
