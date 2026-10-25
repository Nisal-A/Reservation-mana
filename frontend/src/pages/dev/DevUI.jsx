import React, { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  FormField,
  Card,
  GoldDivider,
  Eyebrow,
  SectionTitle,
  StatusText,
  Stepper,
  Tabs,
  Modal,
  ConfirmModal,
  Skeleton,
  EmptyState,
  ErrorState,
  Pagination,
  DataTable,
  PageHeader,
  StatCard,
  DateRangePicker,
  RatingStars,
} from '../../components/ui';
import {
  Mail,
  User,
  BedDouble,
  DollarSign,
  Calendar,
  Sparkles,
  Inbox,
} from 'lucide-react';
import { formatLKR, formatDate, formatDateTime, nightsBetween, todayISO } from '../../utils/format';

export default function DevUI() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(2);
  const [rating, setRating] = useState(4);
  const [dateRange, setDateRange] = useState({
    startDate: todayISO(),
    endDate: '2026-11-15',
  });
  const [btnLoading, setBtnLoading] = useState(false);

  // Status values to showcase per prompt:
  // pending=warning, confirmed=success, checked_in=info, checked_out=muted, cancelled=danger, no_show=danger,
  // unpaid=warning, partial=info, paid=success, refunded=muted,
  // available=success, occupied=info, maintenance=danger
  const allStatuses = [
    { label: 'Booking: pending', key: 'pending' },
    { label: 'Booking: confirmed', key: 'confirmed' },
    { label: 'Booking: checked_in', key: 'checked_in' },
    { label: 'Booking: checked_out', key: 'checked_out' },
    { label: 'Booking: cancelled', key: 'cancelled' },
    { label: 'Booking: no_show', key: 'no_show' },
    { label: 'Payment: unpaid', key: 'unpaid' },
    { label: 'Payment: partial', key: 'partial' },
    { label: 'Payment: paid', key: 'paid' },
    { label: 'Payment: refunded', key: 'refunded' },
    { label: 'Room: available', key: 'available' },
    { label: 'Room: occupied', key: 'occupied' },
    { label: 'Room: maintenance', key: 'maintenance' },
  ];

  const tableColumns = [
    { key: 'room', header: 'Room', sortable: true },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'price', header: 'Rate/Night', sortable: true, render: (v) => formatLKR(v) },
    { key: 'status', header: 'Status', sortable: true, render: (v) => <StatusText status={v} /> },
  ];

  const tableData = [
    { id: 1, room: '101', type: 'Deluxe Suite', price: 45000, status: 'available' },
    { id: 2, room: '102', type: 'Presidential Suite', price: 120000.5, status: 'occupied' },
    { id: 3, room: '201', type: 'Ocean Villa', price: 85000, status: 'maintenance' },
    { id: 4, room: '202', type: 'Superior Room', price: 32000, status: 'confirmed' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
      <PageHeader
        eyebrow="Development Environment"
        title="UI Component Showcase"
        subtitle="Dark, quiet, luxury champagne-gold design system inspection."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setBtnLoading(true);
              setTimeout(() => setBtnLoading(false), 1500);
            }}
            loading={btnLoading}
          >
            Toggle Loading State
          </Button>
        }
      />

      {/* 1. BUTTONS */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Actions" title="Buttons" />
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <Button variant="primary">Primary Gold</Button>
            <Button variant="secondary">Secondary Outline</Button>
            <Button variant="danger">Danger Action</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="primary" icon={Sparkles}>With Icon</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <Button size="sm" variant="secondary">Small</Button>
            <Button size="md" variant="secondary">Medium</Button>
            <Button size="lg" variant="primary">Large</Button>
          </div>
        </Card>
      </section>

      {/* 2. STATUS TEXT */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Tokens" title="StatusText (Every Status Value)" />
        <Card>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16 }}>
            Plain coloured text without pills. Mapped strictly according to specification.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {allStatuses.map((s) => (
              <div
                key={s.key}
                style={{
                  padding: '12px 16px',
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{s.label}</span>
                <StatusText status={s.key} />
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* 3. FORM CONTROLS */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Inputs" title="Form Controls" />
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <FormField label="Full Name" required hint="As shown on national passport or ID">
              <Input icon={User} placeholder="e.g. John Doe" />
            </FormField>

            <FormField label="Email Address" required error="Please enter a valid email address">
              <Input icon={Mail} placeholder="john@example.com" defaultValue="invalid-email" error="Please enter a valid email address" />
            </FormField>

            <FormField label="Room Type">
              <Select
                icon={BedDouble}
                options={[
                  { value: 'deluxe', label: 'Deluxe Suite' },
                  { value: 'ocean', label: 'Ocean Villa' },
                  { value: 'presidential', label: 'Presidential Suite' },
                ]}
              />
            </FormField>

            <FormField label="Special Requests">
              <Textarea placeholder="Champagne on arrival, high floor..." rows={2} />
            </FormField>
          </div>
        </Card>
      </section>

      {/* 4. STAT CARDS */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Metrics" title="Stat Cards & Numbers" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <StatCard
            icon={DollarSign}
            label="Total Revenue"
            value={formatLKR(3542000)}
            hint="+18% from last month"
          />
          <StatCard
            icon={BedDouble}
            label="Available Rooms"
            value="14"
            hint="Out of 20 total rooms"
          />
          <StatCard
            icon={Calendar}
            label="Tonight's Bookings"
            value="6"
            hint="All guests confirmed"
          />
        </div>
      </section>

      {/* 5. TABS & STEPPER */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Navigation" title="Tabs & Stepper" />
        <Card>
          <div style={{ marginBottom: 32 }}>
            <Tabs
              tabs={[
                { id: 'overview', label: 'Overview', count: 4 },
                { id: 'reservations', label: 'Reservations', count: 12 },
                { id: 'billing', label: 'Billing' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>

          <div>
            <Eyebrow style={{ marginBottom: 16 }}>Booking Progress</Eyebrow>
            <Stepper
              steps={[
                { label: 'Select Dates', description: 'Choose stay duration' },
                { label: 'Choose Suite', description: 'Available accommodations' },
                { label: 'Guest Details', description: 'Contact & identification' },
                { label: 'Confirmation', description: 'Review & finalize' },
              ]}
              currentStep={currentStep}
              onStepClick={setCurrentStep}
            />
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <Button
                size="sm"
                variant="secondary"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              >
                Previous Step
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={currentStep === 3}
                onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
              >
                Next Step
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* 6. DATE RANGE PICKER & RATING STARS */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Utility" title="DateRangePicker & RatingStars" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <Card title="Date Range Picker">
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onChange={setDateRange}
            />
            <div style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Selected: <strong style={{ color: 'var(--text)' }}>{formatDate(dateRange.startDate)}</strong> to{' '}
              <strong style={{ color: 'var(--text)' }}>{formatDate(dateRange.endDate)}</strong>{' '}
              ({nightsBetween(dateRange.startDate, dateRange.endDate)} nights)
            </div>
          </Card>

          <Card title="Rating Stars">
            <div style={{ marginBottom: 16 }}>
              <Eyebrow style={{ marginBottom: 8 }}>Interactive Rating</Eyebrow>
              <RatingStars value={rating} onChange={setRating} size={24} />
              <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
                Rating: {rating} of 5 stars
              </div>
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 8 }}>Read Only</Eyebrow>
              <RatingStars value={4.8} readOnly size={18} />
            </div>
          </Card>
        </div>
      </section>

      {/* 7. DATA TABLE */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Tables" title="DataTable" />
        <DataTable
          columns={tableColumns}
          data={tableData}
          onRowClick={(row) => alert(`Clicked room ${row.room}`)}
        />
      </section>

      {/* 8. SKELETONS, EMPTY & ERROR STATES */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="States" title="Feedback & Loading" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <Card title="Skeleton Pulse">
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16 }}>
              Pulse animation applied against dark --input background.
            </p>
            <Skeleton height="32px" style={{ marginBottom: 12 }} />
            <Skeleton lines={3} />
          </Card>

          <Card title="Empty State">
            <EmptyState
              icon={Inbox}
              title="No Upcoming Reservations"
              message="There are currently no bookings for the chosen filter criteria."
              action={<Button size="sm" variant="secondary">Create Reservation</Button>}
            />
          </Card>

          <Card title="Error State">
            <ErrorState
              title="Failed to Load Availability"
              message="The server could not retrieve room availability at this time."
              onRetry={() => alert('Retrying fetch...')}
            />
          </Card>
        </div>
      </section>

      {/* 9. MODALS */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Overlays" title="Modals" />
        <Card>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open Standard Modal
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Open Confirm Modal
            </Button>
          </div>
        </Card>
      </section>

      {/* 10. PAGINATION */}
      <section style={{ marginBottom: 48 }}>
        <SectionTitle eyebrow="Navigation" title="Pagination" />
        <Card>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={7}
              onPageChange={setCurrentPage}
            />
          </div>
        </Card>
      </section>

      {/* 11. FORMATTING UTILITIES VERIFICATION */}
      <section>
        <SectionTitle eyebrow="Formatting" title="Format Utilities" />
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>formatLKR(12500)</span>
              <div style={{ fontSize: '1.2rem', fontFamily: 'Playfair Display, serif', color: 'var(--gold)', marginTop: 4 }}>
                {formatLKR(12500)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>formatLKR(12500.75)</span>
              <div style={{ fontSize: '1.2rem', fontFamily: 'Playfair Display, serif', color: 'var(--gold)', marginTop: 4 }}>
                {formatLKR(12500.75)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>formatDate('2026-11-10')</span>
              <div style={{ fontSize: '1rem', color: 'var(--text)', marginTop: 4 }}>
                {formatDate('2026-11-10')}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>formatDateTime('2026-11-10T14:30:00Z')</span>
              <div style={{ fontSize: '1rem', color: 'var(--text)', marginTop: 4 }}>
                {formatDateTime('2026-11-10T14:30:00Z')}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>todayISO()</span>
              <div style={{ fontSize: '1rem', color: 'var(--text)', marginTop: 4 }}>
                {todayISO()}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>GoldDivider component</span>
            <div style={{ margin: '16px 0' }}>
              <GoldDivider />
            </div>
          </div>
        </Card>
      </section>

      {/* Modal instances */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Luxury Suite Details"
        subtitle="Presidential Penthouse — Room 401"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm Booking</Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-body)', lineHeight: 1.6 }}>
          Experience the pinnacle of hospitality at LuxeStay. Each suite offers champagne service upon arrival,
          panoramic views, and dedicated concierge assistance throughout your stay.
        </p>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Cancel Reservation"
        message="Are you sure you want to cancel booking LS-2026-0042? This action cannot be undone."
        danger
        confirmText="Cancel Reservation"
        onConfirm={() => {
          alert('Cancelled');
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
