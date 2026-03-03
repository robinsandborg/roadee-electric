import { authClient } from "#/lib/auth-client";
import { useState } from "react";

type Provider = "google" | "github";

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return <div className="h-9 w-20 animate-pulse rounded-full bg-[var(--chip-bg)]" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)]">
            <span className="text-xs font-semibold text-[var(--sea-ink-soft)]">
              {session.user.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            void authClient.signOut();
          }}
          className="h-9 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen((prev) => !prev);
        }}
        className="h-9 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5"
      >
        Sign in
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.45rem)] z-20 w-56 rounded-2xl border border-[var(--chip-line)] bg-[var(--island-bg)] p-3 shadow-[var(--island-shadow)]">
          <p className="m-0 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            Sign in with
          </p>
          <div className="mt-2 grid gap-2">
            <button
              type="button"
              disabled={pendingProvider !== null}
              onClick={() => {
                void signInWithProvider({
                  provider: "google",
                  setPendingProvider,
                  setError,
                });
              }}
              className="rounded-full border border-[var(--chip-line)] bg-white/75 px-3 py-2 text-left text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {pendingProvider === "google" ? "Connecting..." : "Continue with Google"}
            </button>
            <button
              type="button"
              disabled={pendingProvider !== null}
              onClick={() => {
                void signInWithProvider({
                  provider: "github",
                  setPendingProvider,
                  setError,
                });
              }}
              className="rounded-full border border-[var(--chip-line)] bg-white/75 px-3 py-2 text-left text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {pendingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
            </button>
          </div>
          {error ? (
            <p className="m-0 mt-2 text-xs font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

async function signInWithProvider({
  provider,
  setPendingProvider,
  setError,
}: {
  provider: Provider;
  setPendingProvider: (provider: Provider | null) => void;
  setError: (value: string | null) => void;
}) {
  setPendingProvider(provider);
  setError(null);

  const callbackURL =
    typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;

  try {
    const result = await authClient.signIn.social({
      provider,
      callbackURL,
    });

    if (
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof (result as { error?: { message?: unknown } }).error?.message === "string"
    ) {
      setError((result as { error: { message: string } }).error.message);
    }
  } catch {
    setError("Unable to start sign-in.");
  } finally {
    setPendingProvider(null);
  }
}
