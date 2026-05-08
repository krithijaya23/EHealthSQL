const MedicalRecord = require('../models/MedicalRecord');
const FamilyProfile = require('../models/FamilyProfile');
const { runOCR } = require('../services/ocrService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const parseJSON = (str, fallback = []) => {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
};

// ─── POST /api/records/ocr-extract ───────────────────────────────────────────
// Upload file, run OCR, return extracted data — does NOT save to DB or disk
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
        documentType: ocrResult.documentType || 'Other',
        ocrConfidence: ocrResult.ocrConfidence || 'none',
        extractedText: ocrResult.extractedText || '',
        doctorName: ocrResult.doctorName || '',
        hospitalName: ocrResult.hospitalName || '',
        diagnosis: ocrResult.diagnosis || '',
        notes: ocrResult.notes || '',
        visitDate: ocrResult.visitDate || '',
        medicines: ocrResult.medicines || [],
        labName: ocrResult.labName || '',
        patientName: ocrResult.patientName || '',
        labTests: ocrResult.labTests || [],
        impression: ocrResult.impression || '',
        scanType: ocrResult.scanType || '',
        bodyPart: ocrResult.bodyPart || '',
        findings: ocrResult.findings || '',
        admissionDate: ocrResult.admissionDate || '',
        dischargeDate: ocrResult.dischargeDate || '',
        treatmentSummary: ocrResult.treatmentSummary || '',
        dischargeAdvice: ocrResult.dischargeAdvice || '',
        conditionAtDischarge: ocrResult.conditionAtDischarge || '',
        billNumber: ocrResult.billNumber || '',
        totalAmount: ocrResult.totalAmount || '',
        lineItems: ocrResult.lineItems || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/records/upload ─────────────────────────────────────────────────
// Save extracted record data to DB — no file stored
const uploadRecord = async (req, res, next) => {
  try {
    const { profileId, recordType, extractedText } = req.body;
    if (!profileId) return errorResponse(res, 400, 'Profile ID is required');

    const profile = await FamilyProfile.findOne({ _id: profileId, ownerUserId: req.user._id, isActive: true });
    if (!profile) return errorResponse(res, 404, 'Profile not found or access denied');

    let ocrData = {};

    // If a file was uploaded directly (without prior ocr-extract step), run OCR now
    if (req.file) {
      try {
        ocrData = await runOCR(req.file.buffer, req.file.mimetype, recordType);
      } catch (e) {
        console.error('OCR:', e.message);
      }
    }

    const b = req.body;
    const record = await MedicalRecord.create({
      profileId,
      ownerUserId: req.user._id,
      // No uploadedFile stored
      recordType: recordType || ocrData.documentType || 'Other',
      doctorName: b.doctorName || ocrData.doctorName || '',
      hospitalName: b.hospitalName || ocrData.hospitalName || '',
      diagnosis: b.diagnosis || ocrData.diagnosis || '',
      notes: b.notes || ocrData.notes || '',
      visitDate: b.visitDate || ocrData.visitDate || new Date(),
      medicines: parseJSON(b.medicines).length > 0 ? parseJSON(b.medicines) : (ocrData.medicines || []),
      labName: b.labName || ocrData.labName || '',
      patientName: b.patientName || ocrData.patientName || '',
      labTests: parseJSON(b.labTests).length > 0 ? parseJSON(b.labTests) : (ocrData.labTests || []),
      impression: b.impression || ocrData.impression || '',
      scanType: b.scanType || ocrData.scanType || '',
      bodyPart: b.bodyPart || ocrData.bodyPart || '',
      findings: b.findings || ocrData.findings || '',
      admissionDate: b.admissionDate || ocrData.admissionDate || '',
      dischargeDate: b.dischargeDate || ocrData.dischargeDate || '',
      treatmentSummary: b.treatmentSummary || ocrData.treatmentSummary || '',
      dischargeAdvice: b.dischargeAdvice || ocrData.dischargeAdvice || '',
      conditionAtDischarge: b.conditionAtDischarge || ocrData.conditionAtDischarge || '',
      billNumber: b.billNumber || ocrData.billNumber || '',
      totalAmount: b.totalAmount || ocrData.totalAmount || '',
      lineItems: parseJSON(b.lineItems).length > 0 ? parseJSON(b.lineItems) : (ocrData.lineItems || []),
      extractedText: extractedText || ocrData.extractedText || '',
      ocrProcessed: !!(extractedText || ocrData.extractedText),
      ocrConfidence: ocrData.ocrConfidence || '',
    });

    return successResponse(res, 201, 'Record saved successfully', { record });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/records/:profileId ─────────────────────────────────────────────
const getRecords = async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const { search, doctor, hospital, diagnosis, recordType, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query = { profileId, isDeleted: false };
    if (search) {
      query.$or = [
        { doctorName: { $regex: search, $options: 'i' } },
        { hospitalName: { $regex: search, $options: 'i' } },
        { diagnosis: { $regex: search, $options: 'i' } },
        { 'medicines.name': { $regex: search, $options: 'i' } },
        { 'labTests.testName': { $regex: search, $options: 'i' } },
      ];
    }
    if (doctor) query.doctorName = { $regex: doctor, $options: 'i' };
    if (hospital) query.hospitalName = { $regex: hospital, $options: 'i' };
    if (diagnosis) query.diagnosis = { $regex: diagnosis, $options: 'i' };
    if (recordType) query.recordType = recordType;
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await MedicalRecord.countDocuments(query);
    const records = await MedicalRecord.find(query).sort({ visitDate: -1 }).skip(skip).limit(parseInt(limit));
    return successResponse(res, 200, 'Records fetched', {
      records,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), limit: parseInt(limit) },
    });
  } catch (error) { next(error); }
};

// ─── GET /api/records/detail/:id ─────────────────────────────────────────────
const getRecord = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findOne({ _id: req.params.id, ownerUserId: req.user._id, isDeleted: false });
    if (!record) return errorResponse(res, 404, 'Record not found');
    return successResponse(res, 200, 'Record fetched', { record });
  } catch (error) { next(error); }
};

// ─── GET /api/records/detail/:id/download ────────────────────────────────────
// Generate and stream a plain-text file of all extracted data for this record
const downloadRecord = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findOne({ _id: req.params.id, ownerUserId: req.user._id, isDeleted: false });
    if (!record) return errorResponse(res, 404, 'Record not found');

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
          const name = (t.testName || '—').padEnd(30);
          const val = (t.value || '—').padEnd(10);
          const unit = (t.unit || '—').padEnd(13);
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

    const content = lines.join('\n');
    const filename = `record-${record.recordType.replace(/\s+/g, '-').toLowerCase()}-${new Date(record.visitDate).toISOString().split('T')[0]}.txt`;

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
    const b = req.body;
    const updates = {
      recordType: b.recordType, doctorName: b.doctorName, hospitalName: b.hospitalName,
      diagnosis: b.diagnosis, notes: b.notes, visitDate: b.visitDate,
      medicines: parseJSON(b.medicines),
      labName: b.labName, patientName: b.patientName,
      labTests: parseJSON(b.labTests),
      impression: b.impression, scanType: b.scanType, bodyPart: b.bodyPart, findings: b.findings,
      admissionDate: b.admissionDate, dischargeDate: b.dischargeDate,
      treatmentSummary: b.treatmentSummary, dischargeAdvice: b.dischargeAdvice,
      conditionAtDischarge: b.conditionAtDischarge,
      billNumber: b.billNumber, totalAmount: b.totalAmount,
      lineItems: parseJSON(b.lineItems),
    };
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    const record = await MedicalRecord.findOneAndUpdate(
      { _id: req.params.id, ownerUserId: req.user._id, isDeleted: false },
      updates, { new: true, runValidators: true }
    );
    if (!record) return errorResponse(res, 404, 'Record not found');
    return successResponse(res, 200, 'Record updated', { record });
  } catch (error) { next(error); }
};

// ─── DELETE /api/records/:id ──────────────────────────────────────────────────
const deleteRecord = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findOneAndUpdate(
      { _id: req.params.id, ownerUserId: req.user._id },
      { isDeleted: true }, { new: true }
    );
    if (!record) return errorResponse(res, 404, 'Record not found');
    return successResponse(res, 200, 'Record deleted successfully');
  } catch (error) { next(error); }
};

module.exports = { ocrExtract, uploadRecord, getRecords, getRecord, downloadRecord, updateRecord, deleteRecord };
