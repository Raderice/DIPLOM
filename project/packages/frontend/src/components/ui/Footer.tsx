export default function Footer(): React.JSX.Element {
  return (
    <footer className="mt-8 border-t border-border bg-gradient-to-t from-transparent to-[#0b0b0c]/30">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <div>© {new Date().getFullYear()} BoardGames — учебный проект</div>
          <div className="text-xs">Made with ♥ — Open-source</div>
        </div>
      </div>
    </footer>
  );
}
