import {
  Sparkles,
  Wifi,
  Waves,
  Utensils,
  Dumbbell,
  Car,
  Coffee,
  Wine,
  Bell,
  Key,
  ShieldCheck,
  Clock,
  Tv,
} from 'lucide-react';
import { siteContent } from '../../../config/siteContent';
import { SectionTitle } from '../../../components/UI';

function getServiceIcon(keyword = '') {
  const k = keyword.toLowerCase();
  if (k.includes('wifi') || k.includes('internet')) return <Wifi size={22} />;
  if (k.includes('pool') || k.includes('swim') || k.includes('water')) return <Waves size={22} />;
  if (k.includes('din') || k.includes('food') || k.includes('restaurant') || k.includes('breakfast')) return <Utensils size={22} />;
  if (k.includes('gym') || k.includes('fit') || k.includes('train')) return <Dumbbell size={22} />;
  if (k.includes('park') || k.includes('car') || k.includes('valet')) return <Car size={22} />;
  if (k.includes('coffee') || k.includes('tea') || k.includes('cafe')) return <Coffee size={22} />;
  if (k.includes('bar') || k.includes('wine') || k.includes('cocktail') || k.includes('lounge')) return <Wine size={22} />;
  if (k.includes('service') || k.includes('bell') || k.includes('room service')) return <Bell size={22} />;
  if (k.includes('concierge') || k.includes('key')) return <Key size={22} />;
  if (k.includes('security') || k.includes('safe')) return <ShieldCheck size={22} />;
  if (k.includes('24') || k.includes('reception') || k.includes('front desk')) return <Clock size={22} />;
  if (k.includes('tv') || k.includes('entertainment')) return <Tv size={22} />;
  return <Sparkles size={22} />;
}

export default function ServicesList() {
  const services = siteContent.services || [];

  if (!services || services.length === 0) {
    return null;
  }

  return (
    <section className="public-section services-section" aria-label="Hotel Services & Amenities">
      <div className="public-container">
        <SectionTitle
          eyebrow="Amenities"
          title="Curated Services"
          subtitle="Every detail crafted for effortless refinement and quiet comfort."
        />

        <div className="services-grid">
          {services.map((item, idx) => {
            const label = typeof item === 'string' ? item : (item.label || item.name || '');
            const keyword = typeof item === 'string' ? item : (item.icon || item.label || '');
            return (
              <div key={idx} className="service-tile-card">
                <div className="service-icon-circle" aria-hidden="true">
                  {getServiceIcon(keyword)}
                </div>
                <span className="service-tile-label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
