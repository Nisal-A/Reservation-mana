import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Staff Shell Layout
import Layout from './components/Layout';

// Customer Portal Layout
import CustomerLayout from './portals/customer/layout/CustomerLayout';

// Customer Portal Pages (Code-split with React.lazy)
const Home = lazy(() => import('./portals/customer/pages/Home'));
const Rooms = lazy(() => import('./portals/customer/pages/Rooms'));
const RoomDetails = lazy(() => import('./portals/customer/pages/RoomDetails'));
const Checkout = lazy(() => import('./portals/customer/pages/Checkout'));
const BookingConfirmation = lazy(() => import('./portals/customer/pages/BookingConfirmation'));
const MyBookings = lazy(() => import('./portals/customer/pages/MyBookings'));
const BookingDetails = lazy(() => import('./portals/customer/pages/BookingDetails'));
const Profile = lazy(() => import('./portals/customer/pages/Profile'));
const Reviews = lazy(() => import('./portals/customer/pages/Reviews'));

// Auth Pages
const Login = lazy(() => import('./portals/customer/pages/Login'));
const Register = lazy(() => import('./portals/customer/pages/Register'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const RoomManagement = lazy(() => import('./pages/admin/RoomManagement'));
const AdminReservations = lazy(() => import('./pages/admin/Reservations'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const ReviewsAdmin = lazy(() => import('./pages/admin/ReviewsAdmin'));

// Reception Pages
const ReceptionDashboard = lazy(() => import('./pages/reception/Dashboard'));
const ReceptionReservations = lazy(() => import('./pages/reception/Reservations'));
const CreateReservation = lazy(() => import('./pages/reception/CreateReservation'));
const CheckIn = lazy(() => import('./pages/reception/CheckIn'));
const CheckOut = lazy(() => import('./pages/reception/CheckOut'));
const CustomerManagement = lazy(() => import('./pages/reception/CustomerManagement'));

// Shared Pages
const AvailabilityCalendar = lazy(() => import('./pages/shared/AvailabilityCalendar'));

// Dev UI Showcase (strictly excluded from production bundles)
const DevUI = import.meta.env.DEV ? lazy(() => import('./pages/dev/DevUI')) : null;

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem' }}>
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(212, 163, 115, 0.25)',
          borderTopColor: 'var(--color-primary, #b8860b)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Dev UI Showcase (DEV only, tree-shaken in production) */}
        {import.meta.env.DEV && DevUI && (
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

        {/* Global 404 / Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
