import React from 'react';

/**
 * Tabs with gold underline on active tab.
 */
export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
}) {
  return (
    <div className={`tabs-ui ${className}`} role="tablist">
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const count = typeof tab === 'object' ? tab.count : null;
        const Icon = typeof tab === 'object' ? tab.icon : null;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            className={`tab-item-ui ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange && onChange(id)}
            type="button"
          >
            {Icon && <Icon size={16} className="tab-icon" />}
            <span className="tab-label">{label}</span>
            {count !== null && count !== undefined && (
              <span className="tab-count">{count}</span>
            )}
            {isActive && <span className="tab-gold-line" />}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
