export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-line px-4 pb-12 pt-8 text-sea-ink-soft">
      <div className="page-wrap flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-sm">&copy; {year} Roadee. Community-led product feedback.</p>
        <p className="island-kicker m-0">V0 Landing</p>
      </div>
    </footer>
  );
}
