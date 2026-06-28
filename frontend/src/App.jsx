import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import RoomManagement from './pages/admin/RoomManagement';
import AdminReservations from './pages/admin/Reservations';
import Reports from './pages/admin/Reports';

// Reception Pages
import ReceptionDashboard from './pages/reception/Dashboard';
import ReceptionReservations from './pages/reception/Reservations';
import CreateReservation from './pages/reception/CreateReservation';
import CheckIn from './pages/reception/CheckIn';
import CheckOut from './pages/reception/CheckOut';
import SearchBookings from './pages/reception/SearchBookings';

// Customer Pages
import CustomerHome from './pages/customer/Home';
import BrowseRooms from './pages/customer/BrowseRooms';
import BookRoom from './pages/customer/BookRoom';
import MyBookings from './pages/customer/MyBookings';

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
        <Route path="rooms"        element={<RoomManagement />} />
        <Route path="reservations" element={<AdminReservations />} />
        <Route path="reports"      element={<Reports />} />
      </Route>

      {/* Reception */}
      <Route path="/reception" element={
        <ProtectedRoute roles={['reception']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ReceptionDashboard />} />
        <Route path="reservations"       element={<ReceptionReservations />} />
        <Route path="create-reservation" element={<CreateReservation />} />
        <Route path="checkin"            element={<CheckIn />} />
        <Route path="checkout"           element={<CheckOut />} />
        <Route path="search"             element={<SearchBookings />} />
        <Route path="reports"            element={<Reports />} />
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
              background: '#1a2235',
              color: '#f0f2f8',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#1a2235' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#1a2235' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
