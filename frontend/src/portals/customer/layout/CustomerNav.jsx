import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, ChevronDown, Calendar, Star, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { siteContent } from '../../../config/siteContent';

export default function CustomerNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useRef(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname, location.search]);

  // Close account menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleContactClick = (e) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (location.pathname === '/') {
      const el = document.getElementById('contact');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate('/#contact');
    setTimeout(() => {
      const el = document.getElementById('contact');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleLogout = () => {
    logout();
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  const initials = (user?.name || user?.username || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="public-nav-header">
      <div className="public-nav-inner">
        {/* Brand Block */}
        <Link to="/" className="public-nav-brand" aria-label={`${siteContent.hotelName} Home`}>
          <div className="sidebar-logo-monogram" style={{ width: 34, height: 34, fontSize: '0.95rem' }}>
            LS
          </div>
          <span className="public-nav-logo-text font-serif">
            {siteContent.hotelName}
          </span>
        </Link>

        {/* Desktop Nav Links: uppercase 14px, 70% white turning gold on hover */}
        <nav className="public-nav-links" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to="/rooms"
            className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
          >
            Rooms
          </NavLink>
          <a
            href="#contact"
            onClick={handleContactClick}
            className="public-nav-link"
          >
            Contact
          </a>
        </nav>

        {/* Desktop Right Side Actions */}
        <div className="public-nav-actions">
          {/* 1. Logged-in Staff: Go to my portal */}
          {user && (user.role === 'admin' || user.role === 'reception') && (
            <Link
              to={`/${user.role}`}
              className="btn-ui btn-ui-secondary btn-ui-sm"
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}
            >
              <span>Go to my portal</span>
              <ArrowRight size={14} />
            </Link>
          )}

          {/* 2. Logged-in Customer: Account Menu */}
          {user && user.role === 'customer' && (
            <div className="public-nav-account" ref={accountRef}>
              <button
                type="button"
                className="public-account-btn"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
                aria-label="Account menu"
              >
                <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '11px' }}>
                  {initials}
                </div>
                <span className="public-account-name">{user.name || user.username}</span>
                <ChevronDown size={14} style={{ color: 'var(--muted)', transform: accountMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {accountMenuOpen && (
                <div className="public-account-dropdown" role="menu">
                  <div className="public-account-dropdown-header">
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>
                      {user.name || user.username}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                      {user.email || 'Customer Account'}
                    </div>
                  </div>

                  <div className="gold-divider-ui" style={{ margin: '8px 0' }}>
                    <div className="gold-divider-line" />
                    <div className="gold-divider-dot" />
                    <div className="gold-divider-line" />
                  </div>

                  <Link
                    to="/account/bookings"
                    className="public-dropdown-item"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Calendar size={15} />
                    <span>My Bookings</span>
                  </Link>

                  <Link
                    to="/account/profile"
                    className="public-dropdown-item"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <User size={15} />
                    <span>Profile</span>
                  </Link>

                  <Link
                    to="/account/reviews"
                    className="public-dropdown-item"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Star size={15} />
                    <span>My Reviews</span>
                  </Link>

                  <div className="gold-divider-ui" style={{ margin: '8px 0' }}>
                    <div className="gold-divider-line" />
                    <div className="gold-divider-dot" />
                    <div className="gold-divider-line" />
                  </div>

                  <button
                    type="button"
                    className="public-dropdown-item public-dropdown-logout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Guests: Login and Register (no admin button) */}
          {!user && (
            <div className="public-nav-guest-btns">
              <Link
                to="/login"
                className="public-nav-login-link"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="btn-ui btn-ui-primary btn-ui-sm"
              >
                Register
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="public-nav-mobile-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu (#0F0F0F) */}
      {mobileMenuOpen && (
        <div className="public-nav-mobile-dropdown" id="mobile-menu">
          <nav className="public-mobile-links" aria-label="Mobile Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `public-mobile-link ${isActive ? 'active' : ''}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/rooms"
              className={({ isActive }) => `public-mobile-link ${isActive ? 'active' : ''}`}
            >
              Rooms
            </NavLink>
            <a
              href="#contact"
              onClick={handleContactClick}
              className="public-mobile-link"
            >
              Contact
            </a>

            <div className="gold-divider-ui" style={{ margin: '12px 0' }}>
              <div className="gold-divider-line" />
              <div className="gold-divider-dot" />
              <div className="gold-divider-line" />
            </div>

            {/* Mobile Auth Actions */}
            {user && (user.role === 'admin' || user.role === 'reception') && (
              <Link
                to={`/${user.role}`}
                className="btn-ui btn-ui-secondary btn-ui-md"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Go to my portal</span>
                <ArrowRight size={16} />
              </Link>
            )}

            {user && user.role === 'customer' && (
              <div className="public-mobile-customer-menu">
                <div className="public-mobile-user-info">
                  <div className="user-avatar" style={{ width: 34, height: 34, fontSize: '12px' }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name || user.username}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{user.email || 'Customer'}</div>
                  </div>
                </div>
                <Link to="/account/bookings" className="public-mobile-link">
                  <Calendar size={16} />
                  <span>My Bookings</span>
                </Link>
                <Link to="/account/profile" className="public-mobile-link">
                  <User size={16} />
                  <span>Profile</span>
                </Link>
                <Link to="/account/reviews" className="public-mobile-link">
                  <Star size={16} />
                  <span>My Reviews</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="public-mobile-link"
                  style={{ color: 'var(--danger)', width: '100%', textAlign: 'left', background: 'transparent', border: 'none' }}
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            )}

            {!user && (
              <div className="public-mobile-guest-actions">
                <Link to="/login" className="btn-ui btn-ui-secondary btn-ui-md" style={{ flex: 1, justifyContent: 'center' }}>
                  Login
                </Link>
                <Link to="/register" className="btn-ui btn-ui-primary btn-ui-md" style={{ flex: 1, justifyContent: 'center' }}>
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
