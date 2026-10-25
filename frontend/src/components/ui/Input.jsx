import React from 'react';

/**
 * Input component with optional leading icon, error text, and hint.
 */
export function Input({
  icon: Icon,
  error,
  hint,
  id,
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <div className={`input-ui-wrapper ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <div className="input-ui-container">
        {Icon && (
          <span className="input-ui-leading-icon">
            <Icon size={16} />
          </span>
        )}
        <input
          id={id}
          disabled={disabled}
          className={`input-ui ${Icon ? 'with-leading-icon' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <div className="input-ui-error">{error}</div>}
      {!error && hint && <div className="input-ui-hint">{hint}</div>}
    </div>
  );
}

export default Input;
