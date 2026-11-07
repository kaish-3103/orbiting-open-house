import { Link } from "@tanstack/react-router";
export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="13" cy="13" r="6" fill="var(--sage)" />
        <ellipse cx="13" cy="13" rx="11.5" ry="5" fill="none" stroke={light ? "var(--chrome-foreground)" : "var(--primary)"} strokeWidth="1.6" transform="rotate(-25 13 13)" />
        <circle cx="23" cy="9" r="2" fill="var(--lavender)" />
      </svg>
      <span className={`font-display text-xl font-semibold ${light ? "text-chrome-foreground" : "text-foreground"}`}>Orbit</span>
    </Link>
  );
}
