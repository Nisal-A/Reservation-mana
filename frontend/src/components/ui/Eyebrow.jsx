import React from 'react';

/**
 * Eyebrow component: gold, 12px, 600, uppercase, letter-spacing 0.35em.
 */
export function Eyebrow({ children, className = '', as: Component = 'div', ...props }) {
  return (
    <Component className={`eyebrow-ui ${className}`} {...props}>
      {children}
    </Component>
  );
}

export default Eyebrow;
