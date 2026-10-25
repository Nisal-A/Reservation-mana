import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="app-layout">
      {/* Mobile / Tablet Top Bar (width 1024px and below) */}
      <header className="mobile-topbar" aria-label="Mobile Navigation Bar">
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand">
          <div className="sidebar-logo-monogram" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>LS</div>
          <span className="mobile-brand-title">LuxeStay</span>
        </div>
      </header>

      {/* Dark Overlay when mobile drawer is open */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Fixed 260px on desktop, slide-in drawer on mobile/tablet */}
      <Sidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
