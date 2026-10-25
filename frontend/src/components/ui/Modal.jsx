import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal dialog with dark backdrop, hairline borders, and Playfair serif title.
 */
export function Modal({
  open = false,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '520px',
  className = '',
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-ui-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`modal-ui-content ${className}`}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-ui-header">
          <div>
            {title && <h3 className="modal-ui-title">{title}</h3>}
            {subtitle && <p className="modal-ui-subtitle">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              className="modal-ui-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="modal-ui-body">{children}</div>

        {footer && <div className="modal-ui-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
