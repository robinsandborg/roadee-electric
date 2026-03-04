import { Link } from "@tanstack/react-router";
import { appRoutes } from "#/lib/routes";
import BetterAuthHeader from "../integrations/better-auth/header-user.tsx";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-header-bg px-4 backdrop-blur-lg">
      <nav className="page-wrap flex items-center gap-3 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to={appRoutes.home}
            className="inline-flex items-center gap-2 rounded-full border border-chip-line bg-chip-bg px-3 py-1.5 text-sm text-sea-ink no-underline shadow-[0_10px_26px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(120deg,#ff8c26,#f6b77c)]" />
            Roadee
          </Link>
        </h2>

        <div className="hidden items-center gap-4 text-sm font-semibold text-sea-ink-soft sm:flex">
          <Link
            to={appRoutes.home}
            className="nav-link"
            activeProps={{ className: "nav-link is-active" }}
          >
            Home
          </Link>
          <Link
            to={appRoutes.about}
            className="nav-link"
            activeProps={{ className: "nav-link is-active" }}
          >
            About
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <BetterAuthHeader />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
