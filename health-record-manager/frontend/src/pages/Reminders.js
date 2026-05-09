import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Pill, Calendar, Trash2, CheckCircle,
  Clock, X, Edit2, Save, AlertCircle,
  Stethoscope, Repeat
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, isToday, isTomorrow, differenceInHours, parseISO } from 'date-fns';
import './Reminders.css';

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'hrm_reminders';

const loadReminders = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveReminders = (list) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

const genId = () => `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Reminder types ───────────────────────────────────────────────────────────
const TYPES = {
  medicine:    { label: 'Medicine',    icon: Pill,        color: '#2563eb', bg: '#eff6ff' },
  appointment: { label: 'Appointment', icon: Stethoscope, color: '#7c3aed', bg: '#faf5ff' },
  test:        { label: 'Lab Test',    icon: Calendar,    color: '#059669', bg: '#f0fdf4' },
  other:       { label: 'Other',       icon: Bell,        color: '#d97706', bg: '#fffbeb' },
};

const REPEAT_OPTIONS = [
  { value: 'none',    label: 'No repeat' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
const getStatus = (reminder) => {
  if (reminder.done) return 'done';
  const dt = parseISO(`${reminder.date}T${reminder.time || '00:00'}`);
  if (isPast(dt)) return 'overdue';
  if (isToday(dt)) return 'today';
  if (isTomorrow(dt)) return 'tomorrow';
  return 'upcoming';
};

const STATUS_CONFIG = {
  done:     { cls: 'badge-green',  label: 'Done' },
  overdue:  { cls: 'badge-red',    label: 'Overdue' },
  today:    { cls: 'badge-yellow', label: 'Today' },
  tomorrow: { cls: 'badge-blue',   label: 'Tomorrow' },
  upcoming: { cls: 'badge-gray',   label: 'Upcoming' },
};

const getTimeLabel = (reminder) => {
  const dt = parseISO(`${reminder.date}T${reminder.time || '00:00'}`);
  if (reminder.done) return `Completed · ${format(dt, 'MMM d, yyyy')}`;
  if (isPast(dt)) {
    const h = Math.abs(differenceInHours(new Date(), dt));
    return h < 24 ? `${h}h overdue` : `${Math.floor(h / 24)}d overdue`;
  }
  if (isToday(dt)) return reminder.time ? `Today at ${reminder.time}` : 'Today';
  if (isTomorrow(dt)) return reminder.time ? `Tomorrow at ${reminder.time}` : 'Tomorrow';
  return format(dt, 'MMM d, yyyy') + (reminder.time ? ` at ${reminder.time}` : '');
};

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyForm = () => ({
  type: 'medicine',
  title: '',
  notes: '',
  date: new Date().toISOString().split('T')[0],
  time: '08:00',
  repeat: 'none',
  dosage: '',
  doctor: '',
  location: '',
});

// ─── Reminder Form Modal ──────────────────────────────────────────────────────
const ReminderForm = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState(initial || emptyForm());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Please enter a title'); return; }
    if (!form.date) { toast.error('Please select a date'); return; }
    onSave(form);
  };

  const cfg = TYPES[form.type];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card reminders-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{initial ? 'Edit Reminder' : 'New Reminder'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body">
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Type</label>
            <div className="reminder-type-grid">
              {Object.entries(TYPES).map(([key, t]) => {
                const Icon = t.icon;
                return (
                  <button key={key} type="button"
                    className={`reminder-type-btn ${form.type === key ? 'reminder-type-btn--active' : ''}`}
                    style={form.type === key ? { borderColor: t.color, background: t.bg, color: t.color } : {}}
                    onClick={() => set('type', key)}>
                    <Icon size={15} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">
              {form.type === 'medicine' ? 'Medicine Name *' : form.type === 'appointment' ? 'Appointment Title *' : 'Title *'}
            </label>
            <input className="form-input" required
              placeholder={form.type === 'medicine' ? 'e.g. Metformin 500mg' : form.type === 'appointment' ? 'e.g. Cardiology Checkup' : 'Reminder title'}
              value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          {/* Type-specific fields */}
          {form.type === 'medicine' && (
            <div className="form-group">
              <label className="form-label">Dosage / Instructions</label>
              <input className="form-input" placeholder="e.g. 1 tablet after food"
                value={form.dosage} onChange={(e) => set('dosage', e.target.value)} />
            </div>
          )}
          {(form.type === 'appointment' || form.type === 'test') && (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Doctor / Lab</label>
                <input className="form-input" placeholder="Dr. Smith / City Lab"
                  value={form.doctor} onChange={(e) => set('doctor', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" placeholder="Hospital / Clinic name"
                  value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" required
                value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input type="time" className="form-input"
                value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
          </div>

          {/* Repeat */}
          <div className="form-group">
            <label className="form-label"><Repeat size={13} /> Repeat</label>
            <div className="reminder-repeat-row">
              {REPEAT_OPTIONS.map((o) => (
                <button key={o.value} type="button"
                  className={`duration-btn ${form.repeat === o.value ? 'duration-btn--active' : ''}`}
                  onClick={() => set('repeat', o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2}
              placeholder="Additional notes..."
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ background: cfg.color }}>
              <Save size={15} /> {initial ? 'Update' : 'Add Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Reminder Card ────────────────────────────────────────────────────────────
const ReminderCard = ({ reminder, onToggle, onEdit, onDelete }) => {
  const cfg = TYPES[reminder.type] || TYPES.other;
  const Icon = cfg.icon;
  const status = getStatus(reminder);
  const statusCfg = STATUS_CONFIG[status];
  const timeLabel = getTimeLabel(reminder);

  return (
    <div className={`reminder-card card ${reminder.done ? 'reminder-card--done' : ''} ${status === 'overdue' ? 'reminder-card--overdue' : ''}`}>
      <div className="reminder-card__icon" style={{ background: cfg.bg, color: cfg.color }}>
        <Icon size={20} />
      </div>

      <div className="reminder-card__body">
        <div className="reminder-card__top">
          <h3 className="reminder-card__title">{reminder.title}</h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontSize: 10 }}>
              {cfg.label}
            </span>
            <span className={`badge ${statusCfg.cls}`} style={{ fontSize: 10 }}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        <div className="reminder-card__meta">
          <span className="reminder-card__time">
            <Clock size={12} /> {timeLabel}
          </span>
          {reminder.repeat !== 'none' && (
            <span className="reminder-card__repeat">
              <Repeat size={11} /> {REPEAT_OPTIONS.find((o) => o.value === reminder.repeat)?.label}
            </span>
          )}
        </div>

        {reminder.dosage && (
          <p className="reminder-card__detail"><Pill size={11} /> {reminder.dosage}</p>
        )}
        {reminder.doctor && (
          <p className="reminder-card__detail"><Stethoscope size={11} /> {reminder.doctor}</p>
        )}
        {reminder.location && (
          <p className="reminder-card__detail"><Calendar size={11} /> {reminder.location}</p>
        )}
        {reminder.notes && (
          <p className="reminder-card__notes">{reminder.notes}</p>
        )}
      </div>

      <div className="reminder-card__actions">
        <button
          className={`btn btn-sm ${reminder.done ? 'btn-ghost' : 'btn-secondary'}`}
          onClick={() => onToggle(reminder.id)}
          title={reminder.done ? 'Mark as pending' : 'Mark as done'}>
          <CheckCircle size={14} style={{ color: reminder.done ? '#059669' : undefined }} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(reminder)} title="Edit">
          <Edit2 size={13} />
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(reminder.id)} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ─── Main Reminders page ──────────────────────────────────────────────────────
const Reminders = () => {
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [filter, setFilter] = useState('all'); // all | medicine | appointment | test | other | done
  const [statusFilter, setStatusFilter] = useState('all'); // all | today | overdue | upcoming

  // Load from localStorage on mount
  useEffect(() => {
    setReminders(loadReminders());
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check for due reminders every minute and fire browser notifications
  useEffect(() => {
    const check = () => {
      const now = new Date();
      reminders.forEach((r) => {
        if (r.done || r.notified) return;
        const dt = parseISO(`${r.date}T${r.time || '00:00'}`);
        const diff = Math.abs(now - dt) / 60000; // minutes
        if (diff <= 1 && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`⏰ Reminder: ${r.title}`, {
            body: r.dosage || r.doctor || r.notes || TYPES[r.type]?.label || '',
            icon: '/favicon.ico',
          });
          // Mark as notified so it doesn't fire again
          setReminders((prev) => {
            const updated = prev.map((x) => x.id === r.id ? { ...x, notified: true } : x);
            saveReminders(updated);
            return updated;
          });
        }
      });
    };
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [reminders]);

  const persist = useCallback((list) => {
    setReminders(list);
    saveReminders(list);
  }, []);

  const handleSave = (form) => {
    if (editTarget) {
      const updated = reminders.map((r) =>
        r.id === editTarget.id ? { ...r, ...form, notified: false } : r
      );
      persist(updated);
      toast.success('Reminder updated');
    } else {
      const newReminder = { ...form, id: genId(), done: false, notified: false, createdAt: new Date().toISOString() };
      persist([newReminder, ...reminders]);
      toast.success('Reminder added');
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleToggle = (id) => {
    const updated = reminders.map((r) => r.id === id ? { ...r, done: !r.done } : r);
    persist(updated);
  };

  const handleEdit = (reminder) => {
    setEditTarget(reminder);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this reminder?')) return;
    persist(reminders.filter((r) => r.id !== id));
    toast.success('Reminder deleted');
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  // Filter
  const filtered = reminders.filter((r) => {
    const typeMatch = filter === 'all' ? true : filter === 'done' ? r.done : r.type === filter;
    if (!typeMatch) return false;
    if (statusFilter === 'all') return true;
    const s = getStatus(r);
    if (statusFilter === 'today') return s === 'today';
    if (statusFilter === 'overdue') return s === 'overdue';
    if (statusFilter === 'upcoming') return s === 'upcoming' || s === 'tomorrow';
    return true;
  });

  // Stats
  const todayCount    = reminders.filter((r) => !r.done && getStatus(r) === 'today').length;
  const overdueCount  = reminders.filter((r) => !r.done && getStatus(r) === 'overdue').length;
  const upcomingCount = reminders.filter((r) => !r.done && (getStatus(r) === 'upcoming' || getStatus(r) === 'tomorrow')).length;
  const doneCount     = reminders.filter((r) => r.done).length;

  return (
    <div className="reminders-page fade-in">
      <div className="page-header">
        <div>
          <h1>Reminders</h1>
          <p>Medicine schedules, appointments and health tasks</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Reminder
        </button>
      </div>

      {/* Stats */}
      <div className="reminders-stats">
        <button
          className={`reminder-stat card ${statusFilter === 'overdue' ? 'reminder-stat--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}>
          <div className="reminder-stat__icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="reminder-stat__label">Overdue</p>
            <p className="reminder-stat__value" style={{ color: overdueCount > 0 ? '#dc2626' : undefined }}>{overdueCount}</p>
          </div>
        </button>
        <button
          className={`reminder-stat card ${statusFilter === 'today' ? 'reminder-stat--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'today' ? 'all' : 'today')}>
          <div className="reminder-stat__icon" style={{ background: '#fffbeb', color: '#d97706' }}>
            <Clock size={18} />
          </div>
          <div>
            <p className="reminder-stat__label">Today</p>
            <p className="reminder-stat__value">{todayCount}</p>
          </div>
        </button>
        <button
          className={`reminder-stat card ${statusFilter === 'upcoming' ? 'reminder-stat--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming')}>
          <div className="reminder-stat__icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Calendar size={18} />
          </div>
          <div>
            <p className="reminder-stat__label">Upcoming</p>
            <p className="reminder-stat__value">{upcomingCount}</p>
          </div>
        </button>
        <button
          className={`reminder-stat card ${filter === 'done' ? 'reminder-stat--active' : ''}`}
          onClick={() => { setFilter(filter === 'done' ? 'all' : 'done'); setStatusFilter('all'); }}>
          <div className="reminder-stat__icon" style={{ background: '#f0fdf4', color: '#059669' }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <p className="reminder-stat__label">Completed</p>
            <p className="reminder-stat__value">{doneCount}</p>
          </div>
        </button>
      </div>

      {/* Type filter */}
      <div className="reminders-filter-bar">
        {[
          { key: 'all',         label: 'All' },
          { key: 'medicine',    label: 'Medicine' },
          { key: 'appointment', label: 'Appointments' },
          { key: 'test',        label: 'Lab Tests' },
          { key: 'other',       label: 'Other' },
        ].map(({ key, label }) => (
          <button key={key}
            className={`share-filter-btn ${filter === key ? 'share-filter-btn--active' : ''}`}
            onClick={() => { setFilter(key); if (key !== 'all') setStatusFilter('all'); }}>
            {label}
            <span className="share-filter-count">
              {key === 'all'
                ? reminders.length
                : key === 'done'
                ? doneCount
                : reminders.filter((r) => r.type === key).length}
            </span>
          </button>
        ))}
        {(filter !== 'all' || statusFilter !== 'all') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilter('all'); setStatusFilter('all'); }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty-state card" style={{ padding: '60px 20px' }}>
          <Bell size={48} />
          <h3>{reminders.length === 0 ? 'No reminders yet' : 'No reminders match this filter'}</h3>
          <p>{reminders.length === 0 ? 'Add medicine schedules, appointments or health tasks' : 'Try a different filter'}</p>
          {reminders.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowForm(true)}>
              <Plus size={15} /> Add First Reminder
            </button>
          )}
        </div>
      ) : (
        <div className="reminders-list">
          {/* Sort: overdue first, then today, then upcoming, then done */}
          {[...filtered]
            .sort((a, b) => {
              const order = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3, done: 4 };
              return (order[getStatus(a)] ?? 5) - (order[getStatus(b)] ?? 5);
            })
            .map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <ReminderForm
          initial={editTarget}
          onSave={handleSave}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};

export default Reminders;
