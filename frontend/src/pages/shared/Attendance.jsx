/**
 * Attendance.jsx — Employee Self-Service Attendance Panel
 * Clock in/out, break start/end, and personal attendance history.
 * Used by both admin and reception staff.
 */
import { useState, useEffect, useCallback } from 'react';
import { LogIn, LogOut, Coffee, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PageHeader, PageLoader, EmptyState } from '../../components/UI';

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function formatTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_LABELS = { present: '✅ Present', late: '⚠️ Late', absent: '❌ Absent', half_day: '🕐 Half Day' };

export default function Attendance() {
  const now    = useClock();
  const [today, setToday]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [todayRes, histRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/attendance/my'),
      ]);
      setToday(todayRes.data);
      setHistory(histRes.data);
    } catch { toast.error('Failed to load attendance data'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const act = async (endpoint, label) => {
    setActing(true);
    try {
      await api.post(`/attendance/${endpoint}`);
      toast.success(label);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally { setActing(false); }
  };

  if (loading) return <PageLoader />;

  const clockedIn  = !!today?.clock_in;
  const clockedOut = !!today?.clock_out;
  const onBreak    = !!today?.break_start && !today?.break_end;

  return (
    <div className="page-content slide-up">
      <PageHeader title="My Attendance" subtitle="Track your working hours for today" />

      {/* Clock Panel */}
      <div className="attendance-clock-panel">
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div className="attendance-time-display">
          {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        {/* Today Status */}
        {today && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {today.clock_in  && <span>🕐 In: <strong>{formatTime(today.clock_in)}</strong></span>}
            {today.break_start && <span>☕ Break: <strong>{formatTime(today.break_start)}</strong></span>}
            {today.break_end   && <span>▶️ Resume: <strong>{formatTime(today.break_end)}</strong></span>}
            {today.clock_out && <span>🕕 Out: <strong>{formatTime(today.clock_out)}</strong></span>}
            {today.total_hours && <span>⏱️ Hours: <strong>{today.total_hours}h</strong></span>}
          </div>
        )}

        {today?.status && (
          <div style={{ marginBottom: 16 }}>
            <span className={`attendance-status-chip chip-${today.status}`}>
              {STATUS_LABELS[today.status] || today.status}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="attendance-actions">
          {!clockedIn && (
            <button className="btn btn-primary" onClick={() => act('clock-in', 'Clocked in!')} disabled={acting}>
              <LogIn size={16} /> Clock In
            </button>
          )}
          {clockedIn && !clockedOut && !onBreak && (
            <button className="btn btn-secondary" onClick={() => act('break-start', 'Break started!')} disabled={acting}>
              <Coffee size={16} /> Start Break
            </button>
          )}
          {onBreak && (
            <button className="btn btn-secondary" onClick={() => act('break-end', 'Break ended!')} disabled={acting}>
              <Play size={16} /> End Break
            </button>
          )}
          {clockedIn && !clockedOut && (
            <button className="btn btn-danger" onClick={() => act('clock-out', 'Clocked out!')} disabled={acting}>
              <LogOut size={16} /> Clock Out
            </button>
          )}
          {clockedOut && (
            <div className="alert alert-success" style={{ margin: 0 }}>
              ✅ You have clocked out for today. Total: <strong>{today.total_hours}h</strong>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="section-title">📋 Attendance History</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {history.length === 0 ? (
            <EmptyState icon="📅" title="No attendance records yet" message="Clock in to start tracking." />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Break</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.attendance_id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(r.date)}</td>
                      <td>{formatTime(r.clock_in)}</td>
                      <td>{formatTime(r.clock_out)}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {r.break_start ? `${formatTime(r.break_start)} → ${r.break_end ? formatTime(r.break_end) : 'ongoing'}` : '—'}
                      </td>
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
    </div>
  );
}
