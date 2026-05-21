const { callProcedure } = require('../config/db');
const { generateHealthSummary } = require('../services/aiSummaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Convert DB row to the shape aiSummaryService expects
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

// ─── GET /api/summary ─────────────────────────────────────────────────────────
const getHealthSummary = async (req, res, next) => {
  try {
    const requestedOwner = req.query.ownerUserId;
    let targetOwner = req.user._id;

    if (requestedOwner && parseInt(requestedOwner) !== req.user._id) {
      const access = await callProcedure('CheckAccountAccess', [
        requestedOwner, req.user.email, req.user._id,
      ]);
      if (!access[0]?.[0]) return errorResponse(res, 403, 'Access denied');
      targetOwner = parseInt(requestedOwner);
    }

    // CALL GetAllRecordsForAnalytics(ownerUserId)
    const results = await callProcedure('GetAllRecordsForAnalytics', [targetOwner]);
    const records = (results[0] || []).map(rowToRecord);

    const summary = await generateHealthSummary(records);
    return successResponse(res, 200, 'Health summary generated', { summary });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/summary/shared/:ownerUserId ─────────────────────────────────────
const getSharedSummary = async (req, res, next) => {
  try {
    const { ownerUserId } = req.params;

    const access = await callProcedure('CheckAccountAccess', [
      ownerUserId, req.user.email, req.user._id,
    ]);
    if (!access[0]?.[0]) return errorResponse(res, 403, 'Access denied');

    const results = await callProcedure('GetAllRecordsForAnalytics', [ownerUserId]);
    const records = (results[0] || []).map(rowToRecord);

    const summary = await generateHealthSummary(records);
    return successResponse(res, 200, 'Shared health summary generated', { summary });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHealthSummary, getSharedSummary };
