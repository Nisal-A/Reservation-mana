/**
 * PricingRules.jsx — Admin page to manage dynamic pricing rules.
 * Allows CRUD on pricing rules (weekend surcharge, peak season, etc.)
 */
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState, ConfirmModal } from '../../components/UI';

const RULE_TYPES = [
  { value: 'weekend',             label: 'Weekend Surcharge' },
  { value: 'holiday',             label: 'Holiday Surcharge' },
  { value: 'peak_season',         label: 'Peak Season Surcharge' },
  { value: 'off_season',          label: 'Off-Season Discount' },
  { value: 'room_type_multiplier', label: 'Room Type Multiplier' },
];
const ROOM_TYPES = ['Single', 'Double', 'Suite', 'Deluxe'];

const emptyForm = { rule_name: '', rule_type: 'weekend', value: '', applies_to: '', start_date: '', end_date: '' };

export default function PricingRules() {
  const [rules, setRules]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editRule, setEditRule]     = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetch = async () => {
    try {
      const { data } = await api.get('/pricing/rules');
      setRules(data);
    } catch { toast.error('Failed to load pricing rules'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openAdd  = () => { setEditRule(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (r) => {
    setEditRule(r);
    setForm({
      rule_name: r.rule_name, rule_type: r.rule_type, value: r.value,
      applies_to: r.applies_to || '', start_date: r.start_date?.slice(0,10) || '', end_date: r.end_date?.slice(0,10) || '',
    });
    setShowModal(true);
  };
  const close = () => { setShowModal(false); setEditRule(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        rule_name: form.rule_name,
        rule_type: form.rule_type,
        value: parseFloat(form.value),
        applies_to: form.applies_to || null,
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
      };
      if (editRule) {
        await api.put(`/pricing/rules/${editRule.rule_id}`, payload);
        toast.success('Rule updated!');
      } else {
        await api.post('/pricing/rules', payload);
        toast.success('Rule created!');
      }
      close(); fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const toggleActive = async (rule) => {
    try {
      await api.put(`/pricing/rules/${rule.rule_id}`, { is_active: rule.is_active ? 0 : 1 });
      toast.success(`Rule ${rule.is_active ? 'disabled' : 'enabled'}`);
      fetch();
    } catch { toast.error('Failed to toggle rule'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/pricing/rules/${deleteTarget.rule_id}`);
      toast.success('Rule deleted');
      setDeleteTarget(null); fetch();
    } catch { toast.error('Delete failed'); setDeleteTarget(null); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Dynamic Pricing Rules"
        subtitle="Configure surcharges, discounts, and room type multipliers"
        action={
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Rule
          </button>
        }
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rules.length === 0 ? (
          <EmptyState icon="💰" title="No pricing rules" message="Add a rule to start dynamic pricing." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Applies To</th>
                  <th>Date Range</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.rule_id}>
                    <td><strong>{r.rule_name}</strong></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      {RULE_TYPES.find(t => t.value === r.rule_type)?.label || r.rule_type}
                    </td>
                    <td>
                      <span className={`price-tag ${r.value >= 0 ? 'price-tag-surcharge' : 'price-tag-discount'}`}>
                        {r.value >= 0 ? '+' : ''}{r.value}%
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{r.applies_to || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {r.start_date ? `${r.start_date?.slice(0,10)} → ${r.end_date?.slice(0,10)}` : 'Always'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: r.is_active ? 'var(--color-success)' : 'var(--color-text-faint)' }}
                        onClick={() => toggleActive(r)}
                        title={r.is_active ? 'Disable rule' : 'Enable rule'}
                      >
                        {r.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        {r.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn" onClick={() => openEdit(r)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn" onClick={() => setDeleteTarget(r)} title="Delete"
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

      {/* Info card */}
      <div className="alert alert-info" style={{ marginTop: 20 }}>
        ℹ️ <strong>Pricing Engine:</strong> Rules are applied automatically when customers select dates.
        Positive values add a surcharge; negative values apply a discount. A 10% tax is applied on top of all pricing.
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editRule ? 'Edit Pricing Rule' : 'New Pricing Rule'}</div>
              <button className="icon-btn" onClick={close}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Rule Name *</label>
                <input className="form-input" placeholder="e.g. Weekend Surcharge" value={form.rule_name} onChange={set('rule_name')} required />
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Rule Type *</label>
                  <select className="form-input" value={form.rule_type} onChange={set('rule_type')} required>
                    {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Value (%) * — Negative = discount</label>
                  <input className="form-input" type="number" step="0.01" placeholder="e.g. 15 or -10" value={form.value} onChange={set('value')} required />
                </div>
              </div>

              {form.rule_type === 'room_type_multiplier' && (
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Applies To (Room Type) *</label>
                  <select className="form-input" value={form.applies_to} onChange={set('applies_to')} required>
                    <option value="">Select room type</option>
                    {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {(form.rule_type === 'peak_season' || form.rule_type === 'off_season' || form.rule_type === 'holiday') && (
                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input className="form-input" type="date" value={form.start_date} onChange={set('start_date')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input className="form-input" type="date" value={form.end_date} onChange={set('end_date')} />
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Pricing Rule"
        message={`Delete rule "${deleteTarget?.rule_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
