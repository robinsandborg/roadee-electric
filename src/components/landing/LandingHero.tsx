export default function LandingHero() {
  return (
    <section className="landing-hero rise-in relative overflow-hidden rounded-[2rem] p-7 sm:p-10 lg:p-12">
      <div className="landing-hero-glow landing-hero-glow--left" />
      <div className="landing-hero-glow landing-hero-glow--right" />

      <p className="landing-kicker">Roadee Community Feedback</p>
      <h1 className="landing-title mt-3 max-w-3xl text-4xl leading-[0.98] font-black tracking-tight sm:text-5xl lg:text-6xl">
        Turn user ideas into a visible roadmap, together.
      </h1>
      <p className="landing-copy mt-5 max-w-2xl text-base leading-7 sm:text-lg">
        Create a product space where your team and community can discuss suggestions, upvote the
        most valuable ideas, and follow progress from first request to general availability.
      </p>

      <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ["Live discussion", "Posts, comments, and upvotes update instantly."],
          ["Clear ownership", "Staff identity and role context stay visible."],
          ["Traceable delivery", "Ideas move from suggestion to GA in public."],
        ].map(([title, body], index) => (
          <li
            key={title}
            className="landing-proof-card rise-in list-none rounded-2xl p-4"
            style={{ animationDelay: `${120 + index * 90}ms` }}
          >
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{title}</p>
            <p className="m-0 mt-1 text-sm text-[var(--landing-copy-muted)]">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
