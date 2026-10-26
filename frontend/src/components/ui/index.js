// frontend/src/components/ui/index.js
// Central re-export point for all LuxeStay UI components

export { Button } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Textarea } from './Textarea';
export { FormField } from './FormField';
export { Card } from './Card';
export { GoldDivider } from './GoldDivider';
export { Eyebrow } from './Eyebrow';
export { SectionTitle } from './SectionTitle';
export { StatusText, StatusBadge } from './StatusText';
export { Stepper } from './Stepper';
export { Tabs } from './Tabs';
export { Modal } from './Modal';
export { ConfirmModal } from './ConfirmModal';
export { Skeleton } from './Skeleton';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { Pagination } from './Pagination';
export { DataTable } from './DataTable';
export { PageHeader } from './PageHeader';
export { StatCard } from './StatCard';
export { DateRangePicker } from './DateRangePicker';
export { RatingStars } from './RatingStars';
export { ExportMenu } from './ExportMenu';

// Loading spinner / helper
export function PageLoader() {
  return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );
}
