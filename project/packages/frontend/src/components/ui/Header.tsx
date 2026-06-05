import { NavLink, Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.svg";
import { useAuthStore } from "../../store/authStore";
import { Button } from "./button";
import { useState, useEffect } from "react";

function NavItem({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }: { isActive: boolean }) =>
        [
          "relative px-1 py-0.5 text-sm font-medium transition-colors duration-150",
          "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:transition-all after:duration-200",
          isActive
            ? "text-primary after:bg-primary after:opacity-100"
            : "text-muted-foreground hover:text-foreground after:bg-primary after:opacity-0 hover:after:opacity-40"
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

export default function Header(): React.JSX.Element {
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-card/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">

        {/* Brand */}
        <Link to="/lobby" className="group flex items-center gap-3 select-none">
          <img
            src={logo}
            alt="BoardGames"
            className="h-9 w-9 rounded-xl transition-transform duration-200 group-hover:scale-105"
          />
          <div className="hidden xs:block">
            <span className="block font-display text-base font-semibold leading-tight tracking-wide text-foreground">
              Board<span className="text-primary">Games</span>
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground leading-none">
              Arena
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex md:items-center md:gap-6">
          <NavItem to="/lobby">Лобби</NavItem>
          {user ? (
            <>
              <NavItem to="/profile">Профиль</NavItem>
              {user.role === "admin" && <NavItem to="/admin">Админ</NavItem>}
            </>
          ) : null}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex md:items-center md:gap-2">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-1.5">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{user.username[0]?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-foreground">{user.username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                Выйти
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Войти</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Регистрация</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-colors hover:bg-border md:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="animate-fade border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6">
            <MobileNavItem to="/lobby" onClick={() => setOpen(false)}>🎮 Лобби</MobileNavItem>
            {user ? (
              <>
                <MobileNavItem to="/profile" onClick={() => setOpen(false)}>👤 Профиль</MobileNavItem>
                {user.role === "admin" && (
                  <MobileNavItem to="/admin" onClick={() => setOpen(false)}>⚙️ Админ</MobileNavItem>
                )}
                <div className="pt-2 border-t border-border mt-2">
                  <div className="mb-2 px-3 text-xs text-muted-foreground">
                    Вы вошли как <span className="text-foreground font-medium">{user.username}</span>
                  </div>
                  <button
                    onClick={() => { setOpen(false); void logout(); }}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-border/50 hover:text-foreground transition-colors"
                  >
                    Выйти
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
                <MobileNavItem to="/login" onClick={() => setOpen(false)}>🔑 Войти</MobileNavItem>
                <MobileNavItem to="/register" onClick={() => setOpen(false)}>✨ Регистрация</MobileNavItem>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MobileNavItem({
  to,
  onClick,
  children
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }: { isActive: boolean }) =>
        [
          "flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-border/50 hover:text-foreground"
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
