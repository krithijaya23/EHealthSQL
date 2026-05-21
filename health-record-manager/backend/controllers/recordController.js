const { callProcedure } = require('../config/db');
const { runOCR }        = require('../services/ocrService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const parseJSON = (str, fallback = []) => {
  if (!str) return fallback;
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str); } catch { return fallback; }
};

// Convert a DB row (snake_case) to the camelCase shape the frontend expects
const normaliseRecord = (row) => {
  if (!row) return null;
  return {
    _id:                  row.id,
    id:                   row.id,
    ownerUserId:          row.owner_user_id,
    uploadedByUserId:     row.uploaded_by_user_id,
    recordType:           row.record_type,
    doctorName:           row.doctor_name,
    hospitalName:         row.hospital_name,
    diagnosis:            row.diagnosis,
    notes:                row.notes,
    visitDate:            row.visit_date,
    labName:              row.lab_name,
    patientName:          row.patient_name,
    impression:           row.impression,
    scanType:             row.scan_type,
    bodyPart:             row.body_part,
    findings:             row.findings,
    admissionDate:        row.admission_date,
    dischargeDate:        row.discharge_date,
    treatmentSummary:     row.treatment_summary,
    dischargeAdvice:      row.discharge_advice,
    conditionAtDischarge: row.condition_at_discharge,
    billNumber:           row.bill_number,
    totalAmount:          row.total_amount,
    extractedText:        row.extracted_text,
    ocrProcessed:         !!row.ocr_processed,
    ocrConfidence:        row.ocr_confidence,
    aiPatientSummary:     row.ai_patient_summary,
    aiDoctorSummary:      row.ai_doctor_summary,
    isDeleted:            !!row.is_deleted,
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
    medicines:  safeParseJson(row.medicines_json,  []),
    labTests:   safeParseJson(row.lab_tests_json,  []),
    lineItems:  safeParseJson(row.bill_items_json, []),
  };
};

const safeParseJson = (val, fallback) => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

// ─── Helper: check read/write access to a record ─────────────────────────────
const canAccessRecord = async (record, userId, userEmail, requireWrite = false) => {
  if (record.ownerUserId === userId || record.owner_user_id === userId) return true;

  const ownerId = record.ownerUserId || record.owner_user_id;
  const proc    = requireWrite ? 'CheckUploadAccess' : 'CheckAccountAccess';
  const results = await callProcedure(proc, [ownerId, userEmail, userId]);
  return !!results[0]?.[0];
};

// ─── Helper: resolve owner for upload (shared account context) ───────────────
const resolveOwner = async (req) => {
  const requestedOwner = req.body.ownerUserId || req.query.ownerUserId;

  if (!requestedOwner || parseInt(requestedOwner) === req.user._id) {
    return { ownerUserId: req.user._id, uploadedByUserId: null };
  }

  const results = await callProcedure('CheckUploadAccess', [
    requestedOwner, req.user.email, req.user._id,
  ]);
  if (!results[0]?.[0]) return null;

  return { ownerUserId: parseInt(requestedOwner), uploadedByUserId: req.user._id };
};

// ─── Helper: insert child rows (medicines, labTests, lineItems) ───────────────
const insertChildRows = async (recordId, medicines, labTests, lineItems) => {
  for (const m of (medicines || [])) {
    await callProcedure('AddRecordMedicine', [
      recordId, m.name || '', m.dosage || '', m.frequency || '', m.duration || '',
    ]);
  }
  for (const t of (labTests || [])) {
    await callProcedure('AddRecordLabTest', [
      recordId, t.testName || '', t.value || '', t.unit || '', t.normalRange || '', t.status || 'normal',
    ]);
  }
  for (const item of (lineItems || [])) {
    await callProcedure('AddRecordBillItem', [
      recordId, item.description || '', item.amount || '',
    ]);
  }
};

// ─── POST /api/records/ocr-extract ───────────────────────────────────────────
const ocrExtract = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 400, 'No file uploaded');

    let ocrResult = {};
    try {
      ocrResult = await runOCR(req.file.buffer, req.file.mimetype, req.body.recordType || null);
    } catch (err) {
      console.error('OCR error:', err.message);
      ocrResult = { extractedText: '', documentType: 'Other', ocrConfidence: 'none' };
    }

    return successResponse(res, 200, 'OCR extraction complete', {
      extracted: {
        documentType:         ocrResult.documentType || 'Other',
        ocrConfidence:        ocrResult.ocrConfidence || 'none',
        extractedText:        ocrResult.extractedText || '',
        doctorName:           ocrResult.doctorName || '',
        hospitalName:         ocrResult.hospitalName || '',
        diagnosis:            ocrResult.diagnosis || '',
        labReportName:        ocrResult.labReportName || '',
        notes:                ocrResult.notes || '',
        visitDate:            ocrResult.visitDate || '',
        medicines:            ocrResult.medicines || [],
        labName:              ocrResult.labName || '',
        patientName:          ocrResult.patientName || '',
        labTests:             ocrResult.labTests || [],
        impression:           ocrResult.impression || '',
        scanType:             ocrResult.scanType || '',
        bodyPart:             ocrResult.bodyPart || '',
        findings:             ocrResult.findings || '',
        admissionDate:        ocrResult.admissionDate || '',
        dischargeDate:        ocrResult.dischargeDate || '',
        treatmentSummary:     ocrResult.treatmentSummary || '',
        dischargeAdvice:      ocrResult.dischargeAdvice || '',
        conditionAtDischarge: ocrResult.conditionAtDischarge || '',
        billNumber:           ocrResult.billNumber || '',
        totalAmount:          ocrResult.totalAmount || '',
        lineItems:            ocrResult.lineItems || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/records/upload ─────────────────────────────────────────────────
const uploadRecord = async (req, res, next) => {
  try {
    const ownership = await resolveOwner(req);
    if (!ownership) {
      return errorResponse(res, 403, 'You do not have upload access to this account');
    }
    const { ownerUserId, uploadedByUserId } = ownership;

    const { recordType, extractedText } = req.body;

    let ocrData = {};
    if (req.file) {
      try {
        ocrData = await runOCR(req.file.buffer, req.file.mimetype, recordType);
      } catch (e) {
        console.error('OCR:', e.message);
      }
    }

    const b = req.body;
    const medicines = parseJSON(b.medicines).length > 0 ? parseJSON(b.medicines) : (ocrData.medicines || []);
    const labTests  = parseJSON(b.labTests).length  > 0 ? parseJSON(b.labTests)  : (ocrData.labTests  || []);
    const lineItems = parseJSON(b.lineItems).length > 0 ? parseJSON(b.lineItems) : (ocrData.lineItems || []);

    const visitDate = b.visitDate || ocrData.visitDate || new Date().toISOString().split('T')[0];

    // CALL CreateMedicalRecord(...)
    const result = await callProcedure('CreateMedicalRecord', [
      ownerUserId,
      uploadedByUserId || 0,
      recordType || ocrData.documentType || 'Other',
      b.doctorName           || ocrData.doctorName           || '',
      b.hospitalName         || ocrData.hospitalName         || '',
      b.diagnosis            || ocrData.diagnosis            || '',
      b.notes                || ocrData.notes                || '',
      visitDate,
      b.labName              || ocrData.labName              || '',
      b.patientName          || ocrData.patientName          || '',
      b.impression           || ocrData.impression           || '',
      b.scanType             || ocrData.scanType             || '',
      b.bodyPart             || ocrData.bodyPart             || '',
      b.findings             || ocrData.findings             || '',
      b.admissionDate        || ocrData.admissionDate        || '',
      b.dischargeDate        || ocrData.dischargeDate        || '',
      b.treatmentSummary     || ocrData.treatmentSummary     || '',
      b.dischargeAdvice      || ocrData.dischargeAdvice      || '',
      b.conditionAtDischarge || ocrData.conditionAtDischarge || '',
      b.billNumber           || ocrData.billNumber           || '',
      b.totalAmount          || ocrData.totalAmount          || '',
      extractedText          || ocrData.extractedText        || '',
      !!(extractedText || ocrData.extractedText) ? 1 : 0,
      ocrData.ocrConfidence  || '',
    ]);

    const newId = result[0]?.[0]?.id;

    // Insert child rows
    await insertChildRows(newId, medicines, labTests, lineItems);

    // Fetch the full record to return
    const recordResult = await callProcedure('GetRecordById', [newId]);
    const record = normaliseRecord(recordResult[0]?.[0]);

    return successResponse(res, 201, 'Record saved successfully', { record });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/records ─────────────────────────────────────────────────────────
const getRecords = async (req, res, next) => {
  try {
    const requestedOwner = req.query.ownerUserId;
    let targetOwner = req.user._id;

    if (requestedOwner && parseInt(requestedOwner) !== req.user._id) {
      const access = await callProcedure('CheckAccountAccess', [
        requestedOwner, req.user.email, req.user._id,
      ]);
      if (!access[0]?.[0]) return errorResponse(res, 403, 'Access denied to this account');
      targetOwner = parseInt(requestedOwner);
    }

    const { search, doctor, hospital, diagnosis, recordType, startDate, endDate, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // CALL GetRecords(ownerUserId, search, doctor, hospital, diagnosis, recordType, startDate, endDate, limit, offset)
    const results = await callProcedure('GetRecords', [
      targetOwner,
      search    || null,
      doctor    || null,
      hospital  || null,
      diagnosis || null,
      recordType || null,
      startDate  || null,
      endDate    || null,
      parseInt(limit),
      offset,
    ]);

    const records = (results[0] || []).map(normaliseRecord);
    const total   = results[1]?.[0]?.total || 0;

    return successResponse(res, 200, 'Records fetched', {
      records,
      pagination: {
        total,
        page:  parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) { next(error); }
};

// ─── GET /api/records/detail/:id ─────────────────────────────────────────────
const getRecord = async (req, res, next) => {
  try {
    const results = await callProcedure('GetRecordById', [req.params.id]);
    const row     = results[0]?.[0];
    if (!row) return errorResponse(res, 404, 'Record not found');

    const hasAccess = await canAccessRecord(row, req.user._id, req.user.email);
    if (!hasAccess) return errorResponse(res, 403, 'Access denied');

    return successResponse(res, 200, 'Record fetched', { record: normaliseRecord(row) });
  } catch (error) { next(error); }
};

// ─── GET /api/records/detail/:id/download ────────────────────────────────────
const downloadRecord = async (req, res, next) => {
  try {
    const results = await callProcedure('GetRecordById', [req.params.id]);
    const row     = results[0]?.[0];
    if (!row) return errorResponse(res, 404, 'Record not found');

    const hasAccess = await canAccessRecord(row, req.user._id, req.user.email);
    if (!hasAccess) return errorResponse(res, 403, 'Access denied');

    const record = normaliseRecord(row);

    const lines = [];
    const add = (label, value) => { if (value) lines.push(`${label}: ${value}`); };
    const divider = () => lines.push('─'.repeat(50));

    lines.push('HEALTH RECORD MANAGER — EXTRACTED DATA');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    divider();

    add('Record Type', record.recordType);
    add('Visit Date', record.visitDate ? new Date(record.visitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '');
    add('Doctor', record.doctorName);
    add('Hospital / Clinic', record.hospitalName);
    add('Diagnosis', record.diagnosis);
    add('Notes', record.notes);

    if (record.recordType === 'Prescription' && record.medicines?.length > 0) {
      divider();
      lines.push('PRESCRIBED MEDICINES');
      record.medicines.forEach((m, i) => {
        lines.push(`  ${i + 1}. ${m.name || '—'}${m.dosage ? ' | ' + m.dosage : ''}${m.frequency ? ' | ' + m.frequency : ''}${m.duration ? ' | ' + m.duration : ''}`);
      });
    }

    if (record.recordType === 'Lab Report') {
      divider();
      add('Lab / Diagnostic Centre', record.labName);
      add('Patient Name', record.patientName);
      add('Impression', record.impression);
      if (record.labTests?.length > 0) {
        lines.push('');
        lines.push('TEST RESULTS');
        lines.push('  Test Name                    Value      Unit         Normal Range    Status');
        lines.push('  ' + '─'.repeat(80));
        record.labTests.forEach((t) => {
          const name  = (t.testName    || '—').padEnd(30);
          const val   = (t.value       || '—').padEnd(10);
          const unit  = (t.unit        || '—').padEnd(13);
          const range = (t.normalRange || '—').padEnd(16);
          lines.push(`  ${name} ${val} ${unit} ${range} ${t.status || '—'}`);
        });
      }
    }

    if (record.recordType === 'Scan') {
      divider();
      add('Scan Type', record.scanType);
      add('Body Part / Region', record.bodyPart);
      add('Findings', record.findings);
      add('Impression', record.impression);
    }

    if (record.recordType === 'Discharge Summary') {
      divider();
      add('Admission Date', record.admissionDate);
      add('Discharge Date', record.dischargeDate);
      add('Condition at Discharge', record.conditionAtDischarge);
      add('Treatment Summary', record.treatmentSummary);
      add('Discharge Advice', record.dischargeAdvice);
    }

    if (record.recordType === 'Medical Bill') {
      divider();
      add('Bill Number', record.billNumber);
      add('Total Amount', record.totalAmount ? `Rs. ${record.totalAmount}` : '');
      if (record.lineItems?.length > 0) {
        lines.push('');
        lines.push('LINE ITEMS');
        record.lineItems.forEach((item, i) => {
          lines.push(`  ${i + 1}. ${item.description || '—'} — Rs. ${item.amount || '—'}`);
        });
      }
    }

    if (record.extractedText) {
      divider();
      lines.push('RAW OCR TEXT');
      lines.push(record.extractedText);
    }

    divider();
    lines.push('END OF RECORD');

    const content  = lines.join('\n');
    const filename = `record-${(record.recordType || 'record').replace(/\s+/g, '-').toLowerCase()}-${new Date(record.visitDate).toISOString().split('T')[0]}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/records/:id ─────────────────────────────────────────────────────
const updateRecord = async (req, res, next) => {
  try {
    const results = await callProcedure('GetRecordById', [req.params.id]);
    const row     = results[0]?.[0];
    if (!row) return errorResponse(res, 404, 'Record not found');

    const hasAccess = await canAccessRecord(row, req.user._id, req.user.email, true);
    if (!hasAccess) return errorResponse(res, 403, 'Access denied');

    const b = req.body;

    // CALL UpdateMedicalRecord(...)
    await callProcedure('UpdateMedicalRecord', [
      req.params.id,
      b.recordType           || null,
      b.doctorName           || null,
      b.hospitalName         || null,
      b.diagnosis            || null,
      b.notes                || null,
      b.visitDate            || null,
      b.labName              || null,
      b.patientName          || null,
      b.impression           || null,
      b.scanType             || null,
      b.bodyPart             || null,
      b.findings             || null,
      b.admissionDate        || null,
      b.dischargeDate        || null,
      b.treatmentSummary     || null,
      b.dischargeAdvice      || null,
      b.conditionAtDischarge || null,
      b.billNumber           || null,
      b.totalAmount          || null,
    ]);

    // Replace child rows
    const medicines = parseJSON(b.medicines);
    const labTests  = parseJSON(b.labTests);
    const lineItems = parseJSON(b.lineItems);

    if (medicines.length > 0) {
      await callProcedure('DeleteRecordMedicines', [req.params.id]);
      for (const m of medicines) {
        await callProcedure('AddRecordMedicine', [req.params.id, m.name || '', m.dosage || '', m.frequency || '', m.duration || '']);
      }
    }
    if (labTests.length > 0) {
      await callProcedure('DeleteRecordLabTests', [req.params.id]);
      for (const t of labTests) {
        await callProcedure('AddRecordLabTest', [req.params.id, t.testName || '', t.value || '', t.unit || '', t.normalRange || '', t.status || 'normal']);
      }
    }
    if (lineItems.length > 0) {
      await callProcedure('DeleteRecordBillItems', [req.params.id]);
      for (const item of lineItems) {
        await callProcedure('AddRecordBillItem', [req.params.id, item.description || '', item.amount || '']);
      }
    }

    const updated = await callProcedure('GetRecordById', [req.params.id]);
    return successResponse(res, 200, 'Record updated', { record: normaliseRecord(updated[0]?.[0]) });
  } catch (error) { next(error); }
};

// ─── DELETE /api/records/:id ──────────────────────────────────────────────────
const deleteRecord = async (req, res, next) => {
  try {
    const results = await callProcedure('GetRecordById', [req.params.id]);
    const row     = results[0]?.[0];
    if (!row) return errorResponse(res, 404, 'Record not found');

    const hasAccess = await canAccessRecord(row, req.user._id, req.user.email, true);
    if (!hasAccess) return errorResponse(res, 403, 'Access denied');

    // CALL DeleteMedicalRecord(id)
    await callProcedure('DeleteMedicalRecord', [req.params.id]);
    return successResponse(res, 200, 'Record deleted successfully');
  } catch (error) { next(error); }
};

module.exports = { ocrExtract, uploadRecord, getRecords, getRecord, downloadRecord, updateRecord, deleteRecord };
