import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, Image as ImageIcon, X, CheckCircle, Loader,
  Sparkles, Save, Plus, Trash2, AlertCircle, User, Building2,
  Calendar, Pill, FileSearch, RefreshCw, FlaskConical, Scan,
  ClipboardList, Receipt, Syringe, Activity
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import './UploadRecord.css';

// ─── Document type config ─────────────────────────────────────────────────────
const DOC_TYPES = [
  { id: 'Prescription',      label: 'Prescription',      icon: Pill,          color: '#2563eb' },
  { id: 'Lab Report',        label: 'Lab Report',         icon: FlaskConical,  color: '#7c3aed' },
  { id: 'Scan',              label: 'Scan / Radiology',   icon: Scan,          color: '#059669' },
  { id: 'Discharge Summary', label: 'Discharge Summary',  icon: ClipboardList, color: '#d97706' },
  { id: 'Medical Bill',      label: 'Medical Bill',       icon: Receipt,       color: '#0891b2' },
  { id: 'Vaccination',       label: 'Vaccination',        icon: Syringe,       color: '#db2777' },
  { id: 'Other',             label: 'Other',              icon: FileText,      color: '#64748b' },
];

const TYPE_COLOR = Object.fromEntries(DOC_TYPES.map((t) => [t.id, t.color]));

// ─── Confidence badge ─────────────────────────────────────────────────────────
const ConfidenceBadge = ({ confidence }) => {
  const map = { high: ['badge-green', 'High Confidence'], low: ['badge-yellow', 'Low Confidence'], none: ['badge-red', 'No Text Found'] };
  const [cls, label] = map[confidence] || map.none;
  return <span className={`badge ${cls}`}><Sparkles size={11} /> {label}</span>;
};

// ─── Detected type badge ──────────────────────────────────────────────────────
const DetectedTypeBadge = ({ type }) => {
  const cfg = DOC_TYPES.find((t) => t.id === type) || DOC_TYPES[DOC_TYPES.length - 1];
  const Icon = cfg.icon;
  return (
    <span className="detected-type-badge" style={{ background: cfg.color + '18', color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      <Icon size={12} /> AI detected: {cfg.label}
    </span>
  );
};

// ─── Status badge for lab results ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = { high: 'badge-red', low: 'badge-yellow', normal: 'badge-green', positive: 'badge-red', negative: 'badge-green', borderline: 'badge-yellow' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
};

// ─── Extracted preview field ──────────────────────────────────────────────────
const PreviewField = ({ icon: Icon, label, value, color }) => {
  if (!value) return null;
  return (
    <div className="extracted-field">
      <div className="extracted-field__icon" style={{ background: color + '18', color }}><Icon size={13} /></div>
      <div>
        <p className="extracted-field__label">{label}</p>
        <p className="extracted-field__value">{String(value).substring(0, 80)}</p>
      </div>
    </div>
  );
};

// ─── Dynamic form sections ────────────────────────────────────────────────────

// Prescription form
const PrescriptionForm = ({ form, setForm }) => {
  const addMed = () => setForm((p) => ({ ...p, medicines: [...p.medicines, { name: '', dosage: '', frequency: '', duration: '' }] }));
  const updMed = (i, f, v) => setForm((p) => { const m = [...p.medicines]; m[i] = { ...m[i], [f]: v }; return { ...p, medicines: m }; });
  const remMed = (i) => setForm((p) => ({ ...p, medicines: p.medicines.filter((_, j) => j !== i) }));

  return (
    <>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Doctor Name</label>
          <input className="form-input" placeholder="Dr. Smith" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Hospital / Clinic</label>
          <input className="form-input" placeholder="City Hospital" value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Visit Date</label>
          <input type="date" className="form-input" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Diagnosis</label>
          <input className="form-input" placeholder="e.g. Hypertension" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
        </div>
      </div>

      <div className="form-group">
        <div className="upload-medicines-header">
          <label className="form-label" style={{ marginBottom: 0 }}>
            <Pill size={13} /> Medicines {form.medicines.length > 0 && <span className="badge badge-blue" style={{ marginLeft: 6 }}>{form.medicines.length}</span>}
          </label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addMed}><Plus size={12} /> Add</button>
        </div>
        {form.medicines.length === 0 ? (
          <div className="upload-medicines-empty"><Pill size={18} /><p>No medicines yet</p><button type="button" className="btn btn-ghost btn-sm" onClick={addMed}>+ Add Medicine</button></div>
        ) : (
          <div className="medicines-list">
            <div className="medicines-list__header"><span>Name</span><span>Dosage</span><span>Frequency</span><span>Duration</span><span /></div>
            {form.medicines.map((m, i) => (
              <div key={i} className="medicine-row">
                <input className="form-input" placeholder="Medicine" value={m.name} onChange={(e) => updMed(i, 'name', e.target.value)} />
                <input className="form-input" placeholder="500mg" value={m.dosage} onChange={(e) => updMed(i, 'dosage', e.target.value)} />
                <input className="form-input" placeholder="Twice daily" value={m.frequency} onChange={(e) => updMed(i, 'frequency', e.target.value)} />
                <input className="form-input" placeholder="7 days" value={m.duration} onChange={(e) => updMed(i, 'duration', e.target.value)} />
                <button type="button" className="btn btn-danger btn-sm medicine-remove" onClick={() => remMed(i)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Doctor's Notes</label>
        <textarea className="form-input" rows={3} placeholder="Instructions, follow-up..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </>
  );
};

// Lab Report form
const LabReportForm = ({ form, setForm }) => {
  const addTest = () => setForm((p) => ({ ...p, labTests: [...p.labTests, { testName: '', value: '', unit: '', normalRange: '', status: 'normal' }] }));
  const updTest = (i, f, v) => setForm((p) => { const t = [...p.labTests]; t[i] = { ...t[i], [f]: v }; return { ...p, labTests: t }; });
  const remTest = (i) => setForm((p) => ({ ...p, labTests: p.labTests.filter((_, j) => j !== i) }));

  return (
    <>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Lab / Diagnostic Centre</label>
          <input className="form-input" placeholder="City Diagnostics" value={form.labName} onChange={(e) => setForm({ ...form, labName: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Patient Name</label>
          <input className="form-input" placeholder="Patient full name" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Test Date</label>
          <input type="date" className="form-input" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Referring Doctor</label>
          <input className="form-input" placeholder="Dr. Smith" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
        </div>
      </div>

      <div className="form-group">
        <div className="upload-medicines-header">
          <label className="form-label" style={{ marginBottom: 0 }}>
            <FlaskConical size={13} /> Test Results {form.labTests.length > 0 && <span className="badge badge-purple" style={{ marginLeft: 6 }}>{form.labTests.length}</span>}
          </label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addTest}><Plus size={12} /> Add Test</button>
        </div>
        {form.labTests.length === 0 ? (
          <div className="upload-medicines-empty"><FlaskConical size={18} /><p>No test results yet</p><button type="button" className="btn btn-ghost btn-sm" onClick={addTest}>+ Add Test</button></div>
        ) : (
          <div className="medicines-list">
            <div className="medicines-list__header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr 32px' }}>
              <span>Test Name</span><span>Value</span><span>Unit</span><span>Normal Range</span><span>Status</span><span />
            </div>
            {form.labTests.map((t, i) => (
              <div key={i} className="medicine-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr 32px' }}>
                <input className="form-input" placeholder="Haemoglobin" value={t.testName} onChange={(e) => updTest(i, 'testName', e.target.value)} />
                <input className="form-input" placeholder="13.5" value={t.value} onChange={(e) => updTest(i, 'value', e.target.value)} />
                <input className="form-input" placeholder="g/dL" value={t.unit} onChange={(e) => updTest(i, 'unit', e.target.value)} />
                <input className="form-input" placeholder="12.0-16.0" value={t.normalRange} onChange={(e) => updTest(i, 'normalRange', e.target.value)} />
                <select className="form-input" value={t.status} onChange={(e) => updTest(i, 'status', e.target.value)}>
                  {['normal', 'high', 'low', 'positive', 'negative', 'borderline'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <button type="button" className="btn btn-danger btn-sm medicine-remove" onClick={() => remTest(i)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Impression / Conclusion</label>
        <textarea className="form-input" rows={3} placeholder="Overall lab impression..." value={form.impression} onChange={(e) => setForm({ ...form, impression: e.target.value })} />
      </div>
    </>
  );
};

// Scan / Radiology form
const ScanForm = ({ form, setForm }) => (
  <>
    <div className="grid-2">
      <div className="form-group">
        <label className="form-label">Scan Type</label>
        <input className="form-input" placeholder="e.g. Chest X-Ray, Abdominal USG" value={form.scanType} onChange={(e) => setForm({ ...form, scanType: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Body Part / Region</label>
        <input className="form-input" placeholder="e.g. Chest, Abdomen" value={form.bodyPart} onChange={(e) => setForm({ ...form, bodyPart: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Radiologist / Doctor</label>
        <input className="form-input" placeholder="Dr. Smith" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Scan Date</label>
        <input type="date" className="form-input" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Hospital / Centre</label>
        <input className="form-input" placeholder="City Radiology" value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
      </div>
    </div>
    <div className="form-group">
      <label className="form-label">Findings</label>
      <textarea className="form-input" rows={4} placeholder="Detailed scan findings..." value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} />
    </div>
    <div className="form-group">
      <label className="form-label">Impression / Conclusion</label>
      <textarea className="form-input" rows={3} placeholder="Radiologist's impression..." value={form.impression} onChange={(e) => setForm({ ...form, impression: e.target.value })} />
    </div>
  </>
);

// Discharge Summary form
const DischargeForm = ({ form, setForm }) => (
  <>
    <div className="grid-2">
      <div className="form-group">
        <label className="form-label">Admission Date</label>
        <input type="date" className="form-input" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Discharge Date</label>
        <input type="date" className="form-input" value={form.dischargeDate} onChange={(e) => setForm({ ...form, dischargeDate: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Hospital</label>
        <input className="form-input" placeholder="City Hospital" value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Attending Doctor</label>
        <input className="form-input" placeholder="Dr. Smith" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
      </div>
    </div>
    <div className="form-group">
      <label className="form-label">Diagnosis</label>
      <input className="form-input" placeholder="Final diagnosis" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
    </div>
    <div className="form-group">
      <label className="form-label">Treatment Summary</label>
      <textarea className="form-input" rows={4} placeholder="Treatment given during hospital stay..." value={form.treatmentSummary} onChange={(e) => setForm({ ...form, treatmentSummary: e.target.value })} />
    </div>
    <div className="form-group">
      <label className="form-label">Condition at Discharge</label>
      <input className="form-input" placeholder="e.g. Stable, Improved" value={form.conditionAtDischarge} onChange={(e) => setForm({ ...form, conditionAtDischarge: e.target.value })} />
    </div>
    <div className="form-group">
      <label className="form-label">Discharge Advice / Follow-up</label>
      <textarea className="form-input" rows={3} placeholder="Instructions after discharge..." value={form.dischargeAdvice} onChange={(e) => setForm({ ...form, dischargeAdvice: e.target.value })} />
    </div>
  </>
);

// Medical Bill form
const BillForm = ({ form, setForm }) => (
  <>
    <div className="grid-2">
      <div className="form-group">
        <label className="form-label">Hospital / Clinic</label>
        <input className="form-input" placeholder="City Hospital" value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Bill Number</label>
        <input className="form-input" placeholder="INV-2024-001" value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Bill Date</label>
        <input type="date" className="form-input" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Total Amount</label>
        <input className="form-input" placeholder="e.g. 5000" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
      </div>
    </div>
    <div className="form-group">
      <label className="form-label">Notes</label>
      <textarea className="form-input" rows={3} placeholder="Payment notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
    </div>
  </>
);

// ─── Dynamic form router ──────────────────────────────────────────────────────
const DynamicForm = ({ recordType, form, setForm }) => {
  switch (recordType) {
    case 'Lab Report':        return <LabReportForm form={form} setForm={setForm} />;
    case 'Scan':              return <ScanForm form={form} setForm={setForm} />;
    case 'Discharge Summary': return <DischargeForm form={form} setForm={setForm} />;
    case 'Medical Bill':      return <BillForm form={form} setForm={setForm} />;
    default:                  return <PrescriptionForm form={form} setForm={setForm} />;
  }
};

// ─── Empty form state per type ────────────────────────────────────────────────
const emptyForm = (profileId, type = 'Prescription') => ({
  profileId: profileId || '',
  recordType: type,
  visitDate: new Date().toISOString().split('T')[0],
  // Common
  doctorName: '', hospitalName: '', diagnosis: '', notes: '',
  // Prescription
  medicines: [],
  // Lab
  labName: '', patientName: '', labTests: [], impression: '',
  // Scan
  scanType: '', bodyPart: '', findings: '',
  // Discharge
  admissionDate: '', dischargeDate: '', treatmentSummary: '', dischargeAdvice: '', conditionAtDischarge: '',
  // Bill
  billNumber: '', totalAmount: '', lineItems: [],
});

// ─── Main UploadRecord component ─────────────────────────────────────────────
const UploadRecord = () => {
  const { profiles, activeProfile } = useProfile();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('idle'); // idle | extracting | review | saving
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [form, setForm] = useState(emptyForm(activeProfile?._id));

  // ── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected?.length > 0) { toast.error('File too large or unsupported. Max 10MB, JPG/PNG/PDF.'); return; }
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setPhase('idle');
    setOcrResult(null);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
  });

  // ── Phase 1: OCR Extract ────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    if (!form.profileId) { toast.error('Please select a profile first'); return; }
    setPhase('extracting');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('recordType', form.recordType);
      const { data } = await api.post('/records/ocr-extract', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const ext = data.extracted;
      setOcrResult(ext);

      // Auto-update record type if AI detected something different
      const detectedType = ext.documentType || form.recordType;

      setForm((prev) => ({
        ...prev,
        recordType: detectedType,
        doctorName: ext.doctorName || prev.doctorName,
        hospitalName: ext.hospitalName || prev.hospitalName,
        diagnosis: ext.diagnosis || prev.diagnosis,
        notes: ext.notes || prev.notes,
        visitDate: ext.visitDate ? tryParseDate(ext.visitDate) : prev.visitDate,
        medicines: ext.medicines?.length > 0 ? ext.medicines : prev.medicines,
        labName: ext.labName || prev.labName,
        patientName: ext.patientName || prev.patientName,
        labTests: ext.labTests?.length > 0 ? ext.labTests : prev.labTests,
        impression: ext.impression || prev.impression,
        scanType: ext.scanType || prev.scanType,
        bodyPart: ext.bodyPart || prev.bodyPart,
        findings: ext.findings || prev.findings,
        admissionDate: ext.admissionDate || prev.admissionDate,
        dischargeDate: ext.dischargeDate || prev.dischargeDate,
        treatmentSummary: ext.treatmentSummary || prev.treatmentSummary,
        dischargeAdvice: ext.dischargeAdvice || prev.dischargeAdvice,
        conditionAtDischarge: ext.conditionAtDischarge || prev.conditionAtDischarge,
        billNumber: ext.billNumber || prev.billNumber,
        totalAmount: ext.totalAmount || prev.totalAmount,
        lineItems: ext.lineItems?.length > 0 ? ext.lineItems : prev.lineItems,
      }));

      setPhase('review');
      if (ext.ocrConfidence === 'none') {
        toast('No text detected. Fill in the details manually.', { icon: '⚠️' });
      } else {
        toast.success(`AI detected: ${detectedType} — review and save`);
      }
    } catch (err) {
      setPhase('idle');
      toast.error(err.response?.data?.message || 'Extraction failed. Please try again.');
    }
  };

  // ── Phase 2: Save ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.profileId) { toast.error('Please select a profile'); return; }
    setPhase('saving');
    try {
      const fd = new FormData();
      // Include extracted text from OCR if available
      if (ocrResult?.extractedText) fd.append('extractedText', ocrResult.extractedText);
      // Append all form fields
      const jsonFields = ['medicines', 'labTests', 'lineItems'];
      Object.entries(form).forEach(([k, v]) => {
        if (jsonFields.includes(k)) fd.append(k, JSON.stringify(v));
        else if (v !== undefined && v !== null) fd.append(k, v);
      });
      const { data } = await api.post('/records/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Record saved successfully');
      navigate(`/history/${data.record._id}`);
    } catch (err) {
      setPhase('review');
      toast.error(err.response?.data?.message || 'Failed to save record');
    }
  };

  const resetAll = () => {
    setFile(null); setFilePreview(null); setOcrResult(null);
    setPhase('idle');
    setForm(emptyForm(activeProfile?._id));
  };

  const isExtracting = phase === 'extracting';
  const isSaving = phase === 'saving';
  const isReview = phase === 'review';
  const activeType = DOC_TYPES.find((t) => t.id === form.recordType) || DOC_TYPES[DOC_TYPES.length - 1];

  return (
    <div className="upload-page fade-in">
      <div className="page-header">
        <div>
          <h1>Upload Medical Record</h1>
          <p>AI automatically detects document type and extracts structured data</p>
        </div>
        {(file || isReview) && (
          <button className="btn btn-ghost btn-sm" onClick={resetAll}><RefreshCw size={14} /> Start Over</button>
        )}
      </div>

      {/* Progress steps */}
      <div className="upload-steps">
        <div className={`upload-step ${file ? 'upload-step--done' : 'upload-step--active'}`}>
          <div className="upload-step__num">{file ? <CheckCircle size={14} /> : '1'}</div>
          <span>Upload File</span>
        </div>
        <div className="upload-step__line" />
        <div className={`upload-step ${isReview || isSaving ? 'upload-step--done' : isExtracting ? 'upload-step--active' : ''}`}>
          <div className="upload-step__num">{isReview || isSaving ? <CheckCircle size={14} /> : isExtracting ? <Loader size={14} className="spin-icon" /> : '2'}</div>
          <span>AI Detection</span>
        </div>
        <div className="upload-step__line" />
        <div className={`upload-step ${isSaving ? 'upload-step--active' : ''}`}>
          <div className="upload-step__num">{isSaving ? <Loader size={14} className="spin-icon" /> : '3'}</div>
          <span>Review & Save</span>
        </div>
      </div>

      <div className="upload-layout">
        {/* ── Left: upload + type selector ────────────────────────────────── */}
        <div className="upload-left">
          <div className="card upload-card">
            <h3 className="upload-card__title"><Upload size={17} /> File Upload</h3>

            {/* Profile */}
            <div className="form-group">
              <label className="form-label">Profile *</label>
              <select className="form-input" value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })}>
                <option value="">Choose a profile...</option>
                {profiles.map((p) => <option key={p._id} value={p._id}>{p.profileName}{p.actualName ? ` (${p.actualName})` : ''} · {p.relationship}</option>)}
              </select>
            </div>

            {/* Document type selector */}
            <div className="form-group">
              <label className="form-label">Document Type {isReview && ocrResult && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(AI auto-detected)</span>}</label>
              <div className="doc-type-grid">
                {DOC_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = form.recordType === t.id;
                  return (
                    <button key={t.id} type="button"
                      className={`doc-type-btn ${active ? 'doc-type-btn--active' : ''}`}
                      style={active ? { borderColor: t.color, background: t.color + '12', color: t.color } : {}}
                      onClick={() => setForm({ ...form, recordType: t.id })}>
                      <Icon size={14} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropzone or preview */}
            {!isReview ? (
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'dropzone--active' : ''} ${file ? 'dropzone--has-file' : ''}`}>
                <input {...getInputProps()} />
                {file ? (
                  <div className="dropzone__file">
                    {file.type.startsWith('image') ? <ImageIcon size={26} /> : <FileText size={26} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="dropzone__filename">{file.name}</p>
                      <p className="dropzone__filesize">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button type="button" className="dropzone__remove" onClick={(e) => { e.stopPropagation(); setFile(null); setFilePreview(null); setPhase('idle'); }}><X size={15} /></button>
                  </div>
                ) : (
                  <div className="dropzone__placeholder">
                    <div className="dropzone__icon"><Upload size={26} /></div>
                    <p className="dropzone__text">{isDragActive ? 'Drop here' : 'Drag & drop or click to upload'}</p>
                    <p className="dropzone__hint">JPG, PNG, PDF · Max 10MB</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="upload-file-preview">
                {filePreview
                  ? <img src={filePreview} alt="Document" className="upload-preview-img" />
                  : <div className="upload-preview-pdf"><FileText size={32} /><p>{file?.name}</p></div>}
              </div>
            )}

            {/* Extract button */}
            {!isReview && (
              <button type="button"
                className={`btn upload-ai-btn ${isExtracting ? 'upload-ai-btn--loading' : 'btn-primary'}`}
                onClick={handleExtract} disabled={!file || isExtracting}>
                {isExtracting
                  ? <><Loader size={17} className="spin-icon" /> Detecting &amp; Extracting...</>
                  : <><FileSearch size={17} /> Detect Type &amp; Extract</>}
              </button>
            )}

            {/* OCR result summary */}
            {isReview && ocrResult && (
              <div className="ocr-preview">
                <div className="ocr-preview__header">
                  <Activity size={13} />
                  <span>Extraction Summary</span>
                  <ConfidenceBadge confidence={ocrResult.ocrConfidence} />
                </div>
                {ocrResult.documentType && <DetectedTypeBadge type={ocrResult.documentType} />}
                <div className="ocr-preview__fields" style={{ marginTop: 10 }}>
                  <PreviewField icon={User} label="Doctor" value={ocrResult.doctorName} color="#2563eb" />
                  <PreviewField icon={Building2} label="Hospital/Lab" value={ocrResult.hospitalName || ocrResult.labName} color="#7c3aed" />
                  <PreviewField icon={AlertCircle} label="Diagnosis" value={ocrResult.diagnosis} color="#059669" />
                  <PreviewField icon={Calendar} label="Date" value={ocrResult.visitDate || ocrResult.admissionDate} color="#d97706" />
                  {ocrResult.medicines?.length > 0 && <PreviewField icon={Pill} label="Medicines" value={`${ocrResult.medicines.length} extracted`} color="#db2777" />}
                  {ocrResult.labTests?.length > 0 && <PreviewField icon={FlaskConical} label="Lab Tests" value={`${ocrResult.labTests.length} results`} color="#7c3aed" />}
                  {ocrResult.findings && <PreviewField icon={Scan} label="Findings" value={ocrResult.findings} color="#059669" />}
                  {ocrResult.totalAmount && <PreviewField icon={Receipt} label="Total Amount" value={ocrResult.totalAmount} color="#0891b2" />}
                </div>
                {ocrResult.extractedText && (
                  <details className="ocr-raw-text">
                    <summary>View raw OCR text</summary>
                    <pre>{ocrResult.extractedText.substring(0, 500)}{ocrResult.extractedText.length > 500 ? '...' : ''}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: dynamic form ──────────────────────────────────────────── */}
        <div className="upload-right">
          <form onSubmit={handleSave} className="card upload-form-card">
            <div className="upload-form-card__header">
              <h3 className="upload-card__title" style={{ color: activeType.color }}>
                <activeType.icon size={17} /> {activeType.label} Details
              </h3>
              {isReview && <span className="badge badge-green"><CheckCircle size={11} /> AI Filled</span>}
            </div>

            <DynamicForm recordType={form.recordType} form={form} setForm={setForm} />

            <div className="upload-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/history')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving || !form.profileId}
                style={{ background: activeType.color }}>
                {isSaving ? <><Loader size={15} className="spin-icon" /> Saving...</> : <><Save size={15} /> Save {activeType.label}</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const tryParseDate = (str) => {
  if (!str) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  return isNaN(d) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
};

export default UploadRecord;
