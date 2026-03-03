import LandingActions, { type SocialProvider } from "#/components/landing/LandingActions";
import LandingHero from "#/components/landing/LandingHero";
import JoinSpaceForm from "#/components/landing/JoinSpaceForm";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: App });

const TEAM_LOGOS = ["Luma", "Monarch", "Northstar", "Duality", "Rivet", "Pixel Foundry"];

const BUILDER_MOMENTS = [
  {
    title: "Suggestion Inbox",
    copy: "Collect requests in one stream and triage with shared context.",
  },
  {
    title: "Public Clarification",
    copy: "Publish staff understanding above the original request thread.",
  },
  {
    title: "Lifecycle Updates",
    copy: "Move from suggestion to beta and GA in public, with trust.",
  },
];

const COMMUNITY_SPOTLIGHT = [
  "Offline-ready composer",
  "Moderation guardrails",
  "Tag-driven discovery",
  "Roadmap status timeline",
  "Staff response cues",
  "Live vote momentum",
];

function App() {
  const navigate = useNavigate();
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAuthenticated = Boolean(session?.user);

  return (
    <main className="page-wrap px-4 pb-12 pt-12">
      <div className="landing-main-grid">
        <LandingHero />

        <div className="grid gap-5">
          <LandingActions
            isAuthenticated={isAuthenticated}
            isSessionPending={isSessionPending}
            pendingProvider={pendingProvider}
            authError={authError}
            onCreateSpace={() => {
              void navigate({ to: appRoutes.createSpace });
            }}
            onSignIn={async (provider, intent) => {
              setPendingProvider(provider);
              setAuthError(null);

              const callbackURL =
                intent === "create-space" ? appRoutes.createSpace : appRoutes.home;

              try {
                const result = await authClient.signIn.social({
                  provider,
                  callbackURL,
                });

                if (hasErrorMessage(result)) {
                  setAuthError(result.error.message);
                }
              } catch {
                setAuthError("Could not start sign-in. Please try again.");
              } finally {
                setPendingProvider(null);
              }
            }}
          />

          <JoinSpaceForm
            onSubmit={(spaceSlug) => {
              void navigate(appRoutes.spaceBySlug(spaceSlug));
            }}
          />
        </div>
      </div>

      <section className="landing-trust-strip mt-6 rounded-[1.9rem] px-5 py-4 sm:px-7">
        <p className="landing-kicker m-0">Used by product teams building in public</p>
        <div className="landing-logo-list mt-3">
          {TEAM_LOGOS.map((logo) => (
            <span key={logo} className="landing-logo-pill">
              {logo}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-showcase-band mt-6 rounded-[1.95rem] p-6 sm:p-8">
        <div className="landing-section-head">
          <p className="landing-kicker m-0">From First Signal To Shipping</p>
          <h2 className="m-0 text-3xl leading-tight font-black text-[var(--sea-ink)] sm:text-4xl">
            One workflow, visible to everyone.
          </h2>
        </div>

        <div className="landing-showcase-grid mt-6">
          {BUILDER_MOMENTS.map((item, index) => (
            <article
              key={item.title}
              className="landing-feature-tile rounded-2xl p-4"
              style={{ animationDelay: `${index * 80 + 70}ms` }}
            >
              <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{item.title}</p>
              <p className="m-0 mt-1 text-sm text-[var(--landing-copy-muted)]">{item.copy}</p>
            </article>
          ))}
          <article className="landing-feature-tile landing-feature-tile--accent rounded-2xl p-4">
            <p className="m-0 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
              Live snapshot
            </p>
            <p className="m-0 mt-2 text-3xl leading-none font-black text-[var(--sea-ink)]">2.4s</p>
            <p className="m-0 mt-1 text-sm text-[var(--landing-copy-muted)]">
              avg sync latency across active spaces
            </p>
          </article>
        </div>
      </section>

      <section className="landing-gallery mt-6 rounded-[1.95rem] p-6 sm:p-8">
        <div className="landing-section-head">
          <p className="landing-kicker m-0">Community Moments</p>
          <h2 className="m-0 text-3xl leading-tight font-black text-[var(--sea-ink)] sm:text-4xl">
            Explore what teams are building.
          </h2>
        </div>

        <div className="landing-gallery-grid mt-6">
          {COMMUNITY_SPOTLIGHT.map((title, index) => (
            <article key={title} className="landing-gallery-card rounded-2xl p-4">
              <div className="landing-gallery-thumb" aria-hidden="true" />
              <p className="m-0 mt-3 text-sm font-semibold text-[var(--sea-ink)]">{title}</p>
              <p className="m-0 mt-1 text-xs text-[var(--landing-copy-muted)]">
                Showcase #{String(index + 1).padStart(2, "0")}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <button type="button" className="landing-cta-primary landing-cta-primary--final">
            Start your space for free
          </button>
        </div>
      </section>
    </main>
  );
}

function hasErrorMessage(value: unknown): value is { error: { message: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: { message?: unknown } }).error?.message === "string"
  );
}
