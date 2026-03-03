import { useState } from "react";

export type SocialProvider = "google" | "github";
export type SignInIntent = "sign-in" | "create-space";

type LandingActionsProps = {
  isAuthenticated: boolean;
  isSessionPending: boolean;
  pendingProvider: SocialProvider | null;
  authError: string | null;
  onCreateSpace: () => void;
  onSignIn: (provider: SocialProvider, intent: SignInIntent) => Promise<void> | void;
};

export default function LandingActions({
  isAuthenticated,
  isSessionPending,
  pendingProvider,
  authError,
  onCreateSpace,
  onSignIn,
}: LandingActionsProps) {
  const [intent, setIntent] = useState<SignInIntent | null>(null);

  const showProviders = intent !== null;
  const isBusy = isSessionPending || pendingProvider !== null;

  return (
    <section className="landing-panel rounded-[1.9rem] p-6 sm:p-7">
      <p className="landing-kicker">Start Here</p>
      <h2 className="mt-2 text-2xl font-black text-[var(--sea-ink)] sm:text-[2rem]">
        Launch your community space.
      </h2>
      <p className="m-0 mt-2 text-sm text-[var(--landing-copy-muted)]">
        Create a public room for requests, conversations, and roadmap updates.
      </p>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          className="landing-cta-primary"
          onClick={() => {
            if (isAuthenticated) {
              onCreateSpace();
              return;
            }
            setIntent("create-space");
          }}
          disabled={isBusy}
        >
          Create a space
        </button>

        <button
          type="button"
          className="landing-cta-secondary"
          onClick={() => setIntent("sign-in")}
          disabled={isBusy}
        >
          Sign in
        </button>
      </div>

      {showProviders && !isAuthenticated ? (
        <div className="landing-auth-card mt-5 rounded-2xl p-4">
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {intent === "create-space"
              ? "Sign in to continue to space creation"
              : "Choose a provider to sign in"}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="landing-provider-btn"
              onClick={() => void onSignIn("google", intent)}
              disabled={isBusy}
            >
              {pendingProvider === "google" ? "Connecting..." : "Continue with Google"}
            </button>
            <button
              type="button"
              className="landing-provider-btn"
              onClick={() => void onSignIn("github", intent)}
              disabled={isBusy}
            >
              {pendingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 text-sm text-[var(--landing-copy-muted)]">
        <p className="m-0">No setup wizard. Just name your space and invite your users.</p>
        <p className="m-0">Works great for product teams, open betas, and private pilots.</p>
      </div>

      {authError ? (
        <p role="alert" className="landing-inline-error mt-4 mb-0 text-sm">
          {authError}
        </p>
      ) : null}
    </section>
  );
}
