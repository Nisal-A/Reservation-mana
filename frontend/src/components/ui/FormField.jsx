import React from 'react';

/**
 * FormField wrapper with uppercase muted 12px label, required marker, error, and hint.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
  className = '',
}) {
  return (
    <div className={`form-field-ui ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="form-field-label">
          {label}
          {required && <span className="form-field-required">*</span>}
        </label>
      )}
      {children}
      {error && <div className="input-ui-error">{error}</div>}
      {!error && hint && <div className="input-ui-hint">{hint}</div>}
    </div>
  );
}

export default FormField;
