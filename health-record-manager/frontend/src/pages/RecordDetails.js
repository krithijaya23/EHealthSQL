import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Share2, Edit2, Trash2, FileText,
  User, Building2, Calendar, Pill, Sparkles,
  Save, X, CheckCircle, AlertCircle, Plus,
  FlaskConical, Scan, ClipboardList, Receipt, Activity,
  Heart, TrendingUp, TrendingDown, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './RecordDetails.css';

const TYPE_COLORS = {
  Prescription: '#2563eb', 'Lab Report': '#7c3aed', Scan: '#059669',
  'Discharge Summary': '#d97706', 'Medical Bill': '#0891b2',
  Vaccination: '#db2777', Other: '#64748b',
};
const RECORD_TYPES = ['Prescription', 'Lab Report', 'Scan', 'Discharge Summary', 'Medical Bill', 'Vaccination', 'Other'];

// ─── Reusable info row ────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value, color = 'var(--primary)', fullWidth = false }) => {
  if (!value) return null;
  return (
    <div className={`record-info-row ${fullWidth ? 'record-info-row--full' : ''}`}>
      <div className="record-info-row__icon" style={{ background: color + '18', color }}><Icon size={13} /></div>
      <div>
        <p className="record-info-row__label">{label}</p>
        <p className="record-info-row__value">{value}</p>
      </div>
    </div>
  );
};

// ─── Lab status badge ─────────────────────────────────────────────────────────
const LabStatus = ({ status }) => {
  const map = {
    high: { cls: 'badge-red', icon: TrendingUp },
    low: { cls: 'badge-yellow', icon: TrendingDown },
    normal: { cls: 'badge-green', icon: CheckCircle },
    positive: { cls: 'badge-red', icon: AlertCircle },
    negative: { cls: 'badge-green', icon: CheckCircle },
    borderline: { cls: 'badge-yellow', icon: AlertCircle },
  };
  const cfg = map[status] || { cls: 'badge-gray', icon: Activity };
  const Icon = cfg.icon;
  return <span className={`badge ${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon size={10} /> {status}</span>;
};

// ─── Type-specific structured view ───────────────────────────────────────────
const StructuredView = ({ record, typeColor }) => {
  switch (record.recordType) {

    case 'Lab Report':
      return (
        <>
          <div className="card record-details__section">
            <h3 className="record-details__section-title"><FlaskConical size={15} /> Lab Information</h3>
            <div className="record-info-grid">
              <InfoRow icon={Building2} label="Lab / Diagnostic Centre" value={record.labName || record.hospitalName} color="#7c3aed" />
              <InfoRow icon={User} label="Patient Name" value={record.patientName} color="#2563eb" />
              <InfoRow icon={User} label="Referring Doctor" value={record.doctorName ? `Dr. ${record.doctorName}` : null} color="#2563eb" />
              <InfoRow icon={Calendar} label="Test Date" value={record.visitDate ? format(new Date(record.visitDate), 'MMMM d, yyyy') : null} color="#d97706" />
            </div>
          </div>

          {record.labTests?.length > 0 && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title">
                <FlaskConical size={15} /> Test Results
                <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>{record.labTests.length} tests</span>
              </h3>
              <div className="lab-results-table">
                <div className="lab-results-table__header">
                  <span>Test Name</span><span>Value</span><span>Unit</span><span>Normal Range</span><span>Status</span>
                </div>
                {record.labTests.map((t, i) => (
                  <div key={i} className={`lab-results-table__row ${t.status !== 'normal' ? 'lab-results-table__row--abnormal' : ''}`}>
                    <span className="lab-results-table__name">{t.testName || '—'}</span>
                    <span className="lab-results-table__value" style={{ fontWeight: 700 }}>{t.value || '—'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.unit || '—'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.normalRange || '—'}</span>
                    <span><LabStatus status={t.status || 'normal'} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.impression && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><AlertCircle size={15} /> Impression / Conclusion</h3>
              <div className="record-notes"><p className="record-notes__text">{record.impression}</p></div>
            </div>
          )}
        </>
      );

    case 'Scan':
      return (
        <>
          <div className="card record-details__section">
            <h3 className="record-details__section-title"><Scan size={15} /> Scan Information</h3>
            <div className="record-info-grid">
              <InfoRow icon={Activity} label="Scan Type" value={record.scanType} color="#059669" />
              <InfoRow icon={Heart} label="Body Part / Region" value={record.bodyPart} color="#059669" />
              <InfoRow icon={User} label="Radiologist" value={record.doctorName ? `Dr. ${record.doctorName}` : null} color="#2563eb" />
              <InfoRow icon={Building2} label="Centre" value={record.hospitalName} color="#7c3aed" />
              <InfoRow icon={Calendar} label="Scan Date" value={record.visitDate ? format(new Date(record.visitDate), 'MMMM d, yyyy') : null} color="#d97706" />
            </div>
          </div>

          {record.findings && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><FileText size={15} /> Findings</h3>
              <div className="record-notes"><p className="record-notes__text">{record.findings}</p></div>
            </div>
          )}

          {record.impression && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><CheckCircle size={15} /> Impression</h3>
              <div className="record-notes" style={{ borderLeftColor: '#059669' }}>
                <p className="record-notes__text">{record.impression}</p>
              </div>
            </div>
          )}
        </>
      );

    case 'Discharge Summary':
      return (
        <>
          <div className="card record-details__section">
            <h3 className="record-details__section-title"><ClipboardList size={15} /> Admission Details</h3>
            <div className="record-info-grid">
              <InfoRow icon={Calendar} label="Admission Date" value={record.admissionDate} color="#d97706" />
              <InfoRow icon={Calendar} label="Discharge Date" value={record.dischargeDate} color="#059669" />
              <InfoRow icon={Building2} label="Hospital" value={record.hospitalName} color="#7c3aed" />
              <InfoRow icon={User} label="Attending Doctor" value={record.doctorName ? `Dr. ${record.doctorName}` : null} color="#2563eb" />
              <InfoRow icon={AlertCircle} label="Diagnosis" value={record.diagnosis} color="#ef4444" fullWidth />
              {record.conditionAtDischarge && (
                <InfoRow icon={Heart} label="Condition at Discharge" value={record.conditionAtDischarge} color="#059669" />
              )}
            </div>
          </div>

          {record.treatmentSummary && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><Activity size={15} /> Treatment Summary</h3>
              <div className="record-notes" style={{ borderLeftColor: '#d97706' }}>
                <p className="record-notes__text">{record.treatmentSummary}</p>
              </div>
            </div>
          )}

          {record.dischargeAdvice && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><CheckCircle size={15} /> Discharge Advice</h3>
              <div className="record-notes" style={{ borderLeftColor: '#059669' }}>
                <p className="record-notes__text">{record.dischargeAdvice}</p>
              </div>
            </div>
          )}
        </>
      );

    case 'Medical Bill':
      return (
        <>
          <div className="card record-details__section">
            <h3 className="record-details__section-title"><Receipt size={15} /> Bill Details</h3>
            <div className="record-info-grid">
              <InfoRow icon={Building2} label="Hospital / Clinic" value={record.hospitalName} color="#0891b2" />
              <InfoRow icon={Receipt} label="Bill Number" value={record.billNumber} color="#0891b2" />
              <InfoRow icon={Calendar} label="Date" value={record.visitDate ? format(new Date(record.visitDate), 'MMMM d, yyyy') : null} color="#d97706" />
              <InfoRow icon={TrendingUp} label="Total Amount" value={record.totalAmount ? `₹ ${record.totalAmount}` : null} color="#059669" />
            </div>
          </div>

          {record.lineItems?.length > 0 && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><Receipt size={15} /> Line Items</h3>
              <div className="medicines-table">
                <div className="medicines-table__header" style={{ gridTemplateColumns: '1fr auto' }}>
                  <span>Description</span><span>Amount</span>
                </div>
                {record.lineItems.map((item, i) => (
                  <div key={i} className="medicines-table__row" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span>{item.description}</span>
                    <span style={{ fontWeight: 600 }}>₹ {item.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.notes && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title"><FileText size={15} /> Notes</h3>
              <div className="record-notes"><p className="record-notes__text">{record.notes}</p></div>
            </div>
          )}
        </>
      );

    default: // Prescription, Vaccination, Other
      return (
        <>
          <div className="card record-details__section">
            <h3 className="record-details__section-title"><FileText size={15} /> Medical Information</h3>
            <div className="record-info-grid">
              <InfoRow icon={User} label="Doctor" value={record.doctorName ? `Dr. ${record.doctorName}` : null} color="#2563eb" />
              <InfoRow icon={Building2} label="Hospital / Clinic" value={record.hospitalName} color="#7c3aed" />
              <InfoRow icon={Calendar} label="Visit Date" value={record.visitDate ? format(new Date(record.visitDate), 'MMMM d, yyyy') : null} color="#d97706" />
              <InfoRow icon={AlertCircle} label="Diagnosis" value={record.diagnosis} color="#059669" />
            </div>
            {record.notes && (
              <div className="record-notes" style={{ marginTop: 12 }}>
                <p className="record-notes__label">Doctor's Notes</p>
                <p className="record-notes__text">{record.notes}</p>
              </div>
            )}
          </div>

          {record.medicines?.length > 0 && (
            <div className="card record-details__section">
              <h3 className="record-details__section-title">
                <Pill size={15} /> Prescribed Medicines
                <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{record.medicines.length}</span>
              </h3>
              <div className="medicines-table">
                <div className="medicines-table__header">
                  <span>Medicine</span><span>Dosage</span><span>Frequency</span><span>Duration</span>
                </div>
                {record.medicines.map((med, i) => (
                  <div key={i} className="medicines-table__row">
                    <span className="medicines-table__name">{med.name || '—'}</span>
                    <span>{med.dosage || '—'}</span>
                    <span>{med.frequency || '—'}</span>
                    <span>{med.duration || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      );
  }
};

// ─── Main component ───────────────────────────────────────────────────────────
const RecordDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { fetchRecord(); }, [id]);

  const fetchRecord = async () => {
    try {
      const { data } = await api.get(`/records/detail/${id}`);
      setRecord(data.record);
    } catch {
      toast.error('Record not found');
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    setEditForm({
      recordType: record.recordType,
      doctorName: record.doctorName || '',
      hospitalName: record.hospitalName || '',
      diagnosis: record.diagnosis || '',
      notes: record.notes || '',
      visitDate: record.visitDate ? new Date(record.visitDate).toISOString().split('T')[0] : '',
      medicines: record.medicines?.map((m) => ({ ...m })) || [],
      labName: record.labName || '',
      patientName: record.patientName || '',
      impression: record.impression || '',
      scanType: record.scanType || '',
      bodyPart: record.bodyPart || '',
      findings: record.findings || '',
      admissionDate: record.admissionDate || '',
      dischargeDate: record.dischargeDate || '',
      treatmentSummary: record.treatmentSummary || '',
      dischargeAdvice: record.dischargeAdvice || '',
      conditionAtDischarge: record.conditionAtDischarge || '',
      billNumber: record.billNumber || '',
      totalAmount: record.totalAmount || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        medicines: JSON.stringify(editForm.medicines || []),
        labTests: JSON.stringify(record.labTests || []),
      };
      const { data } = await api.put(`/records/${id}`, payload);
      setRecord(data.record);
      setEditing(false);
      toast.success('Record updated successfully');
    } catch {
      toast.error('Failed to update record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/records/${id}`);
      toast.success('Record deleted');
      navigate('/history');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/records/detail/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const filename = disposition
        ? disposition.split('filename=')[1]?.replace(/"/g, '')
        : `record-${id}.txt`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!record) return null;

  const typeColor = TYPE_COLORS[record.recordType] || '#64748b';

  return (
    <div className="record-details fade-in">
      {/* Header */}
      <div className="record-details__header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="record-details__actions">
          {!editing ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={downloading}>
                {downloading ? <><RefreshCw size={13} className="spin-icon" /> Downloading...</> : <><Download size={13} /> Download Data</>}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/share')}><Share2 size={13} /> Share</button>
              <button className="btn btn-ghost btn-sm" onClick={startEdit}><Edit2 size={13} /> Edit</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} /> Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <><RefreshCw size={13} className="spin-icon" /> Saving...</> : <><Save size={13} /> Save</>}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="record-details__layout">
        <div className="record-details__main">
          {/* Title card */}
          <div className="card record-details__title-card">
            {editing ? (
              <div>
                <label className="form-label">Record Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {RECORD_TYPES.map((t) => (
                    <button key={t} type="button"
                      className={`record-type-btn ${editForm.recordType === t ? 'record-type-btn--active' : ''}`}
                      onClick={() => setEditForm({ ...editForm, recordType: t })}>{t}</button>
                  ))}
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Doctor Name</label>
                    <input className="form-input" value={editForm.doctorName} onChange={(e) => setEditForm({ ...editForm, doctorName: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Hospital</label>
                    <input className="form-input" value={editForm.hospitalName} onChange={(e) => setEditForm({ ...editForm, hospitalName: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Date</label>
                    <input type="date" className="form-input" value={editForm.visitDate} onChange={(e) => setEditForm({ ...editForm, visitDate: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Diagnosis</label>
                    <input className="form-input" value={editForm.diagnosis} onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Notes</label>
                  <textarea className="form-input" rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
              </div>
            ) : (
              <>
                <div className="record-details__type-badge" style={{ background: typeColor + '18', color: typeColor }}>
                  <FileText size={13} /> {record.recordType}
                  {record.ocrProcessed && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}><Sparkles size={9} /> AI Processed</span>}
                </div>
                <h1 className="record-details__title">
                  {record.recordType === 'Lab Report'
                    ? (record.labTests?.[0]?.testName ? `${record.labTests[0].testName} & more` : 'Lab Report')
                    : record.recordType === 'Scan'
                    ? (record.scanType || 'Scan Report')
                    : record.recordType === 'Medical Bill'
                    ? (record.billNumber ? `Bill #${record.billNumber}` : 'Medical Bill')
                    : (record.diagnosis || record.recordType)}
                </h1>
                <div className="record-details__meta-row">
                  {record.doctorName && <div className="record-details__meta-item"><User size={12} /> Dr. {record.doctorName}</div>}
                  {(record.hospitalName || record.labName) && <div className="record-details__meta-item"><Building2 size={12} /> {record.hospitalName || record.labName}</div>}
                  {record.visitDate && <div className="record-details__meta-item"><Calendar size={12} /> {format(new Date(record.visitDate), 'MMMM d, yyyy')}</div>}
                  {record.admissionDate && <div className="record-details__meta-item"><Calendar size={12} /> Admitted: {record.admissionDate}</div>}
                  {record.dischargeDate && <div className="record-details__meta-item"><Calendar size={12} /> Discharged: {record.dischargeDate}</div>}
                </div>
              </>
            )}
          </div>

          {/* Type-specific structured content */}
          {!editing && <StructuredView record={record} typeColor={typeColor} />}

          {/* OCR raw text — collapsed by default */}
          {record.extractedText && (
            <div className="card record-details__section">
              <details>
                <summary className="record-details__section-title" style={{ cursor: 'pointer', listStyle: 'none' }}>
                  <Sparkles size={14} /> Raw OCR Text
                  <span className={`badge ${record.ocrProcessed ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: 'auto' }}>
                    {record.ocrProcessed ? 'Processed' : 'Unprocessed'}
                  </span>
                </summary>
                <pre className="record-details__ocr-text" style={{ marginTop: 12 }}>{record.extractedText}</pre>
              </details>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="record-details__sidebar">
          <div className="card record-details__section">
            <h3 className="record-details__section-title">Record Info</h3>
            <div className="record-details__info-list">
              <div className="record-details__info-item">
                <span className="record-details__info-label">Created</span>
                <span>{format(new Date(record.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="record-details__info-item">
                <span className="record-details__info-label">Updated</span>
                <span>{format(new Date(record.updatedAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="record-details__info-item">
                <span className="record-details__info-label">Type</span>
                <span className="badge" style={{ background: typeColor + '18', color: typeColor }}>{record.recordType}</span>
              </div>
              <div className="record-details__info-item">
                <span className="record-details__info-label">OCR</span>
                <span className={`badge ${record.ocrProcessed ? 'badge-green' : 'badge-gray'}`}>
                  {record.ocrProcessed ? 'Processed' : 'Not processed'}
                </span>
              </div>
              {record.ocrConfidence && (
                <div className="record-details__info-item">
                  <span className="record-details__info-label">Confidence</span>
                  <span className={`badge ${record.ocrConfidence === 'high' ? 'badge-green' : record.ocrConfidence === 'low' ? 'badge-yellow' : 'badge-red'}`}>
                    {record.ocrConfidence}
                  </span>
                </div>
              )}
              {record.medicines?.length > 0 && (
                <div className="record-details__info-item">
                  <span className="record-details__info-label">Medicines</span>
                  <span className="badge badge-blue">{record.medicines.length}</span>
                </div>
              )}
              {record.labTests?.length > 0 && (
                <div className="record-details__info-item">
                  <span className="record-details__info-label">Lab Tests</span>
                  <span className="badge badge-purple">{record.labTests.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordDetails;
