import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { OpenCvStatus } from './OpenCvStatus';

export function Header() {
  const { pathname } = useLocation();
  const nav = [
    { to: '/', label: 'ホーム' },
    { to: '/demos', label: 'デモ一覧' },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          {nav.map((n) => {
            const active = n.to === '/' ? pathname === '/' : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-surface-2 text-fg' : 'text-fg-dim hover:text-fg'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <div className="ml-2">
            <OpenCvStatus />
          </div>
        </nav>
      </div>
    </header>
  );
}
