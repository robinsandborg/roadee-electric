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
    <main className="page-wrap px-4 pb-10 pt-14">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <LandingHero />
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

            const callbackURL = intent === "create-space" ? appRoutes.createSpace : appRoutes.home;

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
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <JoinSpaceForm
          onSubmit={(spaceSlug) => {
            void navigate(appRoutes.spaceBySlug(spaceSlug));
          }}
        />

        <section className="landing-panel rounded-[1.75rem] p-6 sm:p-7">
          <p className="landing-kicker">What You Get</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--sea-ink)]">
            A shared place for users and product teams.
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Ideas that stay visible", "Track discussion quality over time."],
              ["Built-in trust signals", "Show staff identity on every response."],
              ["Space-specific context", "Keep categories and tags product-focused."],
              ["Delivery transparency", "Show lifecycle movement in plain language."],
            ].map(([title, description]) => (
              <article key={title} className="landing-proof-card rounded-2xl p-4">
                <h3 className="m-0 text-base font-semibold text-[var(--sea-ink)]">{title}</h3>
                <p className="m-0 mt-1 text-sm text-[var(--landing-copy-muted)]">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
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
