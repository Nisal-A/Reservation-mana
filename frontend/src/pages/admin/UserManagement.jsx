import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, StatusBadge, EmptyState, PageHeader, ConfirmModal } from '../../components/UI';

const ROLES = ['admin', 'reception', 'customer'];

const emptyForm = { username: '', password: '', role: 'reception' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch { toast.error('Failed to load users'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => { setEditUser(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (user) => {
    setEditUser(user);
    setForm({ username: user.username, password: '', role: user.role });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditUser(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editUser) {
        // If password is empty, we don't send it to backend so it won't be updated
        const payload = { username: form.username, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editUser.user_id}`, payload);
        toast.success('User updated!');
      } else {
        await api.post('/users', form);
        toast.success('User added!');
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteConfirm.user_id}`);
      toast.success('User deleted');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setDeleteConfirm(null);
    }
  };

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="User Management"
        subtitle={`${users.length} users total`}
        action={
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add User
          </button>
        }
      />

      <div className="filters-row">
        <div className="search-bar">
          <Search size={16} />
          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <EmptyState icon="👤" title="No users found" message="Add a user or adjust your filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.user_id}>
                    <td style={{ color: 'var(--color-text-muted)' }}>#{user.user_id}</td>
                    <td><strong>{user.username}</strong></td>
                    <td><StatusBadge status={user.role} /></td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" onClick={() => openEdit(user)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn" onClick={() => setDeleteConfirm(user)} title="Delete"
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
              <div className="modal-title">{editUser ? 'Edit User' : 'Add New User'}</div>
              <button className="icon-btn" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid form-grid-1" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className="form-input" placeholder="Enter username" value={form.username} onChange={set('username')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password {editUser ? '(Leave empty to keep current)' : '*'}</label>
                  <input className="form-input" type="password" placeholder="Enter password" value={form.password} onChange={set('password')} required={!editUser} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-input" value={form.role} onChange={set('role')} required>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editUser ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete User"
        message={`Are you sure you want to delete user ${deleteConfirm?.username}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        danger
      />
    </div>
  );
}
