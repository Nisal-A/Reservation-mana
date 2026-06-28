import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader } from '../../components/UI';

export default function BookRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    check_in_date: '', check_out_date: '', room_id: searchParams.get('room') || '', remark: ''
  });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [success, setSuccess] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const checkAvailability = async () => {
    if (!form.check_in_date || !form.check_out_date) return toast.error('Please select both dates');
    if (new Date(form.check_out_date) <= new Date(form.check_in_date)) return toast.error('Check-out must be after check-in');
    setChecking(true);
    try {
      const { data } = await api.get('/rooms/available', {
        params: { check_in: form.check_in_date, check_out: form.check_out_date }
      });
      setAvailableRooms(data);
      setSearched(true);
      if (data.length === 0) toast.error('No rooms available for selected dates');
      else toast.success(`${data.length} room${data.length > 1 ? 's' : ''} available!`);
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
    if (!form.room_id) return toast.error('Please select a room');
    setSubmitting(true);
    try {
      const { data } = await api.post('/reservations', {
        room_id: form.room_id,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        remark: form.remark,
      });
      setSuccess(data);
      toast.success('🎉 Room booked successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="page-content slide-up">
        <div style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 12 }}>Booking Confirmed!</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 30 }}>
            Your reservation for Room {success.room_number} has been confirmed.
          </p>
          <div className="billing-card" style={{ marginBottom: 24, textAlign: 'left' }}>
            {[
              ['Reservation #', success.reservation_id],
              ['Room',          `${success.room_number} (${success.room_type})`],
              ['Check-In',      new Date(success.check_in_date).toLocaleDateString()],
              ['Check-Out',     new Date(success.check_out_date).toLocaleDateString()],
              ['Total',         `$${Number(success.total_amount).toFixed(2)}`],
              ['Status',        success.status],
            ].map(([l, v]) => (
              <div className="billing-row" key={l}>
                <span style={{ color: 'var(--color-text-muted)' }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => { setSuccess(null); setForm({ check_in_date:'', check_out_date:'', room_id:'', remark:'' }); setSearched(false); }}>
              Book Another
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/customer/bookings')}>
              My Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content slide-up">
      <PageHeader title="Book a Room" subtitle="Select your dates and preferred room" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <form className="card" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Date Selection */}
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Check-In Date *</label>
              <input
                className="form-input" type="date"
                min={new Date().toISOString().split('T')[0]}
                value={form.check_in_date} onChange={set('check_in_date')} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Check-Out Date *</label>
              <input
                className="form-input" type="date"
                min={form.check_in_date || new Date().toISOString().split('T')[0]}
                value={form.check_out_date} onChange={set('check_out_date')} required
              />
            </div>
          </div>

          <button type="button" className="btn btn-secondary" onClick={checkAvailability} disabled={checking}>
            <Search size={16} /> {checking ? 'Checking...' : 'Check Availability'}
          </button>

          {searched && availableRooms.length > 0 && (
            <div className="form-group">
              <label className="form-label">Select Room *</label>
              <div style={{ display: 'grid', gap: 10 }}>
                {availableRooms.map((r) => (
                  <label
                    key={r.room_id}
                    style={{
                      display: 'flex', gap: 14, alignItems: 'center',
                      padding: '14px 16px', borderRadius: 10,
                      border: `2px solid ${Number(form.room_id) === r.room_id ? 'var(--color-gold)' : 'var(--color-border)'}`,
                      background: Number(form.room_id) === r.room_id ? 'var(--color-gold-glow)' : 'var(--color-surface-2)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <input type="radio" name="room" value={r.room_id} checked={Number(form.room_id) === r.room_id}
                      onChange={set('room_id')} style={{ display:'none' }} />
                    <div style={{ fontSize: '1.6rem' }}>
                      {r.room_type === 'Suite' ? '🏩' : r.room_type === 'Deluxe' ? '🌟' : '🛏️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>Room {r.room_number} — {r.room_type}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.description}</div>
                    </div>
                    <div style={{ color: 'var(--color-gold)', fontWeight: 800, fontSize: '1.1rem' }}>
                      ${r.price}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>/night</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Special Requests</label>
            <textarea className="form-input" rows={3} placeholder="Any special requests or notes..." value={form.remark} onChange={set('remark')} style={{ resize: 'vertical' }} />
          </div>

          <button id="btn-confirm-booking" type="submit" className="btn btn-primary btn-lg" disabled={submitting || !form.room_id}>
            <CalendarCheck size={18} />
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>

        {/* Booking Summary Panel */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 80 }}>
            <div className="card-title">📋 Booking Summary</div>
            {selectedRoom ? (
              <div className="billing-card">
                <div className="billing-row">
                  <span style={{ color:'var(--color-text-muted)' }}>Room</span>
                  <span style={{ fontWeight:600 }}>Room {selectedRoom.room_number}</span>
                </div>
                <div className="billing-row">
                  <span style={{ color:'var(--color-text-muted)' }}>Type</span>
                  <span>{selectedRoom.room_type}</span>
                </div>
                <div className="billing-row">
                  <span style={{ color:'var(--color-text-muted)' }}>Rate</span>
                  <span>${selectedRoom.price}/night</span>
                </div>
                <div className="billing-row">
                  <span style={{ color:'var(--color-text-muted)' }}>Nights</span>
                  <span>{nights()}</span>
                </div>
                <div className="billing-row">
                  <span style={{ fontWeight:700 }}>Total</span>
                  <span className="billing-total">${total.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p style={{ color:'var(--color-text-muted)', fontSize:'0.85rem' }}>
                Check availability and select a room to see pricing.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
