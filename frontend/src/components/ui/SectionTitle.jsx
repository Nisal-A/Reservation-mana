import React from 'react';
import Eyebrow from './Eyebrow';
import GoldDivider from './GoldDivider';

/**
 * SectionTitle: eyebrow + Playfair title + GoldDivider
 */
export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className = '',
  divider = true,
}) {
  return (
    <div className={`section-title-ui text-${align} ${className}`}>
      {eyebrow && <Eyebrow className="section-title-eyebrow">{eyebrow}</Eyebrow>}
      <h2 className="section-title-heading">{title}</h2>
      {subtitle && <p className="section-title-subtitle">{subtitle}</p>}
      {divider && <GoldDivider className="section-title-divider" />}
    </div>
  );
}

export default SectionTitle;
