import React from 'react';
import { Calendar } from 'lucide-react';
import { todayISO } from '../../utils/format';

/**
 * Calculate preset date ranges using 'YYYY-MM-DD' strings.
 */
function getPresetRange(key) {
  const today = todayISO();
  const [y, m, d] = today.split('-').map(Number);

  if (key === 'today') {
    return { startDate: today, endDate: today };
  }

  if (key === 'last7') {
    // 7 days ago
    const dt = new Date(Date.UTC(y, m - 1, d - 6));
    const start = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    return { startDate: start, endDate: today };
  }

  if (key === 'thisMonth') {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    return { startDate: start, endDate: today };
  }

  if (key === 'lastMonth') {
    const prevMonthYear = m === 1 ? y - 1 : y;
    const prevMonth = m === 1 ? 12 : m - 1;
    const start = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-01`;
    // Last day of previous month
    const lastDayDt = new Date(Date.UTC(y, m - 1, 0));
    const end = `${lastDayDt.getUTCFullYear()}-${String(lastDayDt.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDayDt.getUTCDate()).padStart(2, '0')}`;
    return { startDate: start, endDate: end };
  }

  if (key === 'thisYear') {
    const start = `${y}-01-01`;
    return { startDate: start, endDate: today };
  }

  return { startDate: '', endDate: '' };
}

/**
 * DateRangePicker with two date inputs and quick presets:
 * Today, Last 7 days, This month, Last month, This year.
 */
export function DateRangePicker({
  startDate = '',
  endDate = '',
  onChange,
  className = '',
}) {
  const PRESETS = [
    { key: 'today',     label: 'Today' },
    { key: 'last7',     label: 'Last 7 days' },
    { key: 'thisMonth', label: 'This month' },
    { key: 'lastMonth', label: 'Last month' },
    { key: 'thisYear',  label: 'This year' },
  ];

  const handlePreset = (key) => {
    const range = getPresetRange(key);
    if (onChange) onChange(range);
  };

  const handleStartChange = (e) => {
    if (onChange) onChange({ startDate: e.target.value, endDate });
  };

  const handleEndChange = (e) => {
    if (onChange) onChange({ startDate, endDate: e.target.value });
  };

  return (
    <div className={`date-range-picker-ui ${className}`}>
      <div className="date-range-presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="preset-btn"
            onClick={() => handlePreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="date-range-inputs">
        <div className="date-input-field">
          <span className="date-input-icon">
            <Calendar size={14} />
          </span>
          <input
            type="date"
            value={startDate}
            onChange={handleStartChange}
            className="date-input-element"
            aria-label="Start date"
          />
        </div>

        <span className="date-range-separator">—</span>

        <div className="date-input-field">
          <span className="date-input-icon">
            <Calendar size={14} />
          </span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndChange}
            className="date-input-element"
            aria-label="End date"
          />
        </div>
      </div>
    </div>
  );
}

export default DateRangePicker;
