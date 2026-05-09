import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Pill, Calendar, Trash2, CheckCircle,
  Clock, X, Edit2, Save, AlertCircle,
  Stethoscope, Repeat, Search, Filter, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, isToday, isTomorrow, differenceInHours, parseISO } from 'date-fns';
import './Reminders.css';

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'hrm_reminders';
const load  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const store = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
const genId = () => `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPES = {
  medicine:    { label: 'Medicine',    icon: Pill,        color: '#2563eb', light: '#eff6ff', dark: '#1e40af' },
  appointment: { label: 'Appointment', icon: Stethoscope, color: '#7c3aed', light: '#faf5ff', dark: '#5b21b6' },
  test:        { label: 'Lab Test',    icon: Calendar,    color: '#059669', light: '#f0fdf4', dark: '#065f46' },
  other:       { label: 'Other',       icon: Bell,        color: '#d97706', light: '#fffbeb', dark: '#92400e' },
};

const REPEAT_OPTIONS = [
  { value: 'none',    label: 'No repeat' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const STATUS = {
  done:     { label: 'Completed', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  overdue:  { label: 'Overdue',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  today:    { label: 'Today',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  tomorrow: { label: 'Tomorrow',  color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  upcoming: { label: 'Upcoming',  color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const getStatus = (r) => {
  if (r.done) return 'done';
  const dt = parseISO(`${r.date}T${r.time || '00:00'}`);
  if (isPast(dt))    return 'overdue';
  if (isToday(dt))   return 'today';
  if (isTomorrow(dt)) return 'tomorrow';
  return 'upcoming';
};

const getTimeLabel = (r) => {
  const dt = parseISO(`${r.date}T${r.time || '00:00'}`);
  if (r.done) return `Completed · ${format(dt, 'MMM d, yyyy')}`;
  if (isPast(dt)) {
    const h = Math.abs(differenceInHours(new Date(), dt));
    return h < 24 ? `${h}h overdue` : `${Math.floor(h / 24)}d overdue`;
  }
  if (isToday(dt))    return r.time ? `Today at ${r.time}` : 'Today';
  if (isTomorrow(dt)) return r.time ? `Tomorrow at ${r.time}` : 'Tomorrow';
  return format(dt, 'EEE, MMM d') + (r.time ? ` · ${r.time}` : '');
};

const emptyForm = () => ({
  type: 'medicine', title: '', notes: '',
  date: new Date().toISOString().split('T')[0],
  time: '08:00', repeat: 'none', dosage: '', doctor: '', location: '',
});

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.upcoming;
  return (
    <span className="rm-status-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {status === 'overdue'  && <AlertCircle size={10} />}
      {status === 'today'    && <Clock size={10} />}
      {status === 'done'     && <CheckCircle size={10} />}
      {status === 'tomorrow' && <Calendar size={10} />}
      {status === 'upcoming' && <Clock size={10} />}
      {s.label}
    </span>
  );
};

// ─── Reminder Form ────────────────────────────────────────────────────────────
const ReminderForm = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState(initial || emptyForm());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Please enter a title'); return; }
    if (!form.date)          { toast.error('Please select a date'); return; }
    onSave(form);
  };

  const cfg = TYPES[form.type];
  const TypeIcon = cfg.icon;

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="rm-modal__header" style={{ borderBottom: `3px solid ${cfg.color}` }}>
          <div className="rm-modal__header-left">
            <div className="rm-modal__header-icon" style={{ background: cfg.light, color: cfg.color }}>
              <TypeIcon size={22} />
            </div>
            <div>
              <h2 className="rm-modal__title">{initial ? 'Edit Reminder' : 'New Reminder'}</h2>
              <p className="rm-modal__sub">Fill in the details below</p>
            </div>
          </div>
          <button className="rm-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rm-modal__body">

            {/* Type selector */}
            <div className="rm-field-group">
              <label className="rm-label">Reminder Type</label>
              <div className="rm-type-grid">
                {Object.entries(TYPES).map(([key, t]) => {
                  const TIcon = t.icon;
                  const active = form.type === key;
                  return (
                    <button key={key} type="button"
                      className={`rm-type-btn ${active ? 'rm-type-btn--active' : ''}`}
                      style={active ? { borderColor: t.color, background: t.light, color: t.color } : {}}
                      onClick={() => set('type', key)}>
                      <TIcon size={20} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="rm-field-group">
              <label className="rm-label">
                {form.type === 'medicine' ? 'Medicine Name' : form.type === 'appointment' ? 'Appointment Title' : form.type === 'test' ? 'Test Name' : 'Title'} *
              </label>
              <input className="rm-input" required
                placeholder={
                  form.type === 'medicine'    ? 'e.g. Metformin 500mg' :
                  form.type === 'appointment' ? 'e.g. Cardiology Checkup' :
                  form.type === 'test'        ? 'e.g. Complete Blood Count' :
                  'Reminder title'
                }
                value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>

            {/* Medicine dosage */}
            {form.type === 'medicine' && (
              <div className="rm-field-group">
                <label className="rm-label">Dosage / Instructions</label>
                <input className="rm-input" placeholder="e.g. 1 tablet after food, twice daily"
                  value={form.dosage} onChange={(e) => set('dosage', e.target.value)} />
              </div>
            )}

            {/* Appointment / test fields */}
            {(form.type === 'appointment' || form.type === 'test') && (
              <div className="rm-row">
                <div className="rm-field-group">
                  <label className="rm-label">{form.type === 'test' ? 'Lab / Centre' : 'Doctor'}</label>
                  <input className="rm-input"
                    placeholder={form.type === 'test' ? 'City Diagnostics' : 'Dr. Smith'}
                    value={form.doctor} onChange={(e) => set('doctor', e.target.value)} />
                </div>
                <div className="rm-field-group">
                  <label className="rm-label">Location</label>
                  <input className="rm-input" placeholder="Hospital / Clinic"
                    value={form.location} onChange={(e) => set('location', e.target.value)} />
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="rm-row">
              <div className="rm-field-group">
                <label className="rm-label">Date *</label>
                <input type="date" className="rm-input" required
                  value={form.date} onChange={(e) => set('date', e.target.value)} />
              </div>
              <div className="rm-field-group">
                <label className="rm-label">Time</label>
                <input type="time" className="rm-input"
                  value={form.time} onChange={(e) => set('time', e.target.value)} />
              </div>
            </div>

            {/* Repeat */}
            <div className="rm-field-group">
              <label className="rm-label"><Repeat size={12} style={{ marginRight: 4 }} />Repeat</label>
              <div className="rm-repeat-row">
                {REPEAT_OPTIONS.map((o) => (
                  <button key={o.value} type="button"
                    className={`rm-pill ${form.repeat === o.value ? 'rm-pill--active' : ''}`}
                    style={form.repeat === o.value ? { borderColor: cfg.color, background: cfg.light, color: cfg.color } : {}}
                    onClick={() => set('repeat', o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="rm-field-group">
              <label className="rm-label">Notes <span className="rm-optional">(optional)</span></label>
              <textarea className="rm-input rm-textarea" rows={2}
                placeholder="Any additional notes or instructions..."
                value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>

          </div>

          {/* Footer */}
          <div className="rm-modal__footer">
            <button type="button" className="rm-btn rm-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="rm-btn rm-btn--primary" style={{ background: cfg.color }}>
              <Save size={15} />
              {initial ? 'Update Reminder' : 'Save Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Reminder Card ────────────────────────────────────────────────────────────
const ReminderCard = ({ reminder, onToggle, onEdit, onDelete }) => {
  const cfg    = TYPES[reminder.type] || TYPES.other;
  const Icon   = cfg.icon;
  const status = getStatus(reminder);
  const time   = getTimeLabel(reminder);

  return (
    <div className={`rm-card ${reminder.done ? 'rm-card--done' : ''} ${status === 'overdue' ? 'rm-card--overdue' : ''}`}>
      {/* Left accent bar */}
      <div className="rm-card__accent" style={{ background: reminder.done ? '#e2e8f0' : cfg.color }} />

      {/* Icon */}
      <div className="rm-card__icon" style={{ background: cfg.light, color: cfg.color }}>
        <Icon size={20} />
      </div>

      {/* Content */}
      <div className="rm-card__content">
        <div className="rm-card__top">
          <h3 className="rm-card__title">{reminder.title}</h3>
          <div className="rm-card__badges">
            <span className="rm-type-badge" style={{ color: cfg.color, background: cfg.light }}>
              {cfg.label}
            </span>
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="rm-card__meta">
          <span className="rm-card__time" style={{ color: status === 'overdue' ? '#dc2626' : undefined }}>
            <Clock size={12} /> {time}
          </span>
          {reminder.repeat !== 'none' && (
            <span className="rm-card__repeat">
              <Repeat size={11} /> {REPEAT_OPTIONS.find((o) => o.value === reminder.repeat)?.label}
            </span>
          )}
        </div>

        {/* Extra details */}
        <div className="rm-card__details">
          {reminder.dosage && (
            <span className="rm-card__detail"><Pill size={11} /> {reminder.dosage}</span>
          )}
          {reminder.doctor && (
            <span className="rm-card__detail"><Stethoscope size={11} /> {reminder.doctor}</span>
          )}
          {reminder.location && (
            <span className="rm-card__detail"><MapPin size={11} /> {reminder.location}</span>
          )}
        </div>

        {reminder.notes && (
          <p className="rm-card__notes">{reminder.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="rm-card__actions">
        <button className={`rm-action-btn ${reminder.done ? 'rm-action-btn--done' : ''}`}
          onClick={() => onToggle(reminder.id)}
          title={reminder.done ? 'Mark as pending' : 'Mark as done'}>
          <CheckCircle size={16} />
        </button>
        <button className="rm-action-btn" onClick={() => onEdit(reminder)} title="Edit">
          <Edit2 size={15} />
        </button>
        <button className="rm-action-btn rm-action-btn--delete" onClick={() => onDelete(reminder.id)} title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Reminders = () => {
  const [reminders,    setReminders]    = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { setReminders(load()); }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      reminders.forEach((r) => {
        if (r.done || r.notified) return;
        const dt   = parseISO(`${r.date}T${r.time || '00:00'}`);
        const diff = Math.abs(now - dt) / 60000;
        if (diff <= 1 && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`Reminder: ${r.title}`, {
            body: r.dosage || r.doctor || r.notes || TYPES[r.type]?.label || '',
            icon: '/favicon.ico',
          });
          setReminders((prev) => {
            const updated = prev.map((x) => x.id === r.id ? { ...x, notified: true } : x);
            store(updated);
            return updated;
          });
        }
      });
    };
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [reminders]);

  const persist = useCallback((list) => { setReminders(list); store(list); }, []);

  const handleSave = (form) => {
    if (editTarget) {
      persist(reminders.map((r) => r.id === editTarget.id ? { ...r, ...form, notified: false } : r));
      toast.success('Reminder updated');
    } else {
      persist([{ ...form, id: genId(), done: false, notified: false, createdAt: new Date().toISOString() }, ...reminders]);
      toast.success('Reminder added');
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleToggle = (id) => persist(reminders.map((r) => r.id === id ? { ...r, done: !r.done } : r));
  const handleEdit   = (r)  => { setEditTarget(r); setShowForm(true); };
  const handleDelete = (id) => {
    if (!window.confirm('Delete this reminder?')) return;
    persist(reminders.filter((r) => r.id !== id));
    toast.success('Reminder deleted');
  };

  // Stats
  const overdueCount  = reminders.filter((r) => !r.done && getStatus(r) === 'overdue').length;
  const todayCount    = reminders.filter((r) => !r.done && getStatus(r) === 'today').length;
  const upcomingCount = reminders.filter((r) => !r.done && (getStatus(r) === 'upcoming' || getStatus(r) === 'tomorrow')).length;
  const doneCount     = reminders.filter((r) => r.done).length;

  // Filter + search
  const filtered = reminders
    .filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter === 'done'     && !r.done) return false;
      if (statusFilter === 'overdue'  && (r.done || getStatus(r) !== 'overdue'))  return false;
      if (statusFilter === 'today'    && (r.done || getStatus(r) !== 'today'))    return false;
      if (statusFilter === 'upcoming' && (r.done || !['upcoming','tomorrow'].includes(getStatus(r)))) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.doctor?.toLowerCase().includes(q) ||
          r.location?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q) ||
          r.dosage?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const order = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3, done: 4 };
      return (order[getStatus(a)] ?? 5) - (order[getStatus(b)] ?? 5);
    });

  return (
    <div className="rm-page fade-in">

      {/* ── Page header ── */}
      <div className="rm-page-header">
        <div>
          <h1 className="rm-page-title">Reminders</h1>
          <p className="rm-page-sub">Medicine schedules, appointments and health tasks</p>
        </div>
        <button className="rm-btn rm-btn--primary" onClick={() => { setEditTarget(null); setShowForm(true); }}>
          <Plus size={16} /> Add Reminder
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="rm-stats">
        {[
          { key: 'overdue',  label: 'Overdue',   value: overdueCount,  icon: AlertCircle, color: '#dc2626', bg: '#fef2f2' },
          { key: 'today',    label: 'Today',      value: todayCount,    icon: Clock,       color: '#d97706', bg: '#fffbeb' },
          { key: 'upcoming', label: 'Upcoming',   value: upcomingCount, icon: Calendar,    color: '#2563eb', bg: '#eff6ff' },
          { key: 'done',     label: 'Completed',  value: doneCount,     icon: CheckCircle, color: '#059669', bg: '#f0fdf4' },
        ].map(({ key, label, value, icon: Icon, color, bg }) => (
          <button key={key}
            className={`rm-stat-card ${statusFilter === key ? 'rm-stat-card--active' : ''}`}
            style={statusFilter === key ? { borderColor: color } : {}}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}>
            <div className="rm-stat-icon" style={{ background: bg, color }}>
              <Icon size={18} />
            </div>
            <div>
              <p className="rm-stat-label">{label}</p>
              <p className="rm-stat-value" style={{ color: key === 'overdue' && value > 0 ? color : undefined }}>
                {value}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Toolbar: search + filters ── */}
      <div className="rm-toolbar card">
        <div className="rm-search">
          <Search size={15} className="rm-search-icon" />
          <input className="rm-search-input"
            placeholder="Search reminders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button className="rm-search-clear" onClick={() => setSearch('')}><X size={13} /></button>
          )}
        </div>

        <div className="rm-filters">
          <div className="rm-filter-group">
            <Filter size={13} />
            <select className="rm-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(TYPES).map(([k, t]) => (
                <option key={k} value={k}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="rm-filter-group">
            <Clock size={13} />
            <select className="rm-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="done">Completed</option>
            </select>
          </div>
          {(typeFilter !== 'all' || statusFilter !== 'all' || search) && (
            <button className="rm-btn rm-btn--ghost rm-btn--sm"
              onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Inline form ── */}
      {showForm && (
        <ReminderForm
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* ── Results count ── */}
      {!showForm && reminders.length > 0 && (
        <p className="rm-count">
          {filtered.length} reminder{filtered.length !== 1 ? 's' : ''}
          {(typeFilter !== 'all' || statusFilter !== 'all' || search) ? ' matching filters' : ''}
        </p>
      )}

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className="rm-empty card">
          <div className="rm-empty__icon"><Bell size={40} /></div>
          <h3 className="rm-empty__title">
            {reminders.length === 0 ? 'No reminders yet' : 'No reminders match your filters'}
          </h3>
          <p className="rm-empty__sub">
            {reminders.length === 0
              ? 'Add medicine schedules, appointments or health tasks to stay on track'
              : 'Try adjusting your search or filters'}
          </p>
          {reminders.length === 0 && (
            <button className="rm-btn rm-btn--primary" style={{ marginTop: 20 }}
              onClick={() => { setEditTarget(null); setShowForm(true); }}>
              <Plus size={15} /> Add First Reminder
            </button>
          )}
        </div>
      ) : (
        <div className="rm-list">
          {filtered.map((r) => (
            <ReminderCard key={r.id} reminder={r}
              onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

    </div>
  );
};

export default Reminders;
