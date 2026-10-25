import React from 'react';
import Eyebrow from './Eyebrow';

/**
 * PageHeader with Playfair Display serif title, optional eyebrow, subtitle, and action buttons.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  actions,
  className = '',
}) {
  const actionContent = action || actions;

  return (
    <div className={`page-header-ui ${className}`}>
      <div className="page-header-text">
        {eyebrow && <Eyebrow className="page-header-eyebrow">{eyebrow}</Eyebrow>}
        {title && <h1 className="page-header-title">{title}</h1>}
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actionContent && <div className="page-header-action">{actionContent}</div>}
    </div>
  );
}

export default PageHeader;
