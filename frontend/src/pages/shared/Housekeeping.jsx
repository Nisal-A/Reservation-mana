/**
 * Housekeeping.jsx — Housekeeping Management Dashboard
 * Room grid with status, assign tasks, progress tracking, status transitions.
 * Shared by admin and reception.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState, StatCard, StatusBadge } from '../../components/UI';

const HK_STATUSES = ['available','occupied','dirty','cleaning','ready','maintenance'];
const STATUS_FLOW  = { dirty: 'cleaning', cleaning: 'ready', ready: 'available', maintenance: 'available' };
const STATUS_ICONS = { available:'✅', occupied:'🔴', dirty:'🧹', cleaning:'🫧', ready:'🟢', maintenance:'⚙️', reserved:'📅' };

export default function Housekeeping() {
  const [rooms,   setRooms]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null); // for task modal
  const [taskNote, setTaskNote]         = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks]   = useState([]);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const [roomRes, sumRes] = await Promise.all([
        api.get('/housekeeping/rooms', { params }),
        api.get('/housekeeping/summary'),
      ]);
      setRooms(roomRes.data);
      setSummary(sumRes.data);
    } catch { toast.error('Failed to load housekeeping data'); }
    finally  { setLoading(false); }
  }, [filterStatus]);

  const fetchTasks = useCallback(async () => {
    const { data } = await api.get('/housekeeping/tasks');
    setTasks(data);
  }, []);

  useEffect(() => { fetchRooms(); fetchTasks(); }, [fetchRooms, fetchTasks]);

  // Advance room status by one step
  const advanceStatus = async (room) => {
    const next = STATUS_FLOW[room.status];
    if (!next) { toast.error('No next status for this room'); return; }
    try {
      await api.patch(`/housekeeping/rooms/${room.room_id}/status`, { status: next });
      toast.success(`Room ${room.room_number}: ${room.status} → ${next}`);
      fetchRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const openTaskModal = (room) => {
    setSelectedRoom(room);
    setTaskNote('');
    setTaskPriority('normal');
  };

  const createTask = async () => {
    setSaving(true);
    try {
      await api.post('/housekeeping/tasks', {
        room_id: selectedRoom.room_id,
        priority: taskPriority,
        notes:    taskNote || null,
      });
      toast.success(`Task created for Room ${selectedRoom.room_number}`);
      setSelectedRoom(null);
      fetchRooms(); fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const updateTask = async (taskId, status) => {
    try {
      await api.put(`/housekeeping/tasks/${taskId}`, { status });
      toast.success('Task updated');
      fetchRooms(); fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <PageLoader />;

  const summaryCards = summary?.room_status_counts?.map(s => ({
    icon: STATUS_ICONS[s.status] || '🏨',
    label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    color: s.status === 'available' ? 'var(--color-success)' : s.status === 'occupied' ? 'var(--color-error)' : s.status === 'dirty' ? '#f97316' : s.status === 'cleaning' ? 'var(--color-info)' : 'var(--color-text-muted)',
    bg: s.status === 'available' ? 'var(--color-success-bg)' : s.status === 'occupied' ? 'var(--color-error-bg)' : 'var(--color-surface-2)',
  })) || [];

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Housekeeping"
        subtitle="Manage room cleaning tasks and status transitions"
        action={
          <button className="btn btn-secondary btn-sm" onClick={fetchRooms}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {summaryCards.map(s => <StatCard key={s.label} {...s} />)}
        <StatCard
          icon="📋"
          label="Pending Tasks"
          value={summary?.pending_tasks || 0}
          color="var(--color-warning)"
          bg="var(--color-warning-bg)"
        />
      </div>

      {/* Filter */}
      <div className="filters-row">
        <select className="form-input" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {HK_STATUSES.map(s => <option key={s} value={s}>{STATUS_ICONS[s]} {s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      {/* Room Grid */}
      {rooms.length === 0 ? (
        <EmptyState icon="🛏️" title="No rooms found" message="Add rooms or clear the filter." />
      ) : (
        <div className="hk-rooms-grid">
          {rooms.map(room => (
            <div
              key={room.room_id}
              className={`hk-room-card hk-${room.status}`}
              onClick={() => openTaskModal(room)}
            >
              <div className="hk-room-number">{room.room_number}</div>
              <div className="hk-room-type">{room.room_type}</div>
              <span className={`badge badge-${room.status}`} style={{ display: 'inline-flex' }}>
                {STATUS_ICONS[room.status]} {room.status}
              </span>
              {room.assigned_username && (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                  👤 {room.assigned_username}
                </div>
              )}
              {STATUS_FLOW[room.status] && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={e => { e.stopPropagation(); advanceStatus(room); }}
                >
                  → {STATUS_FLOW[room.status]}
                </button>
              )}
              <div className={`hk-status-bar`} />
            </div>
          ))}
        </div>
      )}

      {/* Active Tasks */}
      {tasks.filter(t => t.status !== 'completed').length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="section-title">📋 Active Tasks</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Room</th><th>Type</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {tasks.filter(t => t.status !== 'completed').map(t => (
                    <tr key={t.task_id}>
                      <td><strong>#{t.room_number}</strong></td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{t.room_type}</td>
                      <td>
                        <span className={`badge ${t.priority === 'urgent' ? 'badge-occupied' : 'badge-pending'}`}>{t.priority}</span>
                      </td>
                      <td><span className={`badge badge-${t.status === 'in_progress' ? 'checked_in' : 'pending'}`}>{t.status.replace('_',' ')}</span></td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{t.assigned_username || '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: 160 }}>{t.notes || '—'}</td>
                      <td>
                        <div className="table-actions">
                          {t.status === 'pending'     && <button className="btn btn-sm btn-secondary" onClick={() => updateTask(t.task_id,'in_progress')}>Start</button>}
                          {t.status === 'in_progress' && <button className="btn btn-sm btn-primary"   onClick={() => updateTask(t.task_id,'completed')}>Complete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Housekeeping Task — Room {selectedRoom.room_number}</div>
              <button className="icon-btn" onClick={() => setSelectedRoom(null)}><X size={16} /></button>
            </div>

            {/* Status flow */}
            <div style={{ marginBottom: 20 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Current Status</div>
              <span className={`badge badge-${selectedRoom.status}`} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                {STATUS_ICONS[selectedRoom.status]} {selectedRoom.status}
              </span>
              {STATUS_FLOW[selectedRoom.status] && (
                <span style={{ color: 'var(--color-text-muted)', margin: '0 8px' }}>→</span>
              )}
              {STATUS_FLOW[selectedRoom.status] && (
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                  {STATUS_FLOW[selectedRoom.status]}
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Priority</label>
              <select className="form-input" value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={2} placeholder="e.g. Deep clean required" value={taskNote} onChange={e => setTaskNote(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRoom(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTask} disabled={saving}>
                {saving ? 'Creating...' : '+ Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
