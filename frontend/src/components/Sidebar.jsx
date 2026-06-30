import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import {
  LayoutDashboard, BedDouble, CalendarCheck, LogIn, LogOut,
  Search, BarChart2, Home, BookOpen, History, Users, UserCog,
  Calendar, DollarSign, ClipboardList, Star, Clock
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', items: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  ]},
  { label: 'Management', items: [
    { to: '/admin/users',        icon: UserCog,       label: 'User Management' },
    { to: '/admin/rooms',        icon: BedDouble,     label: 'Room Management' },
    { to: '/admin/reservations', icon: CalendarCheck, label: 'Reservations' },
    { to: '/admin/pricing',      icon: DollarSign,    label: 'Pricing Rules' },
    { to: '/admin/housekeeping', icon: ClipboardList, label: 'Housekeeping' },
    { to: '/admin/reviews',      icon: Star,          label: 'Reviews' },
  ]},
  { label: 'Operations', items: [
    { to: '/admin/calendar',     icon: Calendar,      label: 'Availability Calendar' },
    { to: '/admin/attendance',   icon: Clock,         label: 'Attendance' },
  ]},
  { label: 'Analytics', items: [
    { to: '/admin/reports',      icon: BarChart2,     label: 'Reports' },
  ]},
];

const receptionNav = [
  { label: 'Operations', items: [
    { to: '/reception',                    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/reception/customers',          icon: Users,           label: 'Customers' },
    { to: '/reception/reservations',       icon: CalendarCheck,   label: 'Reservations' },
    { to: '/reception/create-reservation', icon: BookOpen,        label: 'New Reservation' },
    { to: '/reception/checkin',            icon: LogIn,           label: 'Check-In' },
    { to: '/reception/checkout',           icon: LogOut,          label: 'Check-Out' },
    { to: '/reception/search',             icon: Search,          label: 'Search Bookings' },
    { to: '/reception/housekeeping',       icon: ClipboardList,   label: 'Housekeeping' },
    { to: '/reception/attendance',         icon: Clock,           label: 'My Attendance' },
    { to: '/reception/calendar',           icon: Calendar,        label: 'Availability Calendar' },
  ]},
  { label: 'Analytics', items: [
    { to: '/reception/reports',            icon: BarChart2,       label: 'Reports' },
  ]},
];

const customerNav = [
  { label: 'My Account', items: [
    { to: '/customer',          icon: Home,     label: 'Home' },
    { to: '/customer/profile',  icon: UserCog,  label: 'My Profile' },
    { to: '/customer/rooms',    icon: BedDouble, label: 'Browse Rooms' },
    { to: '/customer/book',     icon: BookOpen,  label: 'Book a Room' },
    { to: '/customer/bookings', icon: History,   label: 'My Bookings' },
    { to: '/customer/reviews',  icon: Star,      label: 'My Reviews' },
  ]},
];

const navByRole = { admin: adminNav, reception: receptionNav, customer: customerNav };

export default function Sidebar() {
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
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏨</div>
        <div>
          <div className="sidebar-logo-text">LuxeStay</div>
          <div className="sidebar-logo-sub">Hotel Management</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map((section) => (
          <div key={section.label} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to.split('/').length === 2}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ marginBottom: 8 }}>
          <ThemeToggle />
        </div>
        <div className="user-info-sidebar">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name || user.username}
            </div>
            <div className="user-role">{user.role}</div>
          </div>
          <button className="icon-btn" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
