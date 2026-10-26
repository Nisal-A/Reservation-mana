// frontend/src/pages/admin/UserManagement.jsx
// Staff User Management (Admin only)
// Staff accounts only (admin, reception). Search, role filter, active filter, pagination.
// Add & edit in Modal with password rules shown. Actions: edit, reset password, deactivate/reactivate.
// Destructive actions on signed-in admin's own row are disabled with clear explanation.

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Search,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  User as UserIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import {
  Button,
  StatusText,
  Modal,
  ConfirmModal,
  PageHeader,
  FormField,
  Input,
  Select,
  Pagination,
  Skeleton,
  EmptyState,
} from '../../components/UI';

const PAGE_SIZE = 10;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_RULE_TEXT = 'At least 8 characters long, containing both letters and numbers';

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'reception' });
  const [addLoading, setAddLoading] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  // Edit Modal State
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', role: 'reception' });
  const [editLoading, setEditLoading] = useState(false);

  // Reset Password Modal State
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Deactivate Confirm Modal State
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [toggleActiveLoading, setToggleActiveLoading] = useState(false);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (activeFilter !== '') params.active = activeFilter;

      const res = await api.get('/users', { params });
      setUsers(res.data);

      const headerTotal = res.headers['x-total-count'];
      if (headerTotal !== undefined) {
        setTotalCount(Number(headerTotal));
      } else {
        setTotalCount(res.data.length);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, roleFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 on filter changes
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleActiveChange = (e) => {
    setActiveFilter(e.target.value);
    setCurrentPage(1);
  };

  // Add User Handlers
  const handleOpenAdd = () => {
    setAddForm({ username: '', password: '', role: 'reception' });
    setShowAddPassword(false);
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.username.trim() || addForm.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (!PASSWORD_REGEX.test(addForm.password)) {
      toast.error(`Password requirement: ${PASSWORD_RULE_TEXT}`);
      return;
    }

    setAddLoading(true);
    try {
      await api.post('/users', {
        username: addForm.username.trim(),
        password: addForm.password,
        role: addForm.role,
      });
      toast.success('Staff account created successfully');
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  // Edit User Handlers
  const handleOpenEdit = (user) => {
    setEditTarget(user);
    setEditForm({
      username: user.username,
      role: user.role,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.username.trim() || editForm.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    setEditLoading(true);
    try {
      const payload = {
        username: editForm.username.trim(),
        role: editForm.role,
      };
      await api.put(`/users/${editTarget.user_id}`, payload);
      toast.success('Staff account updated successfully');
      setShowEditModal(false);
      setEditTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  // Reset Password Handlers
  const handleOpenReset = (user) => {
    setResetTarget(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowResetPassword(false);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!PASSWORD_REGEX.test(newPassword)) {
      toast.error(`Password requirement: ${PASSWORD_RULE_TEXT}`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setResetLoading(true);
    try {
      await api.put(`/users/${resetTarget.user_id}`, { password: newPassword });
      toast.success(`Password reset successfully for ${resetTarget.username}`);
      setResetTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  // Deactivate / Reactivate Handlers
  const handleToggleActiveClick = (user) => {
    // Check if user is self
    if (currentUser && user.user_id === currentUser.user_id) {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    if (user.is_active) {
      // Opening confirmation modal
      setDeactivateTarget(user);
    } else {
      // Direct reactivate
      executeToggleActive(user, true);
    }
  };

  const executeToggleActive = async (user, nextActiveState) => {
    setToggleActiveLoading(true);
    try {
      await api.patch(`/users/${user.user_id}/active`, { is_active: nextActiveState });
      toast.success(
        `Staff account ${user.username} has been ${nextActiveState ? 'activated' : 'deactivated'}`
      );
      setDeactivateTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update account status');
    } finally {
      setToggleActiveLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Staff Management"
        subtitle="Manage administrator and reception accounts with secure role controls"
        action={
          <Button variant="primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add Staff Account
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, flex: 1, minWidth: 280 }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 240, flex: 1 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by username..."
              value={search}
              onChange={handleSearchChange}
              style={{ paddingLeft: 38, width: '100%' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div style={{ minWidth: 160 }}>
            <select className="select-field" value={roleFilter} onChange={handleRoleChange}>
              <option value="">All Staff Roles</option>
              <option value="admin">Administrator</option>
              <option value="reception">Receptionist</option>
            </select>
          </div>

          {/* Active Status Filter */}
          <div style={{ minWidth: 160 }}>
            <select className="select-field" value={activeFilter} onChange={handleActiveChange}>
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Count summary */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
          Showing <strong>{users.length}</strong> of <strong>{totalCount}</strong> staff members
        </div>
      </div>

      {/* Staff Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table-ui" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--input)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  STAFF MEMBER
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  ROLE
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  STATUS
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  LAST LOGIN
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  CREATED
                </th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <Skeleton height="22px" width="160px" />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <Skeleton height="20px" width="80px" />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <Skeleton height="20px" width="60px" />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <Skeleton height="18px" width="100px" />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <Skeleton height="18px" width="90px" />
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <Skeleton height="28px" width="120px" style={{ marginLeft: 'auto' }} />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <EmptyState
                      title="No staff accounts found"
                      message={
                        search || roleFilter || activeFilter !== ''
                          ? 'No staff members match the selected criteria. Try adjusting your filters.'
                          : 'No staff accounts exist yet.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser && currentUser.user_id === u.user_id;
                  return (
                    <tr
                      key={u.user_id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelf ? 'rgba(200, 169, 106, 0.04)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Staff Member / Username */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: u.role === 'admin' ? 'rgba(200, 169, 106, 0.18)' : 'rgba(96, 165, 250, 0.18)',
                              color: u.role === 'admin' ? 'var(--gold)' : 'var(--info)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              border: `1px solid ${
                                u.role === 'admin' ? 'rgba(200, 169, 106, 0.3)' : 'rgba(96, 165, 250, 0.3)'
                              }`,
                            }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
                                {u.username}
                              </span>
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: 'var(--gold)',
                                    color: '#000',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                              User ID: #{u.user_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '16px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: u.role === 'admin' ? 'rgba(200, 169, 106, 0.12)' : 'rgba(96, 165, 250, 0.12)',
                            color: u.role === 'admin' ? 'var(--gold)' : 'var(--info)',
                            border: `1px solid ${
                              u.role === 'admin' ? 'rgba(200, 169, 106, 0.3)' : 'rgba(96, 165, 250, 0.3)'
                            }`,
                          }}
                        >
                          {u.role === 'admin' ? <Shield size={13} /> : <UserIcon size={13} />}
                          {u.role === 'admin' ? 'Administrator' : 'Receptionist'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 16px' }}>
                        <StatusText status={u.is_active ? 'confirmed' : 'cancelled'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </StatusText>
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '16px 16px', fontSize: '0.85rem', color: 'var(--text-body)' }}>
                        {u.last_login_at ? formatDate(u.last_login_at) : 'Never'}
                      </td>

                      {/* Created */}
                      <td style={{ padding: '16px 16px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {formatDate(u.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {/* Edit User */}
                          <button
                            type="button"
                            className="btn-icon"
                            title="Edit User"
                            onClick={() => handleOpenEdit(u)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 4,
                              background: 'var(--input)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Pencil size={15} />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            className="btn-icon"
                            title="Reset Password"
                            onClick={() => handleOpenReset(u)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 4,
                              background: 'var(--input)',
                              border: '1px solid var(--border)',
                              color: 'var(--gold)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <KeyRound size={15} />
                          </button>

                          {/* Deactivate / Reactivate */}
                          {isSelf ? (
                            <button
                              type="button"
                              disabled
                              title="Signed-in admin cannot be deactivated"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 4,
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid var(--border)',
                                color: 'var(--muted)',
                                opacity: 0.4,
                                cursor: 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <UserX size={15} />
                            </button>
                          ) : u.is_active ? (
                            <button
                              type="button"
                              className="btn-icon"
                              title="Deactivate Account"
                              onClick={() => handleToggleActiveClick(u)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 4,
                                background: 'rgba(248, 113, 113, 0.1)',
                                border: '1px solid rgba(248, 113, 113, 0.3)',
                                color: 'var(--danger)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <UserX size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-icon"
                              title="Reactivate Account"
                              onClick={() => handleToggleActiveClick(u)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 4,
                                background: 'rgba(52, 211, 153, 0.1)',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                color: 'var(--success)',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <UserCheck size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Self-protection footer notice */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--input)',
            fontSize: '0.8rem',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShieldAlert size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <span>
            Self-protection enabled: Your signed-in admin account cannot be deactivated or demoted from this console.
          </span>
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ marginTop: 20 }}>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. ADD STAFF MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => !addLoading && setShowAddModal(false)}
        title="Add New Staff Member"
        size="md"
      >
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Username */}
          <FormField label="Username" required hint="Between 3 and 30 characters">
            <Input
              type="text"
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
              placeholder="e.g. jdoe_staff"
              autoFocus
              required
            />
          </FormField>

          {/* Role */}
          <FormField label="Staff Role" required>
            <Select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              options={[
                { value: 'reception', label: 'Receptionist (Frontdesk, reservations, check-in/out)' },
                { value: 'admin', label: 'Administrator (Full portal access, reports, user control)' },
              ]}
            />
          </FormField>

          {/* Password */}
          <FormField label="Initial Password" required>
            <div style={{ position: 'relative' }}>
              <Input
                type={showAddPassword ? 'text' : 'password'}
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="Enter strong password"
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowAddPassword(!showAddPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              >
                {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          {/* Password Rules Callout */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 4,
              background: 'rgba(200, 169, 106, 0.08)',
              border: '1px solid rgba(200, 169, 106, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gold)' }}>
              <ShieldCheck size={15} /> Password Requirements
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-body)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check
                  size={13}
                  style={{ color: addForm.password.length >= 8 ? 'var(--success)' : 'var(--muted)' }}
                />
                <span style={{ color: addForm.password.length >= 8 ? 'var(--text)' : 'var(--muted)' }}>
                  At least 8 characters in length
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check
                  size={13}
                  style={{ color: /[A-Za-z]/.test(addForm.password) ? 'var(--success)' : 'var(--muted)' }}
                />
                <span style={{ color: /[A-Za-z]/.test(addForm.password) ? 'var(--text)' : 'var(--muted)' }}>
                  Contains at least one letter (a-z, A-Z)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check
                  size={13}
                  style={{ color: /\d/.test(addForm.password) ? 'var(--success)' : 'var(--muted)' }}
                />
                <span style={{ color: /\d/.test(addForm.password) ? 'var(--text)' : 'var(--muted)' }}>
                  Contains at least one digit (0-9)
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
              disabled={addLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={addLoading}>
              Create Staff Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          2. EDIT STAFF MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showEditModal}
        onClose={() => !editLoading && setShowEditModal(false)}
        title={editTarget ? `Edit Staff Member (${editTarget.username})` : 'Edit Staff Member'}
        size="md"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Username */}
          <FormField label="Username" required>
            <Input
              type="text"
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              required
            />
          </FormField>

          {/* Role */}
          <FormField
            label="Staff Role"
            required
            hint={
              currentUser && editTarget && currentUser.user_id === editTarget.user_id
                ? 'An administrator cannot demote their own account.'
                : undefined
            }
          >
            <Select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              disabled={currentUser && editTarget && currentUser.user_id === editTarget.user_id}
              options={[
                { value: 'reception', label: 'Receptionist' },
                { value: 'admin', label: 'Administrator' },
              ]}
            />
          </FormField>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 4,
              background: 'var(--input)',
              border: '1px solid var(--border)',
              fontSize: '0.8rem',
              color: 'var(--text-body)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <KeyRound size={15} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <span>
              To change this staff member's password, use the <strong>Reset Password</strong> action from the table.
            </span>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          3. RESET PASSWORD MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(resetTarget)}
        onClose={() => !resetLoading && setResetTarget(null)}
        title={resetTarget ? `Reset Password: ${resetTarget.username}` : 'Reset Password'}
        size="md"
      >
        <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Password Rules Callout */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 4,
              background: 'rgba(200, 169, 106, 0.08)',
              border: '1px solid rgba(200, 169, 106, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gold)' }}>
              <ShieldCheck size={15} /> Password Requirements
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-body)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check
                  size={13}
                  style={{ color: newPassword.length >= 8 ? 'var(--success)' : 'var(--muted)' }}
                />
                <span style={{ color: newPassword.length >= 8 ? 'var(--text)' : 'var(--muted)' }}>
                  At least 8 characters in length
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check
                  size={13}
                  style={{ color: /[A-Za-z]/.test(newPassword) ? 'var(--success)' : 'var(--muted)' }}
                />
                <span style={{ color: /[A-Za-z]/.test(newPassword) ? 'var(--text)' : 'var(--muted)' }}>
                  Contains at least one letter (a-z, A-Z)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check
                  size={13}
                  style={{ color: /\d/.test(newPassword) ? 'var(--success)' : 'var(--muted)' }}
                />
                <span style={{ color: /\d/.test(newPassword) ? 'var(--text)' : 'var(--muted)' }}>
                  Contains at least one digit (0-9)
                </span>
              </div>
            </div>
          </div>

          {/* New Password */}
          <FormField label="New Password" required>
            <div style={{ position: 'relative' }}>
              <Input
                type={showResetPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              >
                {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          {/* Confirm Password */}
          <FormField label="Confirm New Password" required>
            <Input
              type={showResetPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </FormField>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={resetLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={resetLoading}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          4. CONFIRM DEACTIVATION MODAL
         ───────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => executeToggleActive(deactivateTarget, false)}
        title="Deactivate Staff Account"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate ${deactivateTarget.username}? They will no longer be able to log in to the staff portals. This account can be reactivated at any time.`
            : ''
        }
        confirmLabel="Deactivate Account"
        cancelLabel="Cancel"
        variant="danger"
        loading={toggleActiveLoading}
      />
    </div>
  );
}
