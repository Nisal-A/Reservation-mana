import { useParams, Link } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';
import { EmptyState } from '../../../components/UI';

export default function BookingDetails() {
  const { ref } = useParams();

  return (
    <div className="public-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="public-container">
        <div style={{ marginBottom: 20 }}>
          <Link to="/account/bookings" className="btn-ui btn-ui-ghost btn-ui-sm">
            <ArrowLeft size={16} />
            <span>Back to My Bookings</span>
          </Link>
        </div>
        <EmptyState
          icon={<Calendar size={48} />}
          title={`Booking Details (${ref})`}
          message="Coming in prompt 3.4: Complete booking summary, payment history, and cancellation options."
        />
      </div>
    </div>
  );
}
