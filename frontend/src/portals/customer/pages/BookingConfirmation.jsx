import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { EmptyState } from '../../../components/UI';

export default function BookingConfirmation() {
  const { ref } = useParams();

  return (
    <div className="public-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="public-container">
        <EmptyState
          icon={<CheckCircle2 size={48} style={{ color: 'var(--gold)' }} />}
          title={`Reservation Confirmation (${ref})`}
          message="Coming in prompt 3.4: Reservation details, printable invoice, and guest itinerary."
        />
      </div>
    </div>
  );
}
