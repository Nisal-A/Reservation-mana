import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth Pages
import Login    from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminDashboard    from './pages/admin/Dashboard';
import RoomManagement    from './pages/admin/RoomManagement';
import AdminReservations from './pages/admin/Reservations';
import Reports           from './pages/admin/Reports';
import UserManagement    from './pages/admin/UserManagement';
import PricingRules      from './pages/admin/PricingRules';
import AttendanceAdmin   from './pages/admin/AttendanceAdmin';
import ReviewsAdmin      from './pages/admin/ReviewsAdmin';

// Reception Pages
import ReceptionDashboard  from './pages/reception/Dashboard';
import ReceptionReservations from './pages/reception/Reservations';
import CreateReservation   from './pages/reception/CreateReservation';
import CheckIn             from './pages/reception/CheckIn';
import CheckOut            from './pages/reception/CheckOut';
import SearchBookings      from './pages/reception/SearchBookings';
import CustomerManagement  from './pages/reception/CustomerManagement';

// Customer Pages
import CustomerHome from './pages/customer/Home';
import BrowseRooms  from './pages/customer/BrowseRooms';
import BookRoom     from './pages/customer/BookRoom';
import MyBookings   from './pages/customer/MyBookings';
import Profile      from './pages/customer/Profile';
import Reviews      from './pages/customer/Reviews';

// Shared (Multi-role) Pages
import AvailabilityCalendar from './pages/shared/AvailabilityCalendar';
import Attendance           from './pages/shared/Attendance';
import Housekeeping         from './pages/shared/Housekeeping';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="users"        element={<UserManagement />} />
        <Route path="rooms"        element={<RoomManagement />} />
        <Route path="reservations" element={<AdminReservations />} />
        <Route path="reports"      element={<Reports />} />
        <Route path="pricing"      element={<PricingRules />} />
        <Route path="attendance"   element={<AttendanceAdmin />} />
        <Route path="housekeeping" element={<Housekeeping />} />
        <Route path="reviews"      element={<ReviewsAdmin />} />
        <Route path="calendar"     element={<AvailabilityCalendar />} />
      </Route>

      {/* Reception */}
      <Route path="/reception" element={
        <ProtectedRoute roles={['reception']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ReceptionDashboard />} />
        <Route path="customers"          element={<CustomerManagement />} />
        <Route path="reservations"       element={<ReceptionReservations />} />
        <Route path="create-reservation" element={<CreateReservation />} />
        <Route path="checkin"            element={<CheckIn />} />
        <Route path="checkout"           element={<CheckOut />} />
        <Route path="search"             element={<SearchBookings />} />
        <Route path="reports"            element={<Reports />} />
        <Route path="housekeeping"       element={<Housekeeping />} />
        <Route path="attendance"         element={<Attendance />} />
        <Route path="calendar"           element={<AvailabilityCalendar />} />
      </Route>

      {/* Customer */}
      <Route path="/customer" element={
        <ProtectedRoute roles={['customer']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<CustomerHome />} />
        <Route path="rooms"    element={<BrowseRooms />} />
        <Route path="book"     element={<BookRoom />} />
        <Route path="bookings" element={<MyBookings />} />
        <Route path="profile"  element={<Profile />} />
        <Route path="reviews"  element={<Reviews />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'var(--color-surface)' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: 'var(--color-surface)' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
