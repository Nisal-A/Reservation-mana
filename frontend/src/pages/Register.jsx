import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="login-page">
      <div className="login-box" style={{ maxWidth: 480 }}>
        <div className="login-logo">
          <div className="login-logo-icon">🏨</div>
          <h1>Create Account</h1>
          <p>Register as a customer to book rooms</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" placeholder="John Doe" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" placeholder="+1 234 567 8900" value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input className="form-input" type="email" placeholder="john@example.com" value={form.email} onChange={set('email')} required />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" placeholder="johndoe" value={form.username} onChange={set('username')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
          </div>

          <button id="btn-register" type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="login-footer" style={{ marginTop: 20 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
