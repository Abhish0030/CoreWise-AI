'use client';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { SunMoon } from 'lucide-react';
const subscribe = () => () => {};
export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <label className="theme-control">
      <SunMoon size={17} />
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        value={mounted ? theme : 'dark'}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="dark">Obsidian</option>
        <option value="light">Frost</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
