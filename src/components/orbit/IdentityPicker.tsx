import { AVATAR_COLORS } from "@/lib/house";
export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-3">
      {AVATAR_COLORS.map((c) => (
        <button key={c} type="button" aria-label={c} onClick={() => onChange(c)}
          className={`h-12 w-12 rounded-full border-4 transition ${value === c ? "border-primary scale-110" : "border-card"}`}
          style={{ background: `var(--${c})` }} />
      ))}
    </div>
  );
}
