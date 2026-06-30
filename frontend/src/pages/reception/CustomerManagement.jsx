import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, EmptyState, PageHeader, ConfirmModal } from '../../components/UI';

const emptyForm = { name: '', email: '', phone: '' };

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get('/customers', { params: { search } });
      setCustomers(data);
    } catch { toast.error('Failed to load customers'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, [search]);

  const openAdd = () => { setEditCustomer(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (customer) => {
    setEditCustomer(customer);
    setForm({ name: customer.name, email: customer.email, phone: customer.phone || '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditCustomer(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editCustomer) {
        await api.put(`/customers/${editCustomer.customer_id}`, form);
        toast.success('Customer updated!');
      } else {
        await api.post('/customers', form);
        toast.success('Customer added!');
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/customers/${deleteConfirm.customer_id}`);
      toast.success('Customer deleted');
      setDeleteConfirm(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setDeleteConfirm(null);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Customer Management"
        subtitle={`${customers.length} customers total`}
        action={
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      <div className="filters-row">
        <form className="search-bar" style={{ flex: 1, maxWidth: 400 }} onSubmit={(e) => { e.preventDefault(); fetchCustomers(); }}>
          <Search size={16} />
          <input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {customers.length === 0 ? (
          <EmptyState icon="👥" title="No customers found" message="Add a customer or adjust your search." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Registered Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.customer_id}>
                    <td style={{ color: 'var(--color-text-muted)' }}>#{c.customer_id}</td>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.email}</td>
                    <td>{c.phone || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" onClick={() => openEdit(c)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn" onClick={() => setDeleteConfirm(c)} title="Delete"
                          style={{ color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editCustomer ? 'Edit Customer' : 'Add New Customer'}</div>
              <button className="icon-btn" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid form-grid-1" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" placeholder="Full name" value={form.name} onChange={set('name')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="Email address" value={form.email} onChange={set('email')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="Phone number" value={form.phone} onChange={set('phone')} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Customer"
        message={`Are you sure you want to delete customer ${deleteConfirm?.name}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        danger
      />
    </div>
  );
}
