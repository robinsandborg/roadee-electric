import { Link, createFileRoute } from "@tanstack/react-router";
import { appRoutes } from "#/lib/routes";

export const Route = createFileRoute("/spaces/new")({
  component: CreateSpacePlaceholder,
});

function CreateSpacePlaceholder() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">V0 Placeholder</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Create space flow lands here.
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          The full space creation experience ships in V1. This route exists now so the landing page
          CTA has a valid destination.
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
