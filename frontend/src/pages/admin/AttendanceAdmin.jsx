/**
 * AttendanceAdmin.jsx — Admin Attendance Dashboard
 * All staff today + monthly report + export.
 */
import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState, StatCard } from '../../components/UI';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceAdmin() {
  const now = new Date();
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [filterDate, setFilterDate] = useState(now.toISOString().split('T')[0]);

  const fetchSummary = async () => {
    const { data } = await api.get('/attendance/summary');
    setSummary(data);
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      else { params.month = month; params.year = year; }
      const { data } = await api.get('/attendance/all', { params });
      setRecords(data);
    } catch { toast.error('Failed to load records'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchSummary(); fetchRecords(); }, [filterDate, month, year]);

  const exportReport = async (format) => {
    try {
      const resp = await api.get(`/export/attendance?format=${format}&month=${month}&year=${year}`, { responseType: 'blob' });
      const ext = format === 'excel' ? 'xlsx' : format;
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a'); a.href = url; a.download = `attendance.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  if (!summary) return <PageLoader />;

  const stats = [
    { icon: '👥', label: 'Total Staff',   value: summary.total_staff,  color: 'var(--color-info)',    bg: 'var(--color-info-bg)' },
    { icon: '✅', label: 'Present Today', value: summary.present,       color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    { icon: '⚠️', label: 'Late Today',    value: summary.late,          color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    { icon: '❌', label: 'Absent Today',  value: summary.absent,        color: 'var(--color-error)',   bg: 'var(--color-error-bg)' },
  ];

  return (
    <div className="page-content slide-up">
      <PageHeader
        title="Attendance Management"
        subtitle="Monitor staff attendance and generate reports"
        action={
          <div className="export-btn-row">
            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('csv')}><Download size={14} /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('excel')}><Download size={14} /> Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('pdf')}><Download size={14} /> PDF</button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Filters */}
      <div className="filters-row">
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Single Date:</label>
          <input className="form-input" type="date" style={{ width: 160 }} value={filterDate} onChange={e => { setFilterDate(e.target.value); }} />
        </div>
        <div style={{ color: 'var(--color-text-muted)', padding: '0 4px' }}>or</div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Month:</label>
          <select className="form-input" style={{ width: 110 }} value={month} onChange={e => { setMonth(e.target.value); setFilterDate(''); }}>
            {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
          </select>
          <select className="form-input" style={{ width: 90 }} value={year} onChange={e => { setYear(e.target.value); setFilterDate(''); }}>
            {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <PageLoader /> : records.length === 0 ? (
          <EmptyState icon="📋" title="No attendance records" message="No records for the selected period." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Break</th>
                  <th>Clock Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.attendance_id}>
                    <td><strong>{r.username}</strong></td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--color-text-muted)' }}>{r.role}</td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>{fmt(r.clock_in)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {r.break_start ? `${fmt(r.break_start)}→${r.break_end ? fmt(r.break_end) : '…'}` : '—'}
                    </td>
                    <td>{fmt(r.clock_out)}</td>
                    <td>{r.total_hours ? <strong>{r.total_hours}h</strong> : '—'}</td>
                    <td><span className={`attendance-status-chip chip-${r.status}`} style={{ fontSize: '0.75rem', padding: '3px 10px' }}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
