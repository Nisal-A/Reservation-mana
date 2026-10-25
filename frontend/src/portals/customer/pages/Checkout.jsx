import { CalendarCheck } from 'lucide-react';
import { EmptyState } from '../../../components/UI';

export default function Checkout() {
  return (
    <div className="public-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="public-container">
        <EmptyState
          icon={<CalendarCheck size={48} />}
          title="Booking Checkout"
          message="Coming in prompt 3.4: Guest information, special requests, and reservation confirmation."
        />
      </div>
    </div>
  );
}
