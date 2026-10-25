import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button component supporting primary (gold fill with dark text),
 * secondary (gold outline), danger (danger text), and ghost variants.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  type = 'button',
  ...props
}) {
  const variantClass = {
    primary: 'btn-ui-primary',
    secondary: 'btn-ui-secondary',
    danger: 'btn-ui-danger',
    ghost: 'btn-ui-ghost',
  }[variant] || 'btn-ui-primary';

  const sizeClass = {
    sm: 'btn-ui-sm',
    md: 'btn-ui-md',
    lg: 'btn-ui-lg',
  }[size] || 'btn-ui-md';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`btn-ui ${variantClass} ${sizeClass} ${loading ? 'is-loading' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="btn-ui-spinner" size={size === 'sm' ? 14 : 16} />
      ) : Icon ? (
        <Icon className="btn-ui-icon" size={size === 'sm' ? 14 : 16} />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export default Button;
