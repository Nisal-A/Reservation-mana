import React from 'react';
import { Check } from 'lucide-react';

/**
 * Stepper: displays a progress sequence with circles only for step dots.
 */
export function Stepper({
  steps = [],
  currentStep = 0,
  onStepClick,
  className = '',
}) {
  return (
    <div className={`stepper-ui ${className}`}>
      {steps.map((step, index) => {
        const label = typeof step === 'string' ? step : step.label;
        const description = typeof step === 'object' ? step.description : null;
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;
        const isClickable = Boolean(onStepClick && (isCompleted || isCurrent));

        return (
          <React.Fragment key={label || index}>
            <div
              className={`stepper-step ${isCompleted ? 'is-completed' : ''} ${
                isCurrent ? 'is-current' : ''
              } ${isPending ? 'is-pending' : ''} ${isClickable ? 'is-clickable' : ''}`}
              onClick={() => isClickable && onStepClick(index)}
            >
              <div className="stepper-dot">
                {isCompleted ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="stepper-labels">
                <span className="stepper-label">{label}</span>
                {description && (
                  <span className="stepper-description">{description}</span>
                )}
              </div>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`stepper-connector ${
                  index < currentStep ? 'is-active' : ''
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default Stepper;
