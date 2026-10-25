import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * EmptyState: no emojis, Lucide icon default, quiet premium styling.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  message,
  action,
  className = '',
}) {
  return (
    <div className={`empty-state-ui ${className}`}>
      <div className="empty-state-icon-badge">
        {React.isValidElement(Icon) ? Icon : <Icon size={26} strokeWidth={1.5} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export default EmptyState;
