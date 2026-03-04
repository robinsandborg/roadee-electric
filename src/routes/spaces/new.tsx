import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { appRoutes } from "#/lib/routes";
import { authClient } from "#/lib/auth-client";
import { isValidSpaceSlug, normalizeSpaceSlug } from "#/lib/space-slug";
import { createSpaceRequest, SpacesApiError } from "#/lib/spaces/api-client";

export const Route = createFileRoute("/spaces/new")({
  ssr: false,
  component: CreateSpaceRoute,
});

type Provider = "google" | "github";

function CreateSpaceRoute() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (slugEdited) {
      return;
    }
    setSlug(normalizeSpaceSlug(name));
  }, [name, slugEdited]);

  const normalizedSlug = useMemo(() => normalizeSpaceSlug(slug), [slug]);

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Setup</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-sea-ink sm:text-5xl">
            Preparing your create flow...
          </h1>
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-2">Space Setup</p>
          <h1 className="display-title mb-3 text-4xl font-bold text-sea-ink sm:text-5xl">
            Sign in to create your space
          </h1>
          <p className="m-0 max-w-3xl text-base leading-8 text-sea-ink-soft">
            Use Google or GitHub and return to this page automatically.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pendingProvider !== null}
              onClick={() => {
                void signInWithProvider("google", setPendingProvider);
              }}
              className="rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {pendingProvider === "google" ? "Connecting..." : "Continue with Google"}
            </button>
            <button
              type="button"
              disabled={pendingProvider !== null}
              onClick={() => {
                void signInWithProvider("github", setPendingProvider);
              }}
              className="rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {pendingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
            </button>
          </div>

          <Link
            to={appRoutes.home}
            className="mt-6 inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline transition hover:-translate-y-0.5"
          >
            Back to landing page
          </Link>
        </section>
      </main>
    );
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSlugSuggestion(null);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName || !trimmedDescription) {
      setError("Name and description are required.");
      return;
    }

    if (!isValidSpaceSlug(normalizedSlug)) {
      setError("Slug must use lowercase letters, numbers, and single dashes.");
      return;
    }

    setIsSaving(true);
    try {
      await createSpaceRequest({
        id: crypto.randomUUID(),
        ownerMembershipId: crypto.randomUUID(),
        name: trimmedName,
        slug: normalizedSlug,
        description: trimmedDescription,
      });
      await navigate(appRoutes.spaceBySlug(normalizedSlug));
    } catch (unknownError) {
      if (unknownError instanceof SpacesApiError && unknownError.code === "slug_conflict") {
        const suggestion = `${normalizedSlug}-${Math.floor(Math.random() * 900 + 100)}`;
        setError("That slug is already taken.");
        setSlugSuggestion(suggestion);
        return;
      }

      setError("Could not create space. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Space Setup</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-sea-ink sm:text-5xl">
          Create your product space
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-sea-ink-soft">
          Name your community, choose a unique slug, and start inviting users.
        </p>

        <form className="mt-7 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-sea-ink">
            Space name
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="Roadee Mobile"
              className="h-11 rounded-xl border border-chip-line bg-white/80 px-4 text-sm text-sea-ink outline-none ring-0 focus:border-sea-ink-soft"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-sea-ink">
            Slug
            <input
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
              placeholder="roadee-mobile"
              className="h-11 rounded-xl border border-chip-line bg-white/80 px-4 text-sm text-sea-ink outline-none ring-0 focus:border-sea-ink-soft"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-sea-ink">
            Description
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              rows={4}
              placeholder="A shared place for requests, triage notes, and progress updates."
              className="rounded-xl border border-chip-line bg-white/80 px-4 py-3 text-sm text-sea-ink outline-none ring-0 focus:border-sea-ink-soft"
            />
          </label>

          {error ? (
            <p className="m-0 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
              {error}
            </p>
          ) : null}

          {slugSuggestion ? (
            <p className="m-0 text-sm text-sea-ink-soft">
              Try this available slug:{" "}
              <button
                type="button"
                onClick={() => {
                  setSlug(slugSuggestion);
                  setSlugEdited(true);
                  setSlugSuggestion(null);
                }}
                className="ml-1 rounded-md border border-chip-line bg-chip-bg px-2 py-1 text-xs font-semibold text-sea-ink"
              >
                {slugSuggestion}
              </button>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full border border-chip-line bg-sea-ink px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {isSaving ? "Creating..." : "Create space"}
            </button>

            <Link
              to={appRoutes.home}
              className="inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline transition hover:-translate-y-0.5"
            >
              Cancel
            </Link>
          </div>
        </form>

        <Link
          to={appRoutes.home}
          className="mt-6 inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-xs font-semibold text-sea-ink-soft no-underline transition hover:-translate-y-0.5"
        >
          Back to landing page
        </Link>
      </section>
    </main>
  );
}

async function signInWithProvider(
  provider: Provider,
  setPendingProvider: (provider: Provider | null) => void,
) {
  setPendingProvider(provider);
  try {
    await authClient.signIn.social({
      provider,
      callbackURL: appRoutes.createSpace,
    });
  } finally {
    setPendingProvider(null);
  }
}
