import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { siteContent } from '../../../config/siteContent';
import { getSafeNext } from '../../../utils/navigation';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const nextParam = searchParams.get('next');

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({});

    // Basic client check
    const errors = {};
    if (!form.username.trim()) errors.username = 'Username is required.';
    if (!form.password) errors.password = 'Password is required.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login(form.username.trim(), form.password);
      toast.success(`Welcome back, ${loggedUser.name || loggedUser.username}!`);
      const target = getSafeNext(loggedUser, nextParam);
      navigate(target, { replace: true });
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.errors && Array.isArray(resp.errors) && resp.errors.length > 0) {
        const mapped = {};
        resp.errors.forEach((item) => {
          const key = item.field?.replace(/^body\./, '') || item.field;
          if (key) mapped[key] = item.message;
        });
        setFieldErrors(mapped);
        setGeneralError(resp.message || 'Please correct the errors below.');
      } else {
        setGeneralError(resp?.message || 'Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card card-ui">
        {/* Brand / Logo */}
        <div className="auth-brand-block">
          <div className="sidebar-logo-monogram auth-monogram">
            {siteContent.hotelName ? siteContent.hotelName.slice(0, 2).toUpperCase() : 'LS'}
          </div>
          <h1 className="auth-title font-serif">Sign In</h1>
          <p className="auth-subtitle">Welcome back to {siteContent.hotelName || 'LuxeStay'}</p>
        </div>

        {/* General Error Alert */}
        {generalError && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form">
          {/* Username */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="login-username">
              Username
            </label>
            <div className="auth-input-wrapper">
              <User size={16} className="auth-input-icon" />
              <input
                id="login-username"
                type="text"
                className={`input-ui auth-input ${fieldErrors.username ? 'is-invalid' : ''}`}
                placeholder="Enter your username"
                value={form.username}
                onChange={(e) => {
                  setForm({ ...form, username: e.target.value });
                  if (fieldErrors.username) {
                    setFieldErrors({ ...fieldErrors, username: '' });
                  }
                }}
                autoFocus
                autoComplete="username"
              />
            </div>
            {fieldErrors.username && (
              <span className="form-field-error" role="alert">
                {fieldErrors.username}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="login-password">
              Password
            </label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className={`input-ui auth-input ${fieldErrors.password ? 'is-invalid' : ''}`}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  if (fieldErrors.password) {
                    setFieldErrors({ ...fieldErrors, password: '' });
                  }
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="form-field-error" role="alert">
                {fieldErrors.password}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-ui btn-ui-primary btn-ui-lg auth-submit-btn"
            disabled={loading}
            id="login-submit-btn"
          >
            <span>{loading ? 'Signing In…' : 'Sign In'}</span>
          </button>
        </form>

        {/* Switch Link */}
        <div className="auth-switch-box">
          <span style={{ color: 'var(--muted)' }}>New to {siteContent.hotelName || 'LuxeStay'}?</span>{' '}
          <Link
            to={`/register${location.search}`}
            className="auth-switch-link"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
