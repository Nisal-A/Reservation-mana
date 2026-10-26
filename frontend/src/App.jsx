import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Staff Shell Layout
import Layout from './components/Layout';

// Customer Portal Layout & Pages
import CustomerLayout from './portals/customer/layout/CustomerLayout';
import Home from './portals/customer/pages/Home';
import Rooms from './portals/customer/pages/Rooms';
import RoomDetails from './portals/customer/pages/RoomDetails';
import Checkout from './portals/customer/pages/Checkout';
import BookingConfirmation from './portals/customer/pages/BookingConfirmation';
import MyBookings from './portals/customer/pages/MyBookings';
import BookingDetails from './portals/customer/pages/BookingDetails';
import Profile from './portals/customer/pages/Profile';
import Reviews from './portals/customer/pages/Reviews';

// Auth Pages (Centred inside CustomerLayout)
import Login from './portals/customer/pages/Login';
import Register from './portals/customer/pages/Register';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import RoomManagement from './pages/admin/RoomManagement';
import AdminReservations from './pages/admin/Reservations';
import Reports from './pages/admin/Reports';
import UserManagement from './pages/admin/UserManagement';
import ReviewsAdmin from './pages/admin/ReviewsAdmin';

// Reception Pages
import ReceptionDashboard from './pages/reception/Dashboard';
import ReceptionReservations from './pages/reception/Reservations';
import CreateReservation from './pages/reception/CreateReservation';
import CheckIn from './pages/reception/CheckIn';
import CheckOut from './pages/reception/CheckOut';
import CustomerManagement from './pages/reception/CustomerManagement';

// Shared Pages
import AvailabilityCalendar from './pages/shared/AvailabilityCalendar';

// Dev UI Showcase
import DevUI from './pages/dev/DevUI';

function AppRoutes() {
  return (
    <Routes>
      {/* Dev UI Showcase (DEV only) */}
      {import.meta.env.DEV && (
        <Route path="/dev/ui" element={<DevUI />} />
      )}

      {/* Customer & Public Routes inside CustomerLayout (PublicNav + Footer) */}
      <Route element={<CustomerLayout />}>
        {/* Public Pages */}
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomDetails />} />

        {/* Centred Auth Cards inside CustomerLayout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Customer Routes (Guests sent to /login?next=<current path>) */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute roles={['customer']}>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/:ref/confirmation"
          element={
            <ProtectedRoute roles={['customer']}>
              <BookingConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/bookings"
          element={
            <ProtectedRoute roles={['customer']}>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/bookings/:ref"
          element={
            <ProtectedRoute roles={['customer']}>
              <BookingDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/profile"
          element={
            <ProtectedRoute roles={['customer']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/reviews"
          element={
            <ProtectedRoute roles={['customer']}>
              <Reviews />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Admin Portal (Staff Shell) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reservations" element={<AdminReservations />} />
        <Route path="rooms" element={<RoomManagement />} />
        <Route path="customers" element={<CustomerManagement />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="reviews" element={<ReviewsAdmin />} />
        <Route path="calendar" element={<AvailabilityCalendar />} />
      </Route>

      {/* Reception Portal (Staff Shell) */}
      <Route
        path="/reception"
        element={
          <ProtectedRoute roles={['reception']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ReceptionDashboard />} />
        <Route path="new" element={<CreateReservation />} />
        <Route path="reservations" element={<ReceptionReservations />} />
        <Route path="check-in" element={<CheckIn />} />
        <Route path="check-out" element={<CheckOut />} />
        <Route path="customers" element={<CustomerManagement />} />
        <Route path="calendar" element={<AvailabilityCalendar />} />

        {/* Legacy reception redirects */}
        <Route path="create-reservation" element={<Navigate to="/reception/new" replace />} />
        <Route path="checkin" element={<Navigate to="/reception/check-in" replace />} />
        <Route path="checkout" element={<Navigate to="/reception/check-out" replace />} />
      </Route>

      {/* Legacy customer routes redirect to new customer portal */}
      <Route path="/customer" element={<Navigate to="/" replace />} />
      <Route path="/customer/rooms" element={<Navigate to="/rooms" replace />} />
      <Route path="/customer/book" element={<Navigate to="/rooms" replace />} />
      <Route path="/customer/bookings" element={<Navigate to="/account/bookings" replace />} />
      <Route path="/customer/profile" element={<Navigate to="/account/profile" replace />} />
      <Route path="/customer/reviews" element={<Navigate to="/account/reviews" replace />} />
      <Route path="/customer/*" element={<Navigate to="/" replace />} />

      {/* Global 404 / Fallback */}
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
            error: { iconTheme: { primary: '#ef4444', secondary: 'var(--color-surface)' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
