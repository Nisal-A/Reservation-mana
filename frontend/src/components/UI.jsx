// frontend/src/components/UI.jsx
// Re-exports of the new UI components to keep existing pages working cleanly

export function PageLoader() {
  return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );
}
export { default as Button } from './ui/Button';
export { default as Input } from './ui/Input';
export { default as Select } from './ui/Select';
export { default as Textarea } from './ui/Textarea';
export { default as FormField } from './ui/FormField';
export { default as Card } from './ui/Card';
export { default as GoldDivider } from './ui/GoldDivider';
export { default as Eyebrow } from './ui/Eyebrow';
export { default as SectionTitle } from './ui/SectionTitle';
export { default as StatusText, StatusBadge } from './ui/StatusText';
export { default as Stepper } from './ui/Stepper';
export { default as Tabs } from './ui/Tabs';
export { default as Modal } from './ui/Modal';
export { default as ConfirmModal } from './ui/ConfirmModal';
export { default as Skeleton } from './ui/Skeleton';
export { default as EmptyState } from './ui/EmptyState';
export { default as ErrorState } from './ui/ErrorState';
export { default as Pagination } from './ui/Pagination';
export { default as DataTable } from './ui/DataTable';
export { default as PageHeader } from './ui/PageHeader';
export { default as StatCard } from './ui/StatCard';
export { default as DateRangePicker } from './ui/DateRangePicker';
export { default as RatingStars } from './ui/RatingStars';
