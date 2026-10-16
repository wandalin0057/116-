import { useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "跟隨系統" },
  { value: "light", label: "淺色" },
  { value: "dark", label: "深色" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <span className="sr-only sm:not-sr-only">外觀</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemePreference)}
        className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
