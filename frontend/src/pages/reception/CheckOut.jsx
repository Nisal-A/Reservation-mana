import { useState } from 'react';
import { Search, LogOut, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, StatusBadge } from '../../components/UI';

export default function CheckOut() {
  const [searchId, setSearchId] = useState('');
  const [reservation, setReservation] = useState(null);
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [remark, setRemark] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bill, setBill] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    setSearching(true); setReservation(null); setBill(null); setPaymentMethod('');
    try {
      const { data } = await api.get(`/reservations/${searchId}`);
      setReservation(data);
      if (data.payment_method) setPaymentMethod(data.payment_method);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reservation not found');
    } finally { setSearching(false); }
  };

  const handleCheckOut = async () => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    setProcessing(true);
    try {
      const { data } = await api.patch(`/reservations/${reservation.reservation_id}/checkout`, { remark, payment_method: paymentMethod });
      toast.success('Guest checked out successfully!');
      setBill(data.total_amount);
      setReservation({ ...reservation, status: 'checked_out', total_amount: data.total_amount, payment_method: data.payment_method });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally { setProcessing(false); }
  };

  const nights = () => {
    if (!reservation) return 0;
    return Math.round((new Date(reservation.check_out_date) - new Date(reservation.check_in_date)) / 86400000);
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div className="page-content slide-up">
      <PageHeader title="Guest Check-Out" subtitle="Search reservation by ID to process check-out and generate bill" />

      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <form className="card" onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Reservation ID</label>
            <input
              id="checkout-search"
              className="form-input" type="number"
              placeholder="Enter reservation ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              min="1" required
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={searching}>
            <Search size={16} /> {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {reservation && (
          <div className="card slide-up">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Reservation #{reservation.reservation_id}</span>
              <StatusBadge status={reservation.status} />
            </div>

            {/* Guest Info */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">👤 Guest Information</div>
              {[
                ['Name',  reservation.customer_name],
                ['Email', reservation.customer_email],
                ['Phone', reservation.customer_phone || '—'],
              ].map(([l, v]) => (
                <div className="detail-row" key={l}>
                  <span className="detail-label">{l}</span>
                  <span className="detail-value">{v}</span>
                </div>
              ))}
            </div>

            {/* Billing Summary */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">🧾 Billing Summary</div>
              <div className="billing-card">
                <div className="billing-row">
                  <span>Room</span>
                  <span>Room {reservation.room_number} ({reservation.room_type})</span>
                </div>
                <div className="billing-row">
                  <span>Check-In</span>
                  <span>{fmt(reservation.check_in_date)}</span>
                </div>
                <div className="billing-row">
                  <span>Check-Out</span>
                  <span>{fmt(reservation.check_out_date)}</span>
                </div>
                <div className="billing-row">
                  <span>Nights</span>
                  <span>{nights()}</span>
                </div>
                <div className="billing-row">
                  <span>Rate per Night</span>
                  <span>${Number(reservation.room_price).toFixed(2)}</span>
                </div>
                <div className="billing-row" style={{ paddingTop: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total Amount</span>
                  <span className="billing-total">
                    ${Number(bill ?? reservation.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {reservation.status === 'checked_out' ? (
              <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>✅ Guest has been checked out. Total billed: <strong>${Number(bill ?? reservation.total_amount).toFixed(2)}</strong></div>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={16} /> Print Receipt
                </button>
              </div>
            ) : reservation.status === 'checked_in' ? (
              <>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Payment Method *</label>
                  <select className="form-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
                    <option value="">Select Payment Method</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online Payment</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Final Remarks (optional)</label>
                  <textarea className="form-input" rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Room left in good condition" style={{ resize: 'vertical' }} />
                </div>
                <button
                  id="btn-confirm-checkout"
                  className="btn btn-primary w-full"
                  onClick={handleCheckOut}
                  disabled={processing || !paymentMethod}
                >
                  <LogOut size={16} />
                  {processing ? 'Processing...' : 'Confirm Check-Out & Generate Bill'}
                </button>
              </>
            ) : (
              <div className="alert alert-warning">
                ⚠️ Cannot check out. Current status: <strong>{reservation.status}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
