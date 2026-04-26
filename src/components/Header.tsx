import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BarChart3, Globe2, LayoutDashboard, Menu, Scale, X } from 'lucide-react';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-sm shadow-cyan-900/20 dark:from-cyan-300 dark:to-amber-200 dark:text-slate-950'
        : 'text-slate-600 hover:bg-cyan-50 hover:text-cyan-800 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-cyan-200'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 shadow-sm shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/82 dark:shadow-black/20">
      <div className="accent-strip" />
      <div className="container mx-auto px-6">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={() => setIsMenuOpen(false)}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 via-teal-400 to-amber-300 text-slate-950 shadow-sm shadow-cyan-900/20 dark:from-cyan-300 dark:via-fuchsia-300 dark:to-amber-200">
              <BarChart3 size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="bg-gradient-to-r from-cyan-700 via-teal-600 to-amber-600 bg-clip-text text-xl font-black tracking-tight text-transparent dark:from-cyan-300 dark:via-fuchsia-300 dark:to-amber-200">
                MindThe_Gap
              </h1>
              <p className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
                AI-driven inequality monitoring and forecasting
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-lg border border-slate-200/70 bg-white/65 p-1 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/55 dark:shadow-black/20 md:flex">
            <NavLink to="/" className={navLinkClass} end>
              <Globe2 size={16} />
              National Atlas
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
            <NavLink to="/compare" className={navLinkClass}>
              <Scale size={16} />
              Compare Regions
            </NavLink>
          </nav>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="rounded-md p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
            aria-label="Toggle navigation"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {isMenuOpen && (
          <nav className="grid gap-2 border-t border-slate-200 py-3 dark:border-slate-800 md:hidden">
            <NavLink to="/" className={navLinkClass} end onClick={() => setIsMenuOpen(false)}>
              <Globe2 size={16} />
              National Atlas
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass} onClick={() => setIsMenuOpen(false)}>
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
            <NavLink to="/compare" className={navLinkClass} onClick={() => setIsMenuOpen(false)}>
              <Scale size={16} />
              Compare Regions
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
