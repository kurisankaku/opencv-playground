import { Link } from 'react-router-dom';

/**
 * Wordmark with the RGB channel-split signature — literally what cv.split does,
 * rendered as type. The aperture glyph nods to the optical/vision-lab theme.
 */
export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5 select-none" aria-label="OpenCV Playground ホーム">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2">
        <span className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ boxShadow: '0 0 18px -2px var(--color-violet)' }} />
        <Aperture />
      </span>
      <span className="font-display text-[15px] font-bold leading-none tracking-tight">
        <span className="chromatic chromatic-hover">OpenCV</span>
        <span className="text-fg-faint"> / </span>
        <span className="spectral-text">Playground</span>
      </span>
    </Link>
  );
}

function Aperture() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="var(--color-fg-dim)" strokeWidth="1.5" />
      <path d="M12 3l4.5 7.8M21 12l-9 0M16.5 19.2L12 12M7.5 19.2L12 12M3 12h9M7.5 4.8L12 12"
        stroke="var(--color-violet)" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
      <circle cx="12" cy="12" r="2.4" fill="var(--color-cyan)" />
    </svg>
  );
}
