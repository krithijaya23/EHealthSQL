import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, ClipboardList, Share2, FileText,
  TrendingUp, Activity, ArrowRight, Sparkles,
  Pill, FlaskConical, Scan, ClipboardCheck, Receipt,
  Bell, AlertCircle, Clock, Stethoscope
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { format, isToday, isPast, parseISO } from 'date-fns';
import './Dashboard.css';

// ─── Type icon map ────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  Prescription: Pill, 'Lab Report': FlaskConical, Scan: Scan,
  'Discharge Summary': ClipboardCheck, 'Medical Bill': Receipt,
  Vaccination: Activity, Other: FileText,
};
const TYPE_COLORS = {
  Prescription: '#2563eb', 'Lab Report': '#7c3aed', Scan: '#059669',
  'Discharge Summary': '#d97706', 'Medical Bill': '#0891b2',
  Vaccination: '#db2777', Other: '#64748b',
};

const StatCard = ({ icon: Icon, label, value, color, trend }) => (
  <div className="stat-card card">
    <div className="stat-card__icon" style={{ background: color + '18', color }}>
      <Icon size={22} />
    </div>
    <div className="stat-card__body">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value ?? '—'}</p>
      {trend && <p className="stat-card__trend">{trend}</p>}
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, label, desc, color, onClick }) => (
  <button className="quick-action card" onClick={onClick}>
    <div className="quick-action__icon" style={{ background: color + '18', color }}>
      <Icon size={22} />
    </div>
    <div>
      <p className="quick-action__label">{label}</p>
      <p className="quick-action__desc">{desc}</p>
    </div>
    <ArrowRight size={16} className="quick-action__arrow" />
  </button>
);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayReminders, setTodayReminders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/analytics/dashboard');
        setStats(data.stats);
      } catch {
        // use empty state
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Load today's reminders from localStorage
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem('hrm_reminders') || '[]');
      const today = all.filter((r) => {
        if (r.done) return false;
        const dt = parseISO(`${r.date}T${r.time || '00:00'}`);
        return isToday(dt) || (isPast(dt) && !r.done);
      }).slice(0, 4);
      setTodayReminders(today);
    } catch {
      setTodayReminders([]);
    }
  }, []);

  const firstName = user?.fullName?.split(' ')[0] || 'User';

  return (
    <div className="dashboard fade-in">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-banner__content">
          <div className="welcome-banner__text">
            <p className="welcome-banner__greeting">{getGreeting()}</p>
            <h1 className="welcome-banner__name">{firstName}</h1>
            <p className="welcome-banner__sub">Manage your health records securely</p>
          </div>
          <div className="welcome-banner__badge">
            <Sparkles size={16} />
            <span>AI-Powered</span>
          </div>
        </div>
        <div className="welcome-banner__decoration">
          <div className="welcome-banner__circle welcome-banner__circle--1" />
          <div className="welcome-banner__circle welcome-banner__circle--2" />
          <div className="welcome-banner__circle welcome-banner__circle--3" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon={FileText} label="Total Records" value={loading ? '...' : stats?.totalRecords ?? 0} color="#2563eb" trend="All time" />
        <StatCard icon={Activity} label="This Month" value={loading ? '...' : stats?.recordsThisMonth ?? 0} color="#059669" trend="New uploads" />
        <StatCard icon={TrendingUp} label="AI Processed" value={loading ? '...' : stats?.totalRecords ?? 0} color="#f59e0b" trend="OCR scanned" />
        <StatCard icon={Share2} label="Shared Access" value={loading ? '...' : stats?.sharedCount ?? 0} color="#7c3aed" trend="Active grants" />
      </div>

      <div className="dashboard__grid">
        {/* Quick Actions */}
        <div className="dashboard__section">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          <div className="quick-actions-grid">
            <QuickAction icon={Upload} label="Upload Record" desc="Add prescription or report" color="#2563eb" onClick={() => navigate('/upload')} />
            <QuickAction icon={ClipboardList} label="Medical History" desc="Browse all records" color="#7c3aed" onClick={() => navigate('/history')} />
            <QuickAction icon={Share2} label="Share Access" desc="Grant doctor access" color="#059669" onClick={() => navigate('/share')} />
            <QuickAction icon={TrendingUp} label="Health Insights" desc="View analytics & AI summary" color="#f59e0b" onClick={() => navigate('/insights')} />
          </div>
        </div>

        {/* Recent Records */}
        <div className="dashboard__section">
          <div className="section-header">
            <h2 className="section-title">Recent Uploads</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="recent-records card">
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : stats?.recentRecords?.length > 0 ? (
              stats.recentRecords.map((record) => {
                const color = TYPE_COLORS[record.recordType] || '#64748b';
                const Icon = TYPE_ICONS[record.recordType] || FileText;

                const getTitle = () => {
                  switch (record.recordType) {
                    case 'Lab Report':
                      return record.diagnosis || (record.labTests?.[0]?.testName
                        ? `${record.labTests[0].testName}${record.labTests.length > 1 ? ` +${record.labTests.length - 1}` : ''}`
                        : 'Lab Report');
                    case 'Scan': return record.scanType || 'Scan Report';
                    case 'Discharge Summary': return record.diagnosis || 'Discharge Summary';
                    case 'Medical Bill': return record.billNumber ? `Bill #${record.billNumber}` : 'Medical Bill';
                    default: return record.diagnosis || record.recordType || 'Medical Record';
                  }
                };

                const getSubtitle = () => {
                  const parts = [];
                  if (record.doctorName) parts.push(`Dr. ${record.doctorName}`);
                  else if (record.labName) parts.push(record.labName);
                  else if (record.hospitalName) parts.push(record.hospitalName);
                  if (record.visitDate) parts.push(format(new Date(record.visitDate), 'MMM d, yyyy'));
                  return parts.join(' · ');
                };

                return (
                  <div key={record._id} className="recent-record-item"
                    onClick={() => navigate(`/history/${record._id}`)}>
                    <div className="recent-record__icon" style={{ background: color + '18', color }}>
                      <Icon size={17} />
                    </div>
                    <div className="recent-record__info">
                      <p className="recent-record__title">{getTitle()}</p>
                      <p className="recent-record__meta">{getSubtitle()}</p>
                    </div>
                    <span className="badge" style={{ background: color + '18', color, fontSize: 10 }}>
                      {record.recordType}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <FileText size={40} />
                <h3>No records yet</h3>
                <p>Upload your first medical record to get started</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => navigate('/upload')}>
                  Upload Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Today's date card */}
        <div className="dashboard__section">
          <div className="section-header">
            <h2 className="section-title">Today</h2>
          </div>
          <div className="today-card card">
            <div className="today-card__date">
              <p className="today-card__day">{format(new Date(), 'EEEE')}</p>
              <p className="today-card__num">{format(new Date(), 'd')}</p>
              <p className="today-card__month">{format(new Date(), 'MMMM yyyy')}</p>
            </div>
            <div className="divider" />
            <div className="today-card__actions">
              <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/upload')}>
                <Upload size={15} /> Upload Record
              </button>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => navigate('/insights')}>
                <TrendingUp size={15} /> View Insights
              </button>
            </div>
          </div>
        </div>

        {/* Today's Reminders */}
        <div className="dashboard__section">
          <div className="section-header">
            <h2 className="section-title">
              <Bell size={16} style={{ marginRight: 6 }} />
              Reminders
              {todayReminders.length > 0 && (
                <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>{todayReminders.length}</span>
              )}
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reminders')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {todayReminders.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <Bell size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No pending reminders</p>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/reminders')}>
                  + Add Reminder
                </button>
              </div>
            ) : (
              todayReminders.map((r, i) => {
                const isOverdue = isPast(parseISO(`${r.date}T${r.time || '00:00'}`));
                const ICONS = { medicine: Pill, appointment: Stethoscope, test: ClipboardList, other: Bell };
                const COLORS = { medicine: '#2563eb', appointment: '#7c3aed', test: '#059669', other: '#d97706' };
                const Icon = ICONS[r.type] || Bell;
                const color = COLORS[r.type] || '#d97706';
                return (
                  <div key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      borderBottom: i < todayReminders.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate('/reminders')}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</p>
                      <p style={{ fontSize: 11, color: isOverdue ? '#dc2626' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
                        {isOverdue ? 'Overdue' : r.time ? `Today at ${r.time}` : 'Today'}
                      </p>
                    </div>
                    {isOverdue && <span className="badge badge-red" style={{ fontSize: 10 }}>!</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
