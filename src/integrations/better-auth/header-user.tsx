import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";

type Provider = "google" | "github";

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession();
  const signInMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDismissiblePopover({
    isOpen: isSignInOpen,
    containerRef: signInMenuRef,
    onDismiss: () => {
      setIsSignInOpen(false);
    },
  });

  useDismissiblePopover({
    isOpen: isAccountMenuOpen,
    containerRef: accountMenuRef,
    onDismiss: () => {
      setIsAccountMenuOpen(false);
    },
  });

  if (isPending) {
    return <div className="h-9 w-20 animate-pulse rounded-full bg-[var(--chip-bg)]" />;
  }

  if (session?.user) {
    const displayName = session.user.name?.trim() || "User";

    return (
      <div ref={accountMenuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isAccountMenuOpen}
          aria-label="Open account menu"
          onClick={() => {
            setIsAccountMenuOpen((prev) => !prev);
          }}
          className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] transition hover:-translate-y-0.5 ${isAccountMenuOpen ? "ring-2 ring-[color:color-mix(in_srgb,var(--sea-ink)_22%,transparent)] ring-offset-2 ring-offset-[var(--bg-base)]" : ""}`}
        >
          {session.user.image ? (
            <img src={session.user.image} alt={`${displayName} avatar`} className="h-full w-full" />
          ) : (
            <span className="text-xs font-semibold text-[var(--sea-ink-soft)]">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </button>

        {isAccountMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+0.45rem)] z-20 w-56 rounded-2xl border border-[var(--chip-line)] bg-[var(--island-bg)] p-3 shadow-[var(--island-shadow)]"
          >
            <div className="mb-2 border-b border-[var(--chip-line)] pb-2">
              <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{displayName}</p>
              {session.user.email ? (
                <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">{session.user.email}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Link
                role="menuitem"
                to={appRoutes.mySpaces}
                onClick={() => {
                  setIsAccountMenuOpen(false);
                }}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-left text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
              >
                My spaces
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  void authClient.signOut();
                }}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-left text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={signInMenuRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsSignInOpen((prev) => !prev);
        }}
        className="h-9 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5"
      >
        Sign in
      </button>

      {isSignInOpen ? (
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

function useDismissiblePopover({
  isOpen,
  containerRef,
  onDismiss,
}: {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (containerRef.current?.contains(target)) {
        return;
      }
      onDismiss();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, containerRef, onDismiss]);
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
