import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { Save } from 'lucide-react';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirmPassword: '' });

  useEffect(() => {
    // In a real app we might fetch full profile, but we have user.name in context
    // We could fetch customer details from reservations or a dedicated /auth/me route
    // Let's assume we just use the context name and phone is not in context but can be updated.
    // To be safe, we'll fetch customer info if we can, or just let them update.
    setForm((prev) => ({ ...prev, name: user.name || '' }));
    setLoading(false);
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone };
      if (form.password) payload.password = form.password;
      
      await api.put('/customers/profile', payload);
      toast.success('Profile updated successfully!');
      
      // Update local user context
      setUser({ ...user, name: form.name });
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader title="My Profile" subtitle="Update your personal information and password" />
      
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="section-title" style={{ marginBottom: 20 }}>Personal Information</div>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.name} onChange={set('name')} required />
          </div>
          <div className="form-group" style={{ marginBottom: 32 }}>
            <label className="form-label">Phone Number</label>
            <input className="form-input" placeholder="e.g. +1 234 567 890" value={form.phone} onChange={set('phone')} />
          </div>

          <div className="section-title" style={{ marginBottom: 20 }}>Change Password</div>
          <div className="form-group">
            <label className="form-label">New Password (leave empty to keep current)</label>
            <input className="form-input" type="password" value={form.password} onChange={set('password')} />
          </div>
          <div className="form-group" style={{ marginBottom: 32 }}>
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
