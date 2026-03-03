import LandingActions, { type SocialProvider } from "#/components/landing/LandingActions";
import LandingHero from "#/components/landing/LandingHero";
import JoinSpaceForm from "#/components/landing/JoinSpaceForm";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: App });

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

      <section className="landing-story-strip mt-5 rounded-[1.9rem] p-6 sm:p-7">
        <p className="landing-kicker">How It Feels</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["1. Start", "Create a space and share one link with your users."],
            ["2. Discuss", "Watch ideas, comments, and votes evolve together."],
            ["3. Ship", "Move ideas through statuses without losing context."],
          ].map(([title, copy]) => (
            <article key={title} className="landing-proof-card rounded-2xl p-4">
              <h3 className="m-0 text-base font-semibold text-[var(--sea-ink)]">{title}</h3>
              <p className="m-0 mt-1 text-sm text-[var(--landing-copy-muted)]">{copy}</p>
            </article>
          ))}
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
