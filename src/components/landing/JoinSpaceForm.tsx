import { useState } from "react";
import { isValidSpaceSlug, normalizeSpaceSlug } from "./landing.utils";

type JoinSpaceFormProps = {
  onSubmit: (normalizedSlug: string) => void;
};

const QUICK_SLUGS = ["acme-product", "open-beta", "mobile-app"];

export default function JoinSpaceForm({ onSubmit }: JoinSpaceFormProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="landing-panel rounded-[1.9rem] p-6 sm:p-7">
      <p className="landing-kicker">Join Existing Space</p>
      <h2 className="mt-2 text-2xl font-black text-[var(--sea-ink)]">
        Already have an invite link?
      </h2>
      <p className="mt-2 mb-0 text-sm text-[var(--landing-copy-muted)]">
        Paste a full link or enter a slug like <code>acme-product</code>.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            className="landing-chip-btn"
            onClick={() => {
              setValue(slug);
              if (error) {
                setError(null);
              }
            }}
          >
            {slug}
          </button>
        ))}
      </div>

      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();

          const normalized = normalizeSpaceSlug(value);

          if (!normalized) {
            setError("Enter a space slug or invite link.");
            return;
          }

          if (!isValidSpaceSlug(normalized)) {
            setError("Use lowercase letters, numbers, and hyphens only.");
            return;
          }

          setError(null);
          onSubmit(normalized);
        }}
      >
        <label className="landing-label" htmlFor="space-slug">
          Space link or slug
        </label>
        <input
          id="space-slug"
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          placeholder="/s/acme-product"
          className="landing-input"
          autoComplete="off"
        />

        <button type="submit" className="landing-cta-secondary w-full">
          Join space
        </button>
      </form>

      {error ? (
        <p role="alert" className="landing-inline-error mt-3 mb-0 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
