import { Link } from "@tanstack/react-router";
export function Logo({ light, size = "default" }: { light?: boolean; size?: "default" | "hero" }) {
  const hero = size === "hero";
  return (
    <Link to="/" className={`inline-flex items-center ${hero ? "gap-4 sm:gap-6" : "gap-2"}`} aria-label="Orbit home">
      <svg className={hero ? "h-20 w-20 sm:h-24 sm:w-24" : "h-[26px] w-[26px]"} viewBox="0 0 26 26" aria-hidden>
        <circle cx="13" cy="13" r="6" fill="var(--sage)" />
        <ellipse cx="13" cy="13" rx="11.5" ry="5" fill="none" stroke={light ? "var(--chrome-foreground)" : "var(--primary)"} strokeWidth="1.6" transform="rotate(-25 13 13)" />
        <circle cx="23" cy="9" r="2" fill="var(--lavender)" />
      </svg>
      <span className={`font-display ${hero ? "text-7xl sm:text-8xl" : "text-xl"} font-semibold ${light ? "text-chrome-foreground" : "text-foreground"}`}>Orbit</span>
    </Link>
  );
}
