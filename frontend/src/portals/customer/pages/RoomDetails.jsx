import { useParams, Link } from 'react-router-dom';
import { BedDouble, ArrowLeft } from 'lucide-react';
import { EmptyState } from '../../../components/UI';

export default function RoomDetails() {
  const { id } = useParams();

  return (
    <div className="public-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="public-container">
        <div style={{ marginBottom: 20 }}>
          <Link to="/rooms" className="btn-ui btn-ui-ghost btn-ui-sm">
            <ArrowLeft size={16} />
            <span>Back to Rooms</span>
          </Link>
        </div>
        <EmptyState
          icon={<BedDouble size={48} />}
          title={`Room Details (#${id})`}
          message="Coming in prompt 3.3: Comprehensive room photo gallery, virtual tour, amenities, and instant quote calculation."
        />
      </div>
    </div>
  );
}
