import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Select component with optional leading icon, error text, and hint.
 */
export function Select({
  icon: Icon,
  error,
  hint,
  id,
  options = [],
  children,
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <div className={`select-ui-wrapper ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <div className="select-ui-container">
        {Icon && (
          <span className="select-ui-leading-icon">
            <Icon size={16} />
          </span>
        )}
        <select
          id={id}
          disabled={disabled}
          className={`select-ui ${Icon ? 'with-leading-icon' : ''} ${className}`}
          {...props}
        >
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <span className="select-ui-chevron">
          <ChevronDown size={15} />
        </span>
      </div>
      {error && <div className="input-ui-error">{error}</div>}
      {!error && hint && <div className="input-ui-hint">{hint}</div>}
    </div>
  );
}

export default Select;
