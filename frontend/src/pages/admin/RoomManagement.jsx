// frontend/src/pages/admin/RoomManagement.jsx
// Admin Room Management page

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  BedDouble,
  X,
  Upload,
  AlertTriangle,
  MoveLeft,
  MoveRight,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { assetUrl } from '../../config/env';
import { formatLKR } from '../../utils/format';
import { getRoomFallbackPhoto } from '../../config/photos';
import {
  Button,
  StatusText,
  Modal,
  ConfirmModal,
  PageHeader,
  FormField,
  Input,
  Select,
  Textarea,
  Pagination,
  Skeleton,
  EmptyState,
  ReservationDetailPanel,
} from '../../components/UI';

const PAGE_SIZE = 10;
const DEFAULT_SUGGESTIONS = ['Single', 'Double', 'Deluxe', 'Suite', 'Ocean Villa', 'Family Suite'];

const emptyRoom = {
  room_number: '',
  room_type: 'Single',
  price: '',
  capacity: 2,
  bed_type: 'Queen Bed',
  size_sqm: 28,
  view_label: 'City View',
  description: '',
  status: 'available',
  amenities: ['Wi-Fi', 'Air Conditioning', 'En-suite Bathroom'],
  images: [],
};

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [totalRooms, setTotalRooms] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State (Add / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [form, setForm] = useState(emptyRoom);
  const [formLoading, setFormLoading] = useState(false);
  const [amenityInput, setAmenityInput] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);

  // Maintenance conflicts & Reservation Detail drawer
  const [maintenanceConflicts, setMaintenanceConflicts] = useState([]);
  const [selectedBookingRef, setSelectedBookingRef] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState(null);

  // Drag and drop state for images
  const [draggedIndex, setDraggedIndex] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch rooms with filters
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;

      const res = await api.get('/rooms', { params });
      const totalHeader = res.headers['x-total-count'];
      const dataList = Array.isArray(res.data) ? res.data : res.data.data || [];

      setRooms(dataList);
      setTotalRooms(totalHeader ? parseInt(totalHeader, 10) : dataList.length);
    } catch {
      toast.error('Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, filterType, filterStatus, minPrice, maxPrice]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Dynamic room type suggestions from loaded rooms + defaults
  const typeSuggestions = useMemo(() => {
    const set = new Set(DEFAULT_SUGGESTIONS);
    rooms.forEach((r) => {
      if (r.room_type) set.add(r.room_type);
    });
    return Array.from(set);
  }, [rooms]);

  // Open Add Modal
  const openAdd = () => {
    setEditRoom(null);
    setForm(emptyRoom);
    setAmenityInput('');
    setMaintenanceConflicts([]);
    setShowModal(true);
  };

  // Open Edit Modal
  const openEdit = (room) => {
    setEditRoom(room);
    setForm({
      room_number: room.room_number,
      room_type: room.room_type,
      price: String(room.price),
      capacity: room.capacity || 2,
      bed_type: room.bed_type || 'Queen Bed',
      size_sqm: room.size_sqm || 28,
      view_label: room.view_label || 'City View',
      description: room.description || '',
      status: room.status,
      amenities: Array.isArray(room.amenities) ? [...room.amenities] : [],
      images: Array.isArray(room.images) ? [...room.images] : [],
    });
    setAmenityInput('');
    setMaintenanceConflicts([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRoom(null);
    setMaintenanceConflicts([]);
  };

  // Handle Amenity Chip Addition
  const handleAddAmenity = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const trimmed = amenityInput.trim();
      if (!trimmed) return;
      if (form.amenities.includes(trimmed)) {
        toast.error('Amenity already added.');
        return;
      }
      setForm((prev) => ({
        ...prev,
        amenities: [...prev.amenities, trimmed],
      }));
      setAmenityInput('');
    }
  };

  const handleRemoveAmenity = (amenityToRemove) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.filter((a) => a !== amenityToRemove),
    }));
  };

  // Handle Image Upload (up to 8 images through POST /api/upload)
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 8 - form.images.length;
    if (remainingSlots <= 0) {
      toast.error('Maximum 8 images allowed per room.');
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    const formData = new FormData();
    filesToUpload.forEach((file) => {
      formData.append('images', file);
    });

    try {
      setUploadingImages(true);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newPaths = res.data?.paths || (res.data?.imageUrl ? [res.data.imageUrl] : []);
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...newPaths].slice(0, 8),
      }));
      toast.success(`${newPaths.length} photo(s) uploaded successfully.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload images.');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Image Reordering
  const handleMoveImage = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= form.images.length) return;
    setForm((prev) => {
      const copy = [...prev.images];
      const item = copy.splice(fromIdx, 1)[0];
      copy.splice(toIdx, 0, item);
      return { ...prev, images: copy };
    });
  };

  const handleDragStart = (idx) => {
    setDraggedIndex(idx);
  };

  const handleDrop = (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    handleMoveImage(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  // Handle Room Form Submit (Add / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMaintenanceConflicts([]);

    const payload = {
      room_number: form.room_number.trim(),
      room_type: form.room_type.trim(),
      price: parseFloat(form.price),
      capacity: parseInt(form.capacity, 10),
      status: form.status,
      bed_type: form.bed_type.trim(),
      size_sqm: parseInt(form.size_sqm, 10),
      view_label: form.view_label.trim(),
      description: form.description.trim() || null,
      amenities: form.amenities,
      images: form.images,
    };

    try {
      if (editRoom) {
        const res = await api.put(`/rooms/${editRoom.room_id}`, payload);
        const priceChanged = parseFloat(editRoom.price) !== parseFloat(form.price);
        if (priceChanged) {
          toast.success(
            res.data?.message ||
              'Room updated! Changing price never changes existing reservations because they store booked nightly rate.'
          );
        } else {
          toast.success('Room updated successfully.');
        }
      } else {
        await api.post('/rooms', payload);
        toast.success('Room created successfully.');
      }
      closeModal();
      fetchRooms();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.conflicting_reservations) {
        // Maintenance conflict
        setMaintenanceConflicts(err.response.data.conflicting_reservations);
        toast.error('Cannot set maintenance due to active or upcoming reservations.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to save room.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Room Delete
  const handleOpenDelete = (room) => {
    setDeleteTarget(room);
    setDeleteErrorMessage(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      setDeleteErrorMessage(null);
      await api.delete(`/rooms/${deleteTarget.room_id}`);
      toast.success(`Room ${deleteTarget.room_number} deleted successfully.`);
      setDeleteTarget(null);
      fetchRooms();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Cannot delete room with reservation history. Please set room status to maintenance instead.';
      setDeleteErrorMessage(msg);
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRooms / PAGE_SIZE));

  return (
    <div className="page-content slide-up" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <PageHeader
          title="Room Management"
          subtitle="Configure hotel rooms, nightly rates, capacity, amenities, and photo galleries"
        />
        <Button variant="primary" onClick={openAdd} style={{ gap: 8 }}>
          <Plus size={16} /> Add Room
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="card-ui" style={{ padding: 20, marginBottom: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            alignItems: 'flex-end',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              />
              <input
                type="text"
                className="input-ui"
                placeholder="Search number or type..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>
          </div>

          {/* Room Type */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Room Type
            </label>
            <Select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Types</option>
              {typeSuggestions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          {/* Status */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Status
            </label>
            <Select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </div>

          {/* Price Range: Min */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Min Rate (LKR)
            </label>
            <Input
              type="number"
              placeholder="e.g. 50"
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Price Range: Max */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Max Rate (LKR)
            </label>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Clear Filters */}
          {(search || filterType || filterStatus || minPrice || maxPrice) && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setFilterType('');
                  setFilterStatus('');
                  setMinPrice('');
                  setMaxPrice('');
                  setCurrentPage(1);
                }}
                style={{ gap: 6, color: 'var(--gold)' }}
              >
                <X size={14} /> Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="card-ui" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState
            icon={<BedDouble size={40} />}
            title="No Rooms Found"
            message="No rooms matched your query or filters. Click 'Add Room' to create one."
            action={
              <Button variant="primary" size="sm" onClick={openAdd}>
                <Plus size={14} /> Add Room
              </Button>
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table-ui">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Photo</th>
                  <th>Room #</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Nightly Rate</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => {
                  const coverImage = r.images && r.images.length > 0 ? r.images[0] : null;
                  const fallbackPhoto = getRoomFallbackPhoto(r.room_type || r.room_id || r.room_number);
                  return (
                    <tr key={r.room_id}>
                      {/* Photo Thumbnail */}
                      <td>
                        <div
                          style={{
                            width: 52,
                            height: 42,
                            borderRadius: 4,
                            overflow: 'hidden',
                            background: 'var(--input)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {coverImage ? (
                            <img
                              src={assetUrl(coverImage)}
                              alt={`Room ${r.room_number}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <img
                              src={fallbackPhoto.cardJpg || fallbackPhoto.jpg}
                              alt={fallbackPhoto.alt || `Room ${r.room_number}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              loading="lazy"
                            />
                          )}
                        </div>
                      </td>

                      {/* Room Number */}
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: 'var(--gold)' }}>
                        {r.room_number}
                      </td>

                      {/* Type & Specs */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.room_type}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {r.bed_type || 'Standard'} • {r.size_sqm ? `${r.size_sqm} m²` : ''}
                        </div>
                      </td>

                      {/* Capacity */}
                      <td style={{ color: 'var(--text-body)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={14} style={{ color: 'var(--muted)' }} />
                          <span>{r.capacity} {r.capacity === 1 ? 'Guest' : 'Guests'}</span>
                        </div>
                      </td>

                      {/* Nightly Rate */}
                      <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {formatLKR(r.price)}
                      </td>

                      {/* Status */}
                      <td>
                        <StatusText status={r.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(r)}
                            style={{ gap: 4 }}
                          >
                            <Pencil size={13} /> Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleOpenDelete(r)}
                            style={{ gap: 4 }}
                          >
                            <Trash2 size={13} /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalRooms > PAGE_SIZE && (
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
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRooms)}–
              {Math.min(currentPage * PAGE_SIZE, totalRooms)} of {totalRooms} rooms
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        )}
      </div>

      {/* ADD / EDIT ROOM MODAL */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editRoom ? `Edit Room ${editRoom.room_number}` : 'Add New Room'}
        maxWidth={720}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Maintenance Conflicts Alert */}
          {maintenanceConflicts.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(248, 113, 113, 0.12)',
                border: '1px solid rgba(248, 113, 113, 0.35)',
                borderRadius: 'var(--radius)',
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6 }}>
                <AlertTriangle size={16} />
                <span>Cannot Set Status to Maintenance: Conflicting Bookings</span>
              </div>
              <p style={{ margin: '0 0 8px', color: 'var(--text-body)' }}>
                This room has active or upcoming reservations. Click any booking reference below to view details:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {maintenanceConflicts.map((ref) => (
                  <button
                    key={ref}
                    type="button"
                    onClick={() => setSelectedBookingRef(ref)}
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: 'var(--gold)',
                      background: 'rgba(200, 169, 106, 0.12)',
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--border-strong)',
                      cursor: 'pointer',
                    }}
                  >
                    {ref}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 1: Room Number & Type */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FormField label="Room Number" required>
              <Input
                type="text"
                placeholder="e.g. 101"
                value={form.room_number}
                onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Room Type" required helperText="Choose a suggestion or enter custom type">
              <div>
                <input
                  list="room-types-list"
                  type="text"
                  className="input-ui"
                  placeholder="e.g. Deluxe Suite"
                  value={form.room_type}
                  onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
                <datalist id="room-types-list">
                  {typeSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </FormField>
          </div>

          {/* Row 2: Nightly Rate & Capacity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FormField
              label="Nightly Rate (LKR)"
              required
              helperText={editRoom ? 'Existing reservations keep their originally booked rate' : ''}
            >
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g. 180"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Max Capacity (Guests)" required>
              <Input
                type="number"
                min="1"
                max="10"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                required
              />
            </FormField>
          </div>

          {/* Row 3: Bed Type, Size, View */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <FormField label="Bed Type">
              <Input
                type="text"
                placeholder="e.g. King Bed, 2 Twin"
                value={form.bed_type}
                onChange={(e) => setForm({ ...form, bed_type: e.target.value })}
              />
            </FormField>

            <FormField label="Size (m²)">
              <Input
                type="number"
                min="5"
                placeholder="e.g. 35"
                value={form.size_sqm}
                onChange={(e) => setForm({ ...form, size_sqm: e.target.value })}
              />
            </FormField>

            <FormField label="View">
              <Input
                type="text"
                placeholder="e.g. Ocean View"
                value={form.view_label}
                onChange={(e) => setForm({ ...form, view_label: e.target.value })}
              />
            </FormField>
          </div>

          {/* Row 4: Status */}
          <FormField
            label="Room Operational Status"
            required
            helperText="Status can be Available or Maintenance. 'Occupied' is set automatically at check-in."
          >
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              disabled={form.status === 'occupied'}
            >
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
              <option value="occupied" disabled>
                Occupied (Set automatically at check-in)
              </option>
            </Select>
            {form.status === 'occupied' && (
              <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                This room is currently occupied by a guest. Room status transitions automatically on check-out.
              </div>
            )}
          </FormField>

          {/* Row 5: Description */}
          <FormField label="Description">
            <Textarea
              rows={3}
              placeholder="Describe room amenities, balcony, decor, and unique features..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>

          {/* Row 6: Amenities as Removable Chips */}
          <FormField label="Amenities" helperText="Type an amenity and press Enter to add chip">
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Input
                  type="text"
                  placeholder="e.g. Free Wi-Fi, Balcony, Minibar..."
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={handleAddAmenity}
                />
                <Button type="button" variant="secondary" onClick={handleAddAmenity}>
                  Add
                </Button>
              </div>

              {/* Amenity Chips Display */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {form.amenities.map((a) => (
                  <span
                    key={a}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(200, 169, 106, 0.1)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: 12,
                    }}
                  >
                    <span>{a}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAmenity(a)}
                      style={{ color: 'var(--muted)', display: 'inline-flex', padding: 0 }}
                      title="Remove amenity"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </FormField>

          {/* Row 7: Images (up to 8, drag to reorder, cover badge) */}
          <FormField
            label={`Room Photos (${form.images.length}/8)`}
            helperText="Upload up to 8 photos. Drag to reorder. The first photo is the primary cover image."
          >
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />

              {form.images.length < 8 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={uploadingImages}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ gap: 6, marginBottom: 14 }}
                >
                  <Upload size={14} /> Upload Photos
                </Button>
              )}

              {/* Previews Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 12,
                }}
              >
                {form.images.map((imgUrl, idx) => (
                  <div
                    key={imgUrl}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    style={{
                      position: 'relative',
                      height: 96,
                      borderRadius: 4,
                      overflow: 'hidden',
                      border: idx === 0 ? '2px solid var(--gold)' : '1px solid var(--border)',
                      background: 'var(--input)',
                      cursor: 'grab',
                    }}
                  >
                    <img
                      src={assetUrl(imgUrl)}
                      alt={`Upload ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {/* Cover Badge */}
                    {idx === 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          background: 'var(--gold)',
                          color: '#0B0B0B',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 2,
                          textTransform: 'uppercase',
                        }}
                      >
                        Cover
                      </span>
                    )}

                    {/* Controls Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: 4,
                        background: 'rgba(0, 0, 0, 0.75)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveImage(idx, idx - 1)}
                          style={{
                            color: idx === 0 ? 'var(--muted)' : 'var(--text)',
                            padding: 2,
                          }}
                          title="Move left"
                        >
                          <MoveLeft size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === form.images.length - 1}
                          onClick={() => handleMoveImage(idx, idx + 1)}
                          style={{
                            color: idx === form.images.length - 1 ? 'var(--muted)' : 'var(--text)',
                            padding: 2,
                          }}
                          title="Move right"
                        >
                          <MoveRight size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        style={{ color: 'var(--danger)', padding: 2 }}
                        title="Remove image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FormField>

          {/* Modal Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              borderTop: '1px solid var(--border)',
              paddingTop: 16,
              marginTop: 8,
            }}
          >
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading}>
              {editRoom ? 'Save Changes' : 'Create Room'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErrorMessage(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete Room ${deleteTarget?.room_number || ''}?`}
        message={
          deleteErrorMessage ||
          `Are you sure you want to delete Room ${deleteTarget?.room_number}? This action cannot be undone.`
        }
        confirmText="Delete Room"
        confirmVariant="danger"
        loading={deleteLoading}
      />

      {/* RESERVATION DETAIL PANEL (When clicking conflict link) */}
      <ReservationDetailPanel
        bookingRef={selectedBookingRef}
        isOpen={Boolean(selectedBookingRef)}
        onClose={() => setSelectedBookingRef(null)}
      />
    </div>
  );
}
