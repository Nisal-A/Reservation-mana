import React from 'react';

/**
 * Card container with dark background (--card), thin hairline border,
 * optional title, subtitle, and action header.
 */
export function Card({
  title,
  subtitle,
  action,
  children,
  footer,
  className = '',
  onClick,
  ...props
}) {
  return (
    <div
      className={`card-ui ${onClick ? 'is-clickable' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="card-ui-header">
          <div>
            {title && <h3 className="card-ui-title">{title}</h3>}
            {subtitle && <p className="card-ui-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-ui-action">{action}</div>}
        </div>
      )}
      <div className="card-ui-body">{children}</div>
      {footer && <div className="card-ui-footer">{footer}</div>}
    </div>
  );
}

export default Card;
