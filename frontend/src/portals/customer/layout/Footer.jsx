import { Link } from 'react-router-dom';
import { siteContent } from '../../../config/siteContent';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-top">
          {/* Logo & Tagline */}
          <div className="public-footer-brand">
            <Link to="/" className="public-footer-logo">
              <div className="sidebar-logo-monogram" style={{ width: 34, height: 34, fontSize: '0.95rem' }}>
                LS
              </div>
              <span className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)' }}>
                {siteContent.hotelName}
              </span>
            </Link>
            {siteContent.tagline && (
              <p className="public-footer-tagline">{siteContent.tagline}</p>
            )}
          </div>

          {/* Quick Nav Links */}
          <div className="public-footer-nav">
            <Link to="/" className="public-footer-link">Home</Link>
            <Link to="/rooms" className="public-footer-link">Rooms & Suites</Link>
            <a href="#contact" className="public-footer-link">Contact</a>
          </div>
        </div>

        <div className="gold-divider-ui" style={{ margin: '28px 0 20px' }}>
          <div className="gold-divider-line" />
          <div className="gold-divider-dot" />
          <div className="gold-divider-line" />
        </div>

        <div className="public-footer-bottom">
          <p className="public-footer-copy">
            &copy; {currentYear} {siteContent.hotelName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
