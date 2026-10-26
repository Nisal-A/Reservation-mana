import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Mail, Phone, Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { siteContent } from '../../../config/siteContent';
import { heroPhotos } from '../../../config/photos';
import { getSafeNext } from '../../../utils/navigation';

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const nextParam = searchParams.get('next');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validateClient = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = 'Full name is required.';
    } else if (form.name.trim().length > 100) {
      errors.name = 'Name must be 100 characters or fewer.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(form.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!form.username.trim()) {
      errors.username = 'Username is required.';
    } else if (!usernameRegex.test(form.username.trim())) {
      errors.username = 'Username must be 3-30 characters (letters, numbers, underscores only).';
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!form.password) {
      errors.password = 'Password is required.';
    } else if (!passwordRegex.test(form.password)) {
      errors.password = 'Password must be at least 8 characters long and contain both letters and numbers.';
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = 'Confirm your password.';
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({});

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setGeneralError('Please resolve the errors highlighted below.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        username: form.username.trim(),
        password: form.password,
      });

      // Automatically log in with the new credentials
      const loggedUser = await login(form.username.trim(), form.password);
      toast.success('Account created successfully! Welcome to LuxeStay.');
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
        setGeneralError(resp.message || 'Please correct the highlighted fields.');
      } else {
        setGeneralError(resp?.message || 'Registration failed. Please check your information.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-split-wrapper">
        <div className="auth-card card-ui">
        {/* Brand / Logo */}
        <div className="auth-brand-block">
          <div className="sidebar-logo-monogram auth-monogram">
            {siteContent.hotelName ? siteContent.hotelName.slice(0, 2).toUpperCase() : 'LS'}
          </div>
          <h1 className="auth-title font-serif">Create Account</h1>
          <p className="auth-subtitle">Join {siteContent.hotelName || 'LuxeStay'} for a bespoke luxury experience</p>
        </div>

        {/* General Error Alert */}
        {generalError && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form">
          {/* Full Name */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="register-name">
              Full Name
            </label>
            <div className="auth-input-wrapper">
              <User size={16} className="auth-input-icon" />
              <input
                id="register-name"
                type="text"
                className={`input-ui auth-input ${fieldErrors.name ? 'is-invalid' : ''}`}
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                autoFocus
                autoComplete="name"
              />
            </div>
            {fieldErrors.name && (
              <span className="form-field-error" role="alert">
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* Email */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="register-email">
              Email Address
            </label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="register-email"
                type="email"
                className={`input-ui auth-input ${fieldErrors.email ? 'is-invalid' : ''}`}
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                autoComplete="email"
              />
            </div>
            {fieldErrors.email && (
              <span className="form-field-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Phone */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="register-phone">
              Phone Number
            </label>
            <div className="auth-input-wrapper">
              <Phone size={16} className="auth-input-icon" />
              <input
                id="register-phone"
                type="tel"
                className={`input-ui auth-input ${fieldErrors.phone ? 'is-invalid' : ''}`}
                placeholder="+94 77 123 4567"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                autoComplete="tel"
              />
            </div>
            {fieldErrors.phone && (
              <span className="form-field-error" role="alert">
                {fieldErrors.phone}
              </span>
            )}
          </div>

          {/* Username */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="register-username">
              Username
            </label>
            <div className="auth-input-wrapper">
              <Shield size={16} className="auth-input-icon" />
              <input
                id="register-username"
                type="text"
                className={`input-ui auth-input ${fieldErrors.username ? 'is-invalid' : ''}`}
                placeholder="Letters, numbers, underscores"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
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
            <label className="form-field-label" htmlFor="register-password">
              Password
            </label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="register-password"
                type={showPass ? 'text' : 'password'}
                className={`input-ui auth-input ${fieldErrors.password ? 'is-invalid' : ''}`}
                placeholder="At least 8 chars, letter & number"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <div className="form-field-wrapper">
            <label className="form-field-label" htmlFor="register-confirm-password">
              Confirm Password
            </label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="register-confirm-password"
                type={showConfirmPass ? 'text' : 'password'}
                className={`input-ui auth-input ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
              >
                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <span className="form-field-error" role="alert">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-ui btn-ui-primary btn-ui-lg auth-submit-btn"
            disabled={loading}
            id="register-submit-btn"
          >
            <span>{loading ? 'Creating Account…' : 'Create Account'}</span>
          </button>
        </form>

        {/* Switch Link */}
        <div className="auth-switch-box">
          <span style={{ color: 'var(--muted)' }}>Already registered?</span>{' '}
          <Link
            to={`/login${location.search}`}
            className="auth-switch-link"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Side Image Pane (1024px and wider) */}
        <div className="auth-side-image-pane" aria-hidden="true">
          <picture className="auth-side-pic">
            <source srcSet={heroPhotos[0].webp} type="image/webp" />
            <img
              src={heroPhotos[0].jpg}
              alt={heroPhotos[0].alt}
              className="auth-side-img"
              loading="lazy"
            />
          </picture>
          <div className="auth-side-overlay">
            <div className="auth-side-text">
              <span className="auth-side-eyebrow">THE LUXESTAY EXPERIENCE</span>
              <p className="font-serif auth-side-quote">
                Where refined coastal luxury meets timeless serenity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
