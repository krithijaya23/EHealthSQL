import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, FileText, Calendar, Building2, Pill,
  FlaskConical, Scan, ClipboardList, Receipt, Syringe,
  Upload, Trash2, Clock, Shield, Settings,
  AlertCircle, ChevronRight, Activity, TrendingUp, TrendingDown,
  CheckCircle, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import './ManagedAccount.css';

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  Prescription:        { color: '#2563eb', icon: Pill },
  'Lab Report':        { color: '#7c3aed', icon: FlaskConical },
  Scan:                { color: '#059669', icon: Scan },
  'Discharge Summary': { color: '#d97706', icon: ClipboardList },
  'Medical Bill':      { color: '#0891b2', icon: Receipt },
  Vaccination:         { color: '#db2777', icon: Syringe },
  Other:               { color: '#64748b', icon: FileText },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, photo, size = 44 }) => {
  const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#0891b2'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  if (photo) return (
    <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: size * 0.27, objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.27, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {name?.[0]?.toUpperCase() || 'U'}
    </div>
  );
};

// ─── Lab status badge ─────────────────────────────────────────────────────────
const LabStatus = ({ status }) => {
  const map = {
    high:       { cls: 'badge-red',    icon: TrendingUp },
    low:        { cls: 'badge-yellow', icon: TrendingDown },
    normal:     { cls: 'badge-green',  icon: CheckCircle },
    positive:   { cls: 'badge-red',    icon: AlertCircle },
    negative:   { cls: 'badge-green',  icon: CheckCircle },
    borderline: { cls: 'badge-yellow', icon: AlertCircle },
  };
  const cfg = map[status] || { cls: 'badge-gray', icon: Activity };
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
      <Icon size={9} /> {status}
    </span>
  );
};

// ─── Record card ──────────────────────────────────────────────────────────────
const RecordCard = ({ record, onDelete, onNavigate, canManage }) => {
  const cfg = TYPE_CONFIG[record.recordType] || TYPE_CONFIG.Other;
  const Icon = cfg.icon;
  const color = cfg.color;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this record?')) return;
    setDeleting(true);
    try {
      await api.delete(`/records/${record._id}`);
      toast.success('Record deleted');
      onDelete(record._id);
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="managed-record card" onClick={() => onNavigate(record._id)}>
      <div className="managed-record__icon" style={{ background: color + '18', color }}>
        <Icon size={18} />
      </div>
      <div className="managed-record__body">
        <div className="managed-record__top">
          <h4 className="managed-record__title">{record.diagnosis || record.recordType}</h4>
          <span className="badge" style={{ background: color + '18', color, fontSize: 10 }}>
            {record.recordType}
          </span>
        </div>
        <div className="managed-record__meta">
          {record.doctorName   && <span><User size={11} /> Dr. {record.doctorName}</span>}
          {record.hospitalName && <span><Building2 size={11} /> {record.hospitalName}</span>}
          {record.visitDate    && <span><Calendar size={11} /> {format(new Date(record.visitDate), 'MMM d, yyyy')}</span>}
        </div>
        {record.medicines?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {record.medicines.slice(0, 3).map((m, i) => (
              <span key={i} className="badge badge-gray" style={{ fontSize: 10 }}>{m.name}</span>
            ))}
            {record.medicines.length > 3 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{record.medicines.length - 3}</span>
            )}
          </div>
        )}
        {record.labTests?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {record.labTests.slice(0, 3).map((t, i) => (
              <span key={i} style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {t.testName} <LabStatus status={t.status} />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="managed-record__actions" onClick={(e) => e.stopPropagation()}>
        {canManage && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <RefreshCw size={12} className="spin-icon" /> : <Trash2 size={12} />}
          </button>
        )}
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ManagedAccount = () => {
  const { ownerUserId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null); // { owner, records, accessType, expiryDate }
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/access/managed-account/${ownerUserId}`);
      setData(res);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Access denied or expired');
      navigate('/share');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRecordDeleted = (recordId) => {
    setData((prev) => ({ ...prev, records: prev.records.filter((r) => r._id !== recordId) }));
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" />
    </div>
  );

  if (!data) return null;

  const { owner, records, accessType, expiryDate } = data;
  const canUpload = accessType === 'upload' || accessType === 'manage';
  const canManage = accessType === 'manage';

  const accessBadge = {
    view:   { cls: 'badge-blue',   icon: Shield,   label: 'View Only' },
    upload: { cls: 'badge-purple', icon: Upload,   label: 'View + Upload' },
    manage: { cls: 'badge-red',    icon: Settings, label: 'Full Manage' },
  }[accessType] || { cls: 'badge-gray', icon: Shield, label: accessType };

  return (
    <div className="managed-account fade-in">
      {/* Header */}
      <div className="managed-account__header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/share')}>
          <ArrowLeft size={15} /> Back to Share Access
        </button>
        <div className="managed-account__owner-info">
          <Avatar name={owner.fullName} photo={owner.profilePhoto} size={36} />
          <div>
            <span className="managed-account__owner-name">{owner.fullName}</span>
            <span className="managed-account__owner-email">{owner.email}</span>
          </div>
          <span className={`badge ${accessBadge.cls}`} style={{ marginLeft: 8 }}>
            <accessBadge.icon size={11} /> {accessBadge.label}
          </span>
        </div>
        <div className="managed-account__expiry">
          <Clock size={13} />
          <span>Access expires {formatDistanceToNow(new Date(expiryDate), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Owner info + upload button */}
      <div className="card managed-profile-header">
        <Avatar name={owner.fullName} photo={owner.profilePhoto} size={52} />
        <div style={{ flex: 1 }}>
          <h2>{owner.fullName}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{owner.email}</p>
        </div>
        {canUpload && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/upload?managedOwner=${ownerUserId}`)}>
            <Upload size={13} /> Upload Record
          </button>
        )}
      </div>

      {/* Records */}
      <div className="managed-records-header">
        <h3>Medical Records</h3>
        <span className="badge badge-gray">{records.length}</span>
      </div>

      {records.length === 0 ? (
        <div className="empty-state card" style={{ padding: '40px 20px' }}>
          <FileText size={36} />
          <h3>No records yet</h3>
          <p>{canUpload ? 'Upload the first medical record' : 'No records have been added yet'}</p>
          {canUpload && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => navigate(`/upload?managedOwner=${ownerUserId}`)}>
              <Upload size={14} /> Upload Record
            </button>
          )}
        </div>
      ) : (
        <div className="managed-records-list">
          {records.map((record) => (
            <RecordCard
              key={record._id}
              record={record}
              canManage={canManage}
              onDelete={handleRecordDeleted}
              onNavigate={(id) => navigate(`/history/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ManagedAccount;
