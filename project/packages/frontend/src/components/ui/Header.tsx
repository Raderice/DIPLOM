import { NavLink, Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.svg";
import { useAuthStore } from "../../store/authStore";
import { Button } from "./button";
import { useState } from "react";
import { useEffect } from "react";

export default function Header(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Close mobile menu on navigation
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-[#0b0b0c]/80 via-transparent to-transparent backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/lobby" className="flex items-center gap-3">
            <img src={logo} alt="logo" className="h-10 w-10 rounded-full bg-[#111] p-1 transform transition-transform duration-300 hover:scale-105" />
            <span className="font-semibold tracking-wide">BoardGames</span>
          </Link>
        </div>

        <div className="hidden md:flex md:items-center md:gap-3">
          <nav className="flex items-center gap-3">
            <NavLink to="/lobby" className={({ isActive }) => `text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`} >Лобби</NavLink>
            {user ? (
              <>
                <NavLink to="/profile" className={({ isActive }) => `text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>Профиль</NavLink>
                <Button variant="outline" onClick={() => void logout()}>Выйти</Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={({ isActive }) => `text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>Войти</NavLink>
                <NavLink to="/register" className={({ isActive }) => `text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}>Регистрация</NavLink>
              </>
            )}
          </nav>
        </div>

        <div className="md:hidden">
          <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-md p-2 hover:bg-[#111]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="md:hidden border-t border-border bg-[#070708]/90">
          <div className="mx-auto max-w-6xl px-4 py-4">
              <nav className="flex flex-col gap-3">
                <NavLink to="/lobby" onClick={() => setOpen(false)} className={({ isActive }) => `text-sm ${isActive ? 'font-semibold' : ''}`}>Лобби</NavLink>
                {user ? (
                  <>
                    <NavLink to="/profile" onClick={() => setOpen(false)} className={({ isActive }) => `text-sm ${isActive ? 'font-semibold' : ''}`}>Профиль</NavLink>
                    <button onClick={() => { setOpen(false); void logout(); }} className="text-sm">Выйти</button>
                  </>
                ) : (
                  <>
                    <NavLink to="/login" onClick={() => setOpen(false)} className={({ isActive }) => `text-sm ${isActive ? 'font-semibold' : ''}`}>Войти</NavLink>
                    <NavLink to="/register" onClick={() => setOpen(false)} className={({ isActive }) => `text-sm ${isActive ? 'font-semibold' : ''}`}>Регистрация</NavLink>
                  </>
                )}
              </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
