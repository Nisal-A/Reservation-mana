import { useState, useEffect } from 'react';
import { User, Phone, Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import {
  Button,
  Input,
  FormField,
  GoldDivider,
  Eyebrow,
  Skeleton,
} from '../../../components/UI';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);

  // Section 1: Personal Info
  const [personal, setPersonal] = useState({
    name: '',
    phone: '',
    email: '',
    username: '',
  });
  const [personalErrors, setPersonalErrors] = useState({});
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Section 2: Security & Password
  const [passwords, setPasswords] = useState({
    current_password: '',
    password: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  // Fetch initial profile
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const { data: customer } = await api.get('/customers/me');
        if (isMounted) {
          setPersonal({
            name: customer.name || '',
            phone: customer.phone || '',
            email: customer.email || (user?.email || ''),
            username: user?.username || '',
          });
        }
      } catch {
        if (isMounted && user) {
          setPersonal({
            name: user.name || '',
            phone: '',
            email: user.email || '',
            username: user.username || '',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle Personal Details Submit
  const handlePersonalSubmit = async (e) => {
    e.preventDefault();
    setPersonalErrors({});

    const errors = {};
    if (!personal.name || !personal.name.trim()) {
      errors.name = 'Full name is required.';
    }

    if (personal.phone && personal.phone.trim()) {
      const phoneRegex = /^[0-9+() -]{7,20}$/;
      if (!phoneRegex.test(personal.phone.trim())) {
        errors.phone = 'Please enter a valid phone number (e.g. +94 11 234 5678).';
      }
    }

    if (Object.keys(errors).length > 0) {
      setPersonalErrors(errors);
      return;
    }

    setSavingPersonal(true);
    try {
      const payload = {
        name: personal.name.trim(),
        phone: personal.phone ? personal.phone.trim() : null,
      };
      const { data } = await api.put('/customers/profile', payload);
      toast.success('Personal information updated successfully.');

      if (setUser && data.customer) {
        setUser({
          ...user,
          name: data.customer.name,
        });
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        const fieldErrors = {};
        responseData.errors.forEach((errItem) => {
          if (errItem.path?.[1]) fieldErrors[errItem.path[1]] = errItem.message;
          else if (errItem.field) fieldErrors[errItem.field] = errItem.message;
        });
        setPersonalErrors(fieldErrors);
      }
      toast.error(responseData?.message || 'Failed to update personal details.');
    } finally {
      setSavingPersonal(false);
    }
  };

  // Handle Password Change Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors({});

    const errors = {};
    if (!passwords.current_password) {
      errors.current_password = 'Current password is required.';
    }
    if (!passwords.password) {
      errors.password = 'New password is required.';
    } else if (passwords.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(passwords.password)) {
      errors.password = 'Password must contain both letters and numbers.';
    }

    if (!passwords.confirmPassword) {
      errors.confirmPassword = 'Confirm your new password.';
    } else if (passwords.password !== passwords.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setSavingPassword(true);
    try {
      const payload = {
        current_password: passwords.current_password,
        password: passwords.password,
      };
      await api.put('/customers/profile', payload);
      toast.success('Password changed successfully.');
      setPasswords({
        current_password: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        const fieldErrors = {};
        responseData.errors.forEach((errItem) => {
          const field = errItem.path?.[1] || errItem.field;
          if (field) fieldErrors[field] = errItem.message;
        });
        setPasswordErrors(fieldErrors);
      } else if (responseData?.message?.toLowerCase().includes('current password')) {
        setPasswordErrors({ current_password: responseData.message });
      }
      toast.error(responseData?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="public-section">
        <div className="public-container" style={{ maxWidth: 680 }}>
          <Skeleton height={32} width={220} style={{ marginBottom: 12 }} />
          <Skeleton height={18} width={360} style={{ marginBottom: 32 }} />
          <Skeleton height={400} />
        </div>
      </div>
    );
  }

  return (
    <div className="public-section profile-page">
      <div className="public-container" style={{ maxWidth: 680 }}>
        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Eyebrow text="GUEST ACCOUNT" />
          <h1
            className="font-serif"
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
              color: 'var(--text)',
              marginTop: 8,
              marginBottom: 10,
            }}
          >
            My Profile
          </h1>
          <p style={{ color: 'var(--text-body)', margin: 0, fontSize: 14 }}>
            Manage your personal guest details and account credentials.
          </p>
        </div>

        {/* Profile Card with two sections separated by GoldDivider */}
        <div className="lux-card profile-card" style={{ padding: '36px 32px' }}>
          {/* SECTION 1: Personal Information */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <User size={20} style={{ color: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>
                Personal Information
              </h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--muted)' }}>
              Keep your contact details up to date for reservation confirmations and notices.
            </p>

            <form onSubmit={handlePersonalSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FormField
                  label="Full Name"
                  htmlFor="profile-name"
                  required
                  error={personalErrors.name}
                >
                  <Input
                    id="profile-name"
                    icon={User}
                    placeholder="e.g. Eleanor Vance"
                    value={personal.name}
                    onChange={(e) => {
                      setPersonal({ ...personal, name: e.target.value });
                      if (personalErrors.name) setPersonalErrors({ ...personalErrors, name: null });
                    }}
                    error={personalErrors.name}
                  />
                </FormField>

                <FormField
                  label="Phone Number"
                  htmlFor="profile-phone"
                  error={personalErrors.phone}
                  hint="Used by hotel reception for check-in coordination."
                >
                  <Input
                    id="profile-phone"
                    icon={Phone}
                    placeholder="e.g. +94 11 234 5678"
                    value={personal.phone}
                    onChange={(e) => {
                      setPersonal({ ...personal, phone: e.target.value });
                      if (personalErrors.phone) setPersonalErrors({ ...personalErrors, phone: null });
                    }}
                    error={personalErrors.phone}
                  />
                </FormField>

                {/* Read-Only: Email */}
                <FormField
                  label="Email Address"
                  htmlFor="profile-email"
                  hint="Email address cannot be changed directly. Contact reception if an update is needed."
                >
                  <Input
                    id="profile-email"
                    icon={Mail}
                    value={personal.email}
                    disabled
                  />
                </FormField>

                {/* Read-Only: Username */}
                <FormField
                  label="Account Username"
                  htmlFor="profile-username"
                  hint="Your unique account identifier."
                >
                  <Input
                    id="profile-username"
                    icon={Shield}
                    value={personal.username}
                    disabled
                  />
                </FormField>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={savingPersonal}
                  >
                    Save Personal Details
                  </Button>
                </div>
              </div>
            </form>
          </section>

          {/* Section Divider */}
          <GoldDivider style={{ margin: '36px 0' }} />

          {/* SECTION 2: Security & Password */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Lock size={20} style={{ color: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>
                Security & Password
              </h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--muted)' }}>
              Ensure your account is protected with a strong, secure password (at least 8 characters with letters & numbers).
            </p>

            <form onSubmit={handlePasswordSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FormField
                  label="Current Password"
                  htmlFor="current-password"
                  required
                  error={passwordErrors.current_password}
                >
                  <div style={{ position: 'relative' }}>
                    <Input
                      id="current-password"
                      icon={Lock}
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={passwords.current_password}
                      onChange={(e) => {
                        setPasswords({ ...passwords, current_password: e.target.value });
                        if (passwordErrors.current_password) {
                          setPasswordErrors({ ...passwordErrors, current_password: null });
                        }
                      }}
                      error={passwordErrors.current_password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                <FormField
                  label="New Password"
                  htmlFor="new-password"
                  required
                  error={passwordErrors.password}
                  hint="Must be at least 8 characters with both letters and numbers."
                >
                  <div style={{ position: 'relative' }}>
                    <Input
                      id="new-password"
                      icon={Lock}
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={passwords.password}
                      onChange={(e) => {
                        setPasswords({ ...passwords, password: e.target.value });
                        if (passwordErrors.password) {
                          setPasswordErrors({ ...passwordErrors, password: null });
                        }
                      }}
                      error={passwordErrors.password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                <FormField
                  label="Confirm New Password"
                  htmlFor="confirm-password"
                  required
                  error={passwordErrors.confirmPassword}
                >
                  <div style={{ position: 'relative' }}>
                    <Input
                      id="confirm-password"
                      icon={Lock}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={passwords.confirmPassword}
                      onChange={(e) => {
                        setPasswords({ ...passwords, confirmPassword: e.target.value });
                        if (passwordErrors.confirmPassword) {
                          setPasswordErrors({ ...passwordErrors, confirmPassword: null });
                        }
                      }}
                      error={passwordErrors.confirmPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={savingPassword}
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
