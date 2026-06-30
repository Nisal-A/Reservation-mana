/**
 * ThemeToggle.jsx
 * Cycles through dark → light → system themes.
 * Shows matching icon for current mode.
 */
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const icons = { dark: Moon, light: Sun, system: Monitor };
const labels = { dark: 'Dark', light: 'Light', system: 'System' };

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const Icon = icons[theme] || Moon;

  return (
    <button
      className="theme-toggle"
      onClick={cycleTheme}
      title={`Theme: ${labels[theme]} — click to cycle`}
      aria-label="Toggle theme"
    >
      <Icon size={16} />
      <span className="theme-toggle-label">{labels[theme]}</span>
    </button>
  );
}
