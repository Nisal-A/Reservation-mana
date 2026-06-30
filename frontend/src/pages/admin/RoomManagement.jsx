import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, BedDouble } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageLoader, StatusBadge, EmptyState, PageHeader, ConfirmModal } from '../../components/UI';

const ROOM_TYPES = ['Single', 'Double', 'Suite', 'Deluxe'];
const STATUSES = ['available', 'occupied', 'maintenance'];

const emptyForm = { room_number: '', room_type: 'Single', price: '', status: 'available', description: '' };

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchRooms = async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType)   params.type   = filterType;
      const { data } = await api.get('/rooms', { params });
      setRooms(data);
    } catch { toast.error('Failed to load rooms'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchRooms(); }, [filterStatus, filterType]);

  const openAdd = () => { setEditRoom(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (room) => {
    setEditRoom(room);
    setForm({ room_number: room.room_number, room_type: room.room_type, price: room.price, status: room.status, description: room.description || '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditRoom(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      let imageUrl = form.image_url;
      if (form.imageFile) {
        const formData = new FormData();
        formData.append('image', form.imageFile);
        const { data: uploadData } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrl = uploadData.imageUrl;
      }
      
      const payload = { ...form, image_url: imageUrl };
      delete payload.imageFile;

      if (editRoom) {
        await api.put(`/rooms/${editRoom.room_id}`, payload);
        toast.success('Room updated!');
      } else {
        await api.post('/rooms', payload);
        toast.success('Room added!');
      }
      closeModal();
      fetchRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/rooms/${deleteConfirm.room_id}`);
      toast.success('Room deleted');
      setDeleteConfirm(null);
      fetchRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setDeleteConfirm(null);
    }
  };

  const filtered = rooms.filter((r) =>
    r.room_number.toLowerCase().includes(search.toLowerCase()) ||
    r.room_type.toLowerCase().includes(search.toLowerCase())
  );

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Room Management"
        subtitle={`${rooms.length} rooms total`}
        action={
          <button id="btn-add-room" className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Room
          </button>
        }
      />

      {/* Filters */}
      <div className="filters-row">
        <div className="search-bar">
          <Search size={16} />
          <input
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input" style={{ width: 160 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input" style={{ width: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Rooms Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <EmptyState icon="🛏️" title="No rooms found" message="Add a room or adjust your filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Room #</th>
                  <th>Type</th>
                  <th>Price/Night</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((room) => (
                  <tr key={room.room_id}>
                    <td><strong>{room.room_number}</strong></td>
                    <td>{room.room_type}</td>
                    <td style={{ color: 'var(--color-gold)', fontWeight: 700 }}>${Number(room.price).toFixed(2)}</td>
                    <td><StatusBadge status={room.status} /></td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                      {room.description || '—'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" onClick={() => openEdit(room)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn" onClick={() => setDeleteConfirm(room)} title="Delete"
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editRoom ? 'Edit Room' : 'Add New Room'}</div>
              <button className="icon-btn" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input className="form-input" placeholder="e.g. 101" value={form.room_number} onChange={set('room_number')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Type *</label>
                  <select className="form-input" value={form.room_type} onChange={set('room_type')} required>
                    {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Price per Night ($) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="120.00" value={form.price} onChange={set('price')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={set('status')}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Room Image</label>
                <input className="form-input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, imageFile: e.target.files[0] })} />
                {form.image_url && !form.imageFile && <div style={{marginTop: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>Current image: {form.image_url}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} placeholder="Room description..." value={form.description} onChange={set('description')} style={{ resize: 'vertical' }} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button id="btn-save-room" type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Room"
        message={`Are you sure you want to delete Room ${deleteConfirm?.room_number}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        danger
      />
    </div>
  );
}
