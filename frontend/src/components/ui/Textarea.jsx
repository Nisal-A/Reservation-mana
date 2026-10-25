import React from 'react';

/**
 * Textarea component with optional leading icon, error text, and hint.
 */
export function Textarea({
  icon: Icon,
  error,
  hint,
  id,
  className = '',
  rows = 3,
  disabled = false,
  ...props
}) {
  return (
    <div className={`textarea-ui-wrapper ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <div className="textarea-ui-container">
        {Icon && (
          <span className="textarea-ui-leading-icon">
            <Icon size={16} />
          </span>
        )}
        <textarea
          id={id}
          rows={rows}
          disabled={disabled}
          className={`textarea-ui ${Icon ? 'with-leading-icon' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <div className="input-ui-error">{error}</div>}
      {!error && hint && <div className="input-ui-hint">{hint}</div>}
    </div>
  );
}

export default Textarea;
