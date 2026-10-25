import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

/**
 * ErrorState: error message plus retry button.
 */
export function ErrorState({
  title = 'Unable to Load Data',
  message = 'An unexpected error occurred while loading content.',
  onRetry,
  retryText = 'Try Again',
  className = '',
}) {
  return (
    <div className={`error-state-ui ${className}`}>
      <div className="error-state-icon-badge">
        <AlertCircle size={28} />
      </div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      {onRetry && (
        <div className="error-state-action">
          <Button
            variant="secondary"
            onClick={onRetry}
            icon={RefreshCw}
          >
            {retryText}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
