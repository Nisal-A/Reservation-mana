import { useEffect, useState } from 'react';
import { CalendarCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, PageHeader } from '../../components/UI';

export default function CreateReservation() {
  const [customers, setCustomers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [searched, setSearched] = useState(false);
  const [form, setForm] = useState({
    customer_id: '', room_id: '', check_in_date: '', check_out_date: '', remark: ''
  });
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.get('/reservations/customers/list')
      .then(({ data }) => setCustomers(data))
      .catch(() => toast.error('Failed to load customers'));
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const checkAvailability = async () => {
    if (!form.check_in_date || !form.check_out_date) {
      return toast.error('Select check-in and check-out dates first');
    }
    if (new Date(form.check_out_date) <= new Date(form.check_in_date)) {
      return toast.error('Check-out must be after check-in');
    }
    setChecking(true);
    try {
      const { data } = await api.get('/rooms/available', {
        params: { check_in: form.check_in_date, check_out: form.check_out_date }
      });
      setAvailableRooms(data);
      setSearched(true);
      if (data.length === 0) toast.error('No rooms available for selected dates');
    } catch { toast.error('Failed to check availability'); }
    finally { setChecking(false); }
  };

  const nights = () => {
    if (!form.check_in_date || !form.check_out_date) return 0;
    return Math.max(0, Math.round((new Date(form.check_out_date) - new Date(form.check_in_date)) / 86400000));
  };

  const selectedRoom = availableRooms.find((r) => r.room_id === Number(form.room_id));
  const total = selectedRoom ? nights() * selectedRoom.price : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Select a customer');
    if (!form.room_id) return toast.error('Select a room');
    setSubmitting(true);
    try {
      const { data } = await api.post('/reservations', form);
      setSuccess(data);
      setForm({ customer_id: '', room_id: '', check_in_date: '', check_out_date: '', remark: '' });
      setAvailableRooms([]); setSearched(false);
      toast.success('Reservation created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create reservation');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="page-content slide-up">
      <PageHeader title="Create Reservation" subtitle="Book a room on behalf of a customer" />

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          ✅ Reservation #{success.reservation_id} created for {success.customer_name} — Room {success.room_number}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        <form className="card" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Customer */}
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select className="form-input" value={form.customer_id} onChange={set('customer_id')} required>
              <option value="">— Select Customer —</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Check-In Date *</label>
              <input className="form-input" type="date" min={new Date().toISOString().split('T')[0]} value={form.check_in_date} onChange={set('check_in_date')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Check-Out Date *</label>
              <input className="form-input" type="date" min={form.check_in_date || new Date().toISOString().split('T')[0]} value={form.check_out_date} onChange={set('check_out_date')} required />
            </div>
          </div>

          <button type="button" className="btn btn-secondary" onClick={checkAvailability} disabled={checking}>
            <Search size={16} /> {checking ? 'Checking...' : 'Check Availability'}
          </button>

          {/* Room Selection */}
          {searched && (
            <div className="form-group">
              <label className="form-label">Available Rooms ({availableRooms.length})</label>
              <select className="form-input" value={form.room_id} onChange={set('room_id')} required>
                <option value="">— Select Room —</option>
                {availableRooms.map((r) => (
                  <option key={r.room_id} value={r.room_id}>
                    Room {r.room_number} — {r.room_type} — ${r.price}/night
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Remark */}
          <div className="form-group">
            <label className="form-label">Remarks / Special Requests</label>
            <textarea className="form-input" rows={3} placeholder="Any special requests..." value={form.remark} onChange={set('remark')} style={{ resize: 'vertical' }} />
          </div>

          <button id="btn-create-reservation" type="submit" className="btn btn-primary" disabled={submitting || !form.room_id}>
            <CalendarCheck size={16} />
            {submitting ? 'Creating...' : 'Create Reservation'}
          </button>
        </form>

        {/* Summary Panel */}
        <div>
          <div className="card">
            <div className="card-title">📋 Booking Summary</div>
            {selectedRoom ? (
              <div>
                <div className="billing-card" style={{ marginBottom: 16 }}>
                  <div className="billing-row">
                    <span className="text-muted">Room</span>
                    <span>Room {selectedRoom.room_number}</span>
                  </div>
                  <div className="billing-row">
                    <span className="text-muted">Type</span>
                    <span>{selectedRoom.room_type}</span>
                  </div>
                  <div className="billing-row">
                    <span className="text-muted">Rate</span>
                    <span>${selectedRoom.price}/night</span>
                  </div>
                  <div className="billing-row">
                    <span className="text-muted">Nights</span>
                    <span>{nights()}</span>
                  </div>
                  <div className="billing-row">
                    <span className="text-muted font-bold">Total</span>
                    <span className="billing-total">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Select dates and a room to see the summary.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
