const { callProcedure } = require('../config/db');
const { generateHealthSummary } = require('../services/aiSummaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const rowToRecord = (row) => {
  const safeJson = (val, fallback = []) => {
    if (!val) return fallback;
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return fallback; }
  };
  return {
    _id:          row.id,
    visitDate:    row.visit_date,
    recordType:   row.record_type,
    doctorName:   row.doctor_name,
    hospitalName: row.hospital_name,
    diagnosis:    row.diagnosis,
    notes:        row.notes,
    impression:   row.impression,
    medicines:    safeJson(row.medicines_json,  []),
    labTests:     safeJson(row.lab_tests_json,  []),
  };
};

// ─── GET /api/doctor/patients ─────────────────────────────────────────────────
// Returns accounts that have shared access with this doctor
const getSharedPatients = async (req, res, next) => {
  try {
    // CALL GetSharedWithMe(targetEmail, targetUserId)
    const results = await callProcedure('GetSharedWithMe', [req.user.email, req.user._id]);
    const accessList = results[0] || [];

    const patients = accessList.map((row) => ({
      accessId:   row.id,
      accessType: row.access_type,
      expiryDate: row.expiry_date,
      owner: {
        _id:          row.owner_user_id,
        fullName:     row.owner_full_name,
        email:        row.owner_email,
        profilePhoto: row.owner_profile_photo,
      },
    }));

    return successResponse(res, 200, 'Shared patients fetched', { patients });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/doctor/patient/:profileId/timeline ──────────────────────────────
// profileId here is actually the ownerUserId (account-level access)
const getPatientTimeline = async (req, res, next) => {
  try {
    const { profileId } = req.params; // treated as ownerUserId

    // Verify doctor has access
    const accessResult = await callProcedure('CheckAccountAccess', [
      profileId, req.user.email, req.user._id,
    ]);
    const access = accessResult[0]?.[0];

    if (!access) {
      return errorResponse(res, 403, 'Access denied to this patient profile');
    }

    // CALL GetAllRecordsForAnalytics(ownerUserId)
    const recordsResult = await callProcedure('GetAllRecordsForAnalytics', [profileId]);
    const records = (recordsResult[0] || []).map(rowToRecord);

    const summary = await generateHealthSummary(records);

    return successResponse(res, 200, 'Patient timeline fetched', {
      records,
      summary,
      accessType: access.access_type,
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/doctor/patient/:profileId/upload ───────────────────────────────
const doctorUploadRecord = async (req, res, next) => {
  try {
    const { profileId } = req.params; // treated as ownerUserId

    // Verify upload access
    const accessResult = await callProcedure('CheckUploadAccess', [
      profileId, req.user.email, req.user._id,
    ]);
    const access = accessResult[0]?.[0];

    if (!access) {
      return errorResponse(res, 403, 'Upload access denied for this patient');
    }

    const { doctorName, hospitalName, diagnosis, notes, visitDate, recordType } = req.body;

    // CALL CreateMedicalRecord(...)
    const result = await callProcedure('CreateMedicalRecord', [
      parseInt(profileId),
      req.user._id,
      recordType    || 'Other',
      doctorName    || req.user.fullName || '',
      hospitalName  || '',
      diagnosis     || '',
      notes         || '',
      visitDate     || new Date().toISOString().split('T')[0],
      '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', 0, '',
    ]);

    const newId = result[0]?.[0]?.id;

    // Fetch the created record
    const recordResult = await callProcedure('GetRecordById', [newId]);
    const row = recordResult[0]?.[0];

    const record = row ? {
      _id:          row.id,
      ownerUserId:  row.owner_user_id,
      recordType:   row.record_type,
      doctorName:   row.doctor_name,
      hospitalName: row.hospital_name,
      diagnosis:    row.diagnosis,
      visitDate:    row.visit_date,
    } : null;

    return successResponse(res, 201, 'Record uploaded by doctor', { record });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSharedPatients, getPatientTimeline, doctorUploadRecord };
