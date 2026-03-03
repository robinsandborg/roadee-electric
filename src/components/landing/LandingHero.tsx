export default function LandingHero() {
  return (
    <section className="landing-hero rise-in relative overflow-hidden rounded-[2.1rem] px-7 py-8 sm:px-10 sm:py-11 lg:px-12 lg:py-12">
      <div className="landing-hero-glow landing-hero-glow--left" />
      <div className="landing-hero-glow landing-hero-glow--right" />
      <div className="landing-float-chip">Live sync + local-first UX</div>

      <p className="landing-kicker mt-8">Roadee Community Feedback</p>
      <h1 className="landing-title mt-3 max-w-3xl text-4xl leading-[0.97] font-black tracking-tight sm:text-5xl lg:text-6xl">
        Product feedback that
        <br />
        feels alive.
      </h1>
      <p className="landing-copy mt-5 max-w-2xl text-base leading-7 sm:text-lg">
        Give every idea one place to grow: users discuss, your team responds, and the journey from
        suggestion to launch stays visible to everyone.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-3">
        {[
          ["Fast signal", "See what users care about in real time."],
          ["Clear ownership", "Staff responses are visible and trustworthy."],
          ["Visible progress", "Turn roadmap updates into shared momentum."],
        ].map(([title, body], index) => (
          <article
            key={title}
            className="landing-proof-card rise-in rounded-2xl px-4 py-3"
            style={{ animationDelay: `${110 + index * 85}ms` }}
          >
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{title}</p>
            <p className="m-0 mt-1 text-sm text-[var(--landing-copy-muted)]">{body}</p>
          </article>
        ))}
      </div>

      <aside className="landing-artboard" aria-hidden="true">
        <article className="landing-mock-card landing-mock-card--main">
          <p className="landing-mock-title">Thread: Offline mode sync issues</p>
          <p className="landing-mock-meta">42 votes • 18 comments • feature</p>
          <div className="landing-mock-status-row">
            <span className="landing-status-chip">Suggestion</span>
            <span className="landing-status-dot" />
            <span className="landing-status-chip">Selected</span>
            <span className="landing-status-dot" />
            <span className="landing-status-chip is-active">Beta</span>
          </div>
        </article>

        <article className="landing-mock-card landing-mock-card--side">
          <p className="landing-mock-title">Staff note</p>
          <p className="landing-mock-quote">
            "We confirmed the issue and scoped a phased rollout."
          </p>
        </article>

        <article className="landing-mock-card landing-mock-card--tiny">
          <p className="landing-mock-metric">+126</p>
          <p className="landing-mock-meta">new users this week</p>
        </article>
      </aside>
    </section>
  );
}
