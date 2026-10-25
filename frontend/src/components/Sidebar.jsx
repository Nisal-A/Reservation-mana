import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  BarChart2,
  CalendarCheck,
  BedDouble,
  Users,
  UserCog,
  Star,
  Calendar,
  Plus,
  LogIn,
  LogOut,
  Home,
  BookOpen,
  History,
  User,
  X,
} from 'lucide-react';

const adminNav = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/reports',      icon: BarChart2,       label: 'Reports' },
  { to: '/admin/reservations', icon: CalendarCheck,   label: 'Reservations' },
  { to: '/admin/rooms',        icon: BedDouble,       label: 'Rooms' },
  { to: '/admin/customers',    icon: Users,           label: 'Customers' },
  { to: '/admin/users',        icon: UserCog,         label: 'Users' },
  { to: '/admin/reviews',      icon: Star,            label: 'Reviews' },
  { to: '/admin/calendar',     icon: Calendar,        label: 'Availability Calendar' },
];

const receptionNav = [
  { to: '/reception',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/reception/new',          icon: Plus,            label: 'New Reservation' },
  { to: '/reception/reservations', icon: CalendarCheck,   label: 'Reservations' },
  { to: '/reception/check-in',     icon: LogIn,           label: 'Check-In' },
  { to: '/reception/check-out',    icon: LogOut,          label: 'Check-Out' },
  { to: '/reception/customers',    icon: Users,           label: 'Customers' },
  { to: '/reception/calendar',     icon: Calendar,        label: 'Availability Calendar' },
];

const customerNav = [
  { to: '/customer',          icon: Home,      label: 'Home' },
  { to: '/customer/rooms',    icon: BedDouble, label: 'Browse Rooms' },
  { to: '/customer/book',     icon: BookOpen,  label: 'Book a Room' },
  { to: '/customer/bookings', icon: History,   label: 'My Bookings' },
  { to: '/customer/reviews',  icon: Star,      label: 'My Reviews' },
  { to: '/customer/profile',  icon: User,      label: 'My Profile' },
];

const navByRole = {
  admin: adminNav,
  reception: receptionNav,
  customer: customerNav,
};

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const nav = navByRole[user.role] || [];
  const initials = (user.name || user.username || 'U').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`sidebar ${isOpen ? 'is-open' : ''}`}
      aria-label="Staff Navigation"
    >
      {/* Brand Block */}
      <div className="sidebar-logo">
        <div className="sidebar-brand-group">
          <div className="sidebar-logo-monogram">LS</div>
          <span className="sidebar-brand-text">LuxeStay</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="mobile-sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Main Menu">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/reception' || item.to === '/customer'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User & Logout Footer */}
      <div className="sidebar-footer">
        <div className="user-info-sidebar">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="user-name"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {user.name || user.username}
            </div>
            <div className="user-role">{user.role}</div>
          </div>
          <button
            type="button"
            className="icon-btn logout-btn"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
