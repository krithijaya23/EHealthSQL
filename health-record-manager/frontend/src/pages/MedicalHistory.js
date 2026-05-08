import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, FileText, Calendar, User, Building2,
  ChevronRight, Upload, FlaskConical, Scan, ClipboardList,
  Receipt, Syringe, Pill, Activity, X
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import api from '../services/api';
import { format } from 'date-fns';
import './MedicalHistory.css';

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  Prescription:       { color: '#2563eb', icon: Pill },
  'Lab Report':       { color: '#7c3aed', icon: FlaskConical },
  Scan:               { color: '#059669', icon: Scan },
  'Discharge Summary':{ color: '#d97706', icon: ClipboardList },
  'Medical Bill':     { color: '#0891b2', icon: Receipt },
  Vaccination:        { color: '#db2777', icon: Syringe },
  Other:              { color: '#64748b', icon: FileText },
};

const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.Other;

// ─── Status badge for lab results ────────────────────────────────────────────
const LabStatusBadge = ({ status }) => {
  const map = { high: 'badge-red', low: 'badge-yellow', normal: 'badge-green', positive: 'badge-red', negative: 'badge-green' };
  return <span className={`badge ${map[status] || 'badge-gray'}`} style={{ fontSize: 10 }}>{status}</span>;
};

// ─── Smart record card — renders differently per document type ────────────────
const RecordCard = ({ record, onClick }) => {
  const cfg = getTypeConfig(record.recordType);
  const Icon = cfg.icon;
  const color = cfg.color;

  // Build the primary title
  const getTitle = () => {
    switch (record.recordType) {
      case 'Lab Report':
        return record.diagnosis || (record.labTests?.length > 0
          ? `${record.labTests[0].testName}${record.labTests.length > 1 ? ` +${record.labTests.length - 1} more` : ''}`
          : record.impression || 'Lab Report');
      case 'Scan':
        return record.scanType || record.findings?.substring(0, 60) || 'Scan Report';
      case 'Discharge Summary':
        return record.diagnosis || 'Discharge Summary';
      case 'Medical Bill':
        return record.billNumber ? `Bill #${record.billNumber}` : 'Medical Bill';
      case 'Vaccination':
        return record.diagnosis || record.medicines?.[0]?.name || 'Vaccination';
      default:
        return record.diagnosis || record.recordType || 'Medical Record';
    }
  };

  // Build secondary info chips
  const getChips = () => {
    switch (record.recordType) {
      case 'Lab Report':
        return (
          <>
            {record.labName && <span className="record-card__meta-item"><Building2 size={11} /> {record.labName}</span>}
            {record.patientName && <span className="record-card__meta-item"><User size={11} /> {record.patientName}</span>}
            {record.visitDate && <span className="record-card__meta-item"><Calendar size={11} /> {format(new Date(record.visitDate), 'MMM d, yyyy')}</span>}
          </>
        );
      case 'Scan':
        return (
          <>
            {record.doctorName && <span className="record-card__meta-item"><User size={11} /> Dr. {record.doctorName}</span>}
            {record.bodyPart && <span className="record-card__meta-item"><Activity size={11} /> {record.bodyPart}</span>}
            {record.visitDate && <span className="record-card__meta-item"><Calendar size={11} /> {format(new Date(record.visitDate), 'MMM d, yyyy')}</span>}
          </>
        );
      case 'Discharge Summary':
        return (
          <>
            {record.hospitalName && <span className="record-card__meta-item"><Building2 size={11} /> {record.hospitalName}</span>}
            {record.admissionDate && <span className="record-card__meta-item"><Calendar size={11} /> Admitted: {record.admissionDate}</span>}
            {record.dischargeDate && <span className="record-card__meta-item"><Calendar size={11} /> Discharged: {record.dischargeDate}</span>}
          </>
        );
      case 'Medical Bill':
        return (
          <>
            {record.hospitalName && <span className="record-card__meta-item"><Building2 size={11} /> {record.hospitalName}</span>}
            {record.totalAmount && <span className="record-card__meta-item"><Receipt size={11} /> Total: {record.totalAmount}</span>}
            {record.visitDate && <span className="record-card__meta-item"><Calendar size={11} /> {format(new Date(record.visitDate), 'MMM d, yyyy')}</span>}
          </>
        );
      default:
        return (
          <>
            {record.doctorName && <span className="record-card__meta-item"><User size={11} /> Dr. {record.doctorName}</span>}
            {record.hospitalName && <span className="record-card__meta-item"><Building2 size={11} /> {record.hospitalName}</span>}
            {record.visitDate && <span className="record-card__meta-item"><Calendar size={11} /> {format(new Date(record.visitDate), 'MMM d, yyyy')}</span>}
          </>
        );
    }
  };

  // Bottom row — type-specific tags
  const getTags = () => {
    switch (record.recordType) {
      case 'Lab Report':
        if (!record.labTests?.length) return null;
        return (
          <div className="record-card__tags">
            {record.labTests.slice(0, 3).map((t, i) => (
              <span key={i} className="record-card__tag" style={{ background: color + '12', color }}>
                {t.testName}
                {t.status && t.status !== 'normal' && <LabStatusBadge status={t.status} />}
              </span>
            ))}
            {record.labTests.length > 3 && <span className="record-card__tag-more">+{record.labTests.length - 3}</span>}
          </div>
        );
      case 'Scan':
        if (!record.impression) return null;
        return (
          <p className="record-card__impression">
            {record.impression.substring(0, 100)}{record.impression.length > 100 ? '...' : ''}
          </p>
        );
      case 'Discharge Summary':
        if (!record.conditionAtDischarge) return null;
        return (
          <span className="record-card__tag" style={{ background: color + '12', color }}>
            Condition: {record.conditionAtDischarge}
          </span>
        );
      default:
        if (!record.medicines?.length) return null;
        return (
          <div className="record-card__tags">
            {record.medicines.slice(0, 3).map((m, i) => (
              <span key={i} className="record-card__tag" style={{ background: color + '12', color }}>{m.name}</span>
            ))}
            {record.medicines.length > 3 && <span className="record-card__tag-more">+{record.medicines.length - 3}</span>}
          </div>
        );
    }
  };

  return (
    <div className="record-card card" onClick={onClick}>
      <div className="record-card__left">
        <div className="record-card__type-dot" style={{ background: color }} />
        <div className="record-card__icon" style={{ background: color + '18', color }}>
          <Icon size={19} />
        </div>
      </div>
      <div className="record-card__body">
        <div className="record-card__header">
          <h3 className="record-card__title">{getTitle()}</h3>
          <span className="badge" style={{ background: color + '18', color, fontSize: 10 }}>
            {record.recordType}
          </span>
        </div>
        <div className="record-card__meta">{getChips()}</div>
        {getTags()}
      </div>
      <ChevronRight size={16} className="record-card__arrow" />
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const MedicalHistory = () => {
  const { activeProfile } = useProfile();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', doctor: '', hospital: '', recordType: '', startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = useCallback(async (page = 1) => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      const params = { page, limit: 10, ...filters };
      // Remove empty params
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get(`/records/${activeProfile._id}`, { params });
      setRecords(data.records);
      setPagination(data.pagination);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeProfile, filters]);

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);

  const clearFilters = () => setFilters({ search: '', doctor: '', hospital: '', recordType: '', startDate: '', endDate: '' });
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="history-page fade-in">
      <div className="page-header">
        <div>
          <h1>Medical History</h1>
          <p>{activeProfile ? `Records for ${activeProfile.profileName}` : 'Select a profile to view records'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/upload')}>
          <Upload size={15} /> Upload Record
        </button>
      </div>

      {/* Search & filter bar */}
      <div className="history-toolbar card">
        <div className="history-search">
          <Search size={15} className="history-search__icon" />
          <input className="history-search__input"
            placeholder="Search by doctor, hospital, diagnosis, test name..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          {filters.search && (
            <button className="history-search__clear" onClick={() => setFilters({ ...filters, search: '' })}><X size={13} /></button>
          )}
        </div>
        <button className={`btn btn-sm ${showFilters ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowFilters(!showFilters)}>
          <Filter size={14} /> Filters {hasActiveFilters && <span className="history-filter-dot" />}
        </button>
      </div>

      {showFilters && (
        <div className="history-filters card">
          <div className="history-filters__grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Document Type</label>
              <select className="form-input" value={filters.recordType} onChange={(e) => setFilters({ ...filters, recordType: e.target.value })}>
                <option value="">All types</option>
                {Object.keys(TYPE_CONFIG).map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Doctor</label>
              <input className="form-input" placeholder="Doctor name" value={filters.doctor}
                onChange={(e) => setFilters({ ...filters, doctor: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Hospital / Lab</label>
              <input className="form-input" placeholder="Hospital or lab name" value={filters.hospital}
                onChange={(e) => setFilters({ ...filters, hospital: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From Date</label>
              <input type="date" className="form-input" value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => fetchRecords(1)}>Apply</button>
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear All</button>
          </div>
        </div>
      )}

      {/* Count */}
      {!loading && (
        <div className="history-count-row">
          <p className="history-count">{pagination.total} record{pagination.total !== 1 ? 's' : ''}</p>
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: 12 }}>
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="records-feed">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : records.length > 0 ? (
          records.map((record) => (
            <RecordCard key={record._id} record={record} onClick={() => navigate(`/history/${record._id}`)} />
          ))
        ) : (
          <div className="empty-state card" style={{ padding: '60px 20px' }}>
            <FileText size={48} />
            <h3>No records found</h3>
            <p>{activeProfile ? 'Upload your first medical record to get started' : 'Please select a profile first'}</p>
            {activeProfile && (
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/upload')}>
                <Upload size={15} /> Upload Record
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="history-pagination">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`pagination-btn ${p === pagination.page ? 'pagination-btn--active' : ''}`}
              onClick={() => fetchRecords(p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicalHistory;
