export default function Footer(): React.JSX.Element {
  return (
    <footer className="mt-auto border-t border-border/50 bg-card/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-display tracking-wide text-foreground/60">BoardGames</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Шахматы · Шашки · Дурак · Alias · Мафия</span>
        </div>
      </div>
    </footer>
  );
}
