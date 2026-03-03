import { Link, createFileRoute } from "@tanstack/react-router";
import { appRoutes } from "#/lib/routes";

export const Route = createFileRoute("/s/$spaceSlug")({
  component: SpacePlaceholder,
});

function SpacePlaceholder() {
  const { spaceSlug } = Route.useParams();

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">V0 Placeholder</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Space: {spaceSlug}
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          The full joined-space experience ships in V1. This placeholder keeps join-by-link
          navigation working in V0.
        </p>

        <Link
          to={appRoutes.home}
          className="mt-6 inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
        >
          Back to landing page
        </Link>
      </section>
    </main>
  );
}
