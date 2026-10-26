import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  History,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatLKR } from '../../utils/format';
import {
  Button,
  StatusText,
  Pagination,
  Modal,
  ConfirmModal,
  FormField,
  Input,
  Skeleton,
  Eyebrow,
  EmptyState,
  ReservationDetailPanel,
} from '../../components/UI';

const PAGE_SIZE = 20;

const emptyCustomer = { name: '', email: '', phone: '' };

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // Delete modal state (Admin only)
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // History panel state
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected reservation to view in drawer from history
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);

  // Debounce search input by 400ms
  const searchTimerRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val.trim());
      setPage(1);
    }, 400);
  };

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers', {
        params: {
          search: debouncedSearch || undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setCustomers(data);

      const countHeader = res.headers['x-total-count'];
      if (countHeader) {
        setTotalCount(parseInt(countHeader, 10));
      } else {
        setTotalCount(data.length);
      }
    } catch {
      toast.error('Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setForm(emptyCustomer);
    setFormErrors({});
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  // Open History Drawer
  const handleOpenHistory = async (c) => {
    setHistoryCustomer(c);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/customers/${c.customer_id}/history`);
      setHistoryList(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load reservation history.');
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Save Customer (Add or Edit)
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errors = {};
    if (!form.name.trim()) errors.name = 'Customer name is required.';
    if (!form.email.trim() || !form.email.includes('@')) errors.email = 'Valid email is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      };

      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.customer_id}`, payload);
        toast.success('Customer updated successfully.');
      } else {
        await api.post('/customers', payload);
        toast.success('Customer added successfully.');
      }
      setShowFormModal(false);
      await fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed.';
      toast.error(msg);
      if (err.response?.data?.errors) {
        const fErrors = {};
        err.response.data.errors.forEach((er) => {
          if (er.field) fErrors[er.field] = er.message;
        });
        setFormErrors(fErrors);
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Delete Customer (Admin only)
  const handleDeleteCustomer = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/customers/${deleteConfirm.customer_id}`);
      toast.success('Customer deleted successfully.');
      setDeleteConfirm(null);
      await fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete customer.');
      setDeleteConfirm(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="page-content slide-up" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Eyebrow text="GUEST DIRECTORY" />
          <h1 className="page-title" style={{ marginTop: 4, marginBottom: 6 }}>
            Customers
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {totalCount} registered customer{totalCount === 1 ? '' : 's'}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAdd}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={15} />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* Search Toolbar */}
      <div className="card-ui" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 440 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: 10,
              color: 'var(--muted)',
              pointerEvents: 'none',
            }}
          >
            <Search size={16} />
          </span>
          <input
            type="text"
            className="input-ui"
            placeholder="Search by name, email, or telephone number..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="card-ui" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skeleton height={32} />
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              icon={<Users size={40} />}
              title="No Customers Found"
              message={
                debouncedSearch
                  ? `No customers matched "${debouncedSearch}".`
                  : 'No customer records found.'
              }
              action={
                debouncedSearch ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setDebouncedSearch('');
                    }}
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={handleOpenAdd}>
                    Add First Customer
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table-ui">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Reservations</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const hasReservations = Number(c.total_reservations || 0) > 0;

                  return (
                    <tr key={c.customer_id}>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>#{c.customer_id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                        {c.username && (
                          <div style={{ fontSize: 11, color: 'var(--gold)' }}>
                            @{c.username}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text)' }}>{c.email}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-body)' }}>{c.phone || '—'}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius)',
                            background: hasReservations ? 'rgba(200, 169, 106, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            color: hasReservations ? 'var(--gold)' : 'var(--muted)',
                          }}
                        >
                          {c.total_reservations || 0} stay{c.total_reservations === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {formatDate(c.created_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {/* History Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Reservation History"
                            onClick={() => handleOpenHistory(c)}
                            style={{ padding: '6px 8px' }}
                          >
                            <History size={15} style={{ color: 'var(--gold)' }} />
                          </Button>

                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Customer"
                            onClick={() => handleOpenEdit(c)}
                            style={{ padding: '6px 8px' }}
                          >
                            <Pencil size={15} />
                          </Button>

                          {/* Delete Button (ADMINS ONLY; disabled if customer has reservations) */}
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={hasReservations}
                              title={
                                hasReservations
                                  ? 'Cannot delete customer with reservation history.'
                                  : 'Delete Customer'
                              }
                              onClick={() => setDeleteConfirm(c)}
                              className="btn-ui btn-ui-ghost btn-ui-sm"
                              style={{
                                padding: '6px 8px',
                                color: hasReservations ? 'var(--muted)' : 'var(--danger)',
                                cursor: hasReservations ? 'not-allowed' : 'pointer',
                                opacity: hasReservations ? 0.4 : 1,
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination */}
        {!loading && totalPages > 1 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–
              {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      <Modal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        maxWidth="460px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" onClick={() => setShowFormModal(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveCustomer} loading={formLoading}>
              {editingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Full Name" required error={formErrors.name}>
              <Input
                placeholder="e.g. Eleanor Vance"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={formErrors.name}
              />
            </FormField>

            <FormField label="Email Address" required error={formErrors.email}>
              <Input
                type="email"
                placeholder="e.g. eleanor.vance@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={formErrors.email}
              />
            </FormField>

            <FormField label="Phone Number" error={formErrors.phone} hint="e.g. +94 11 234 5678">
              <Input
                placeholder="+94 11 234 5678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                error={formErrors.phone}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE MODAL (Admin Only) */}
      {isAdmin && (
        <ConfirmModal
          open={Boolean(deleteConfirm)}
          title="Delete Customer"
          message={`Are you sure you want to permanently delete customer "${deleteConfirm?.name}" (${deleteConfirm?.email})?`}
          confirmText="Yes, Delete Customer"
          cancelText="Cancel"
          danger
          loading={deleteLoading}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteCustomer}
        />
      )}

      {/* CUSTOMER RESERVATION HISTORY PANEL / DRAWER */}
      {historyCustomer && (
        <>
          <div
            className="reservation-drawer-backdrop"
            onClick={() => setHistoryCustomer(null)}
            aria-hidden="true"
          />
          <aside
            className="reservation-drawer-panel"
            role="dialog"
            aria-label="Customer Reservation History"
          >
            <div className="reservation-drawer-header">
              <div>
                <Eyebrow text="GUEST PROFILE & HISTORY" />
                <h3 className="font-serif" style={{ fontSize: 18, color: 'var(--text)', margin: '4px 0 2px' }}>
                  {historyCustomer.name}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {historyCustomer.email} {historyCustomer.phone ? `· ${historyCustomer.phone}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="mobile-sidebar-close-btn"
                onClick={() => setHistoryCustomer(null)}
                aria-label="Close history panel"
              >
                <X size={20} />
              </button>
            </div>

            <div className="reservation-drawer-body">
              <div style={{ marginBottom: 16 }}>
                <span className="reservation-label">
                  Reservation History ({historyList.length})
                </span>
              </div>

              {loadingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Skeleton height={80} />
                  <Skeleton height={80} />
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
                    This customer does not have any recorded reservations.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historyList.map((resItem) => (
                    <div
                      key={resItem.reservation_id}
                      onClick={() => setSelectedBookingRef(resItem.booking_ref)}
                      style={{
                        padding: 14,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)' }}>
                          {resItem.booking_ref}
                        </span>
                        <StatusText status={resItem.status} />
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                        Room {resItem.room_number} ({resItem.room_type})
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {formatDate(resItem.check_in_date)} to {formatDate(resItem.check_out_date)}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: '1px solid var(--border)',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: 'var(--muted)' }}>
                          Payment: <StatusText status={resItem.payment_status} />
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {formatLKR(resItem.total_amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Nested ReservationDetailPanel when a reservation is clicked in history */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
        onActionComplete={() => {
          if (historyCustomer) handleOpenHistory(historyCustomer);
          fetchCustomers();
        }}
      />
    </div>
  );
}
