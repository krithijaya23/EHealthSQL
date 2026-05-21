const { callProcedure } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { getMonthlyVisits } = require('../services/aiSummaryService');

// Helper: parse JSON arrays stored in DB rows
const safeJson = (val, fallback = []) => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

// Convert DB row to the shape aiSummaryService expects
const rowToRecord = (row) => ({
  _id:          row.id,
  visitDate:    row.visit_date,
  recordType:   row.record_type,
  doctorName:   row.doctor_name,
  hospitalName: row.hospital_name,
  diagnosis:    row.diagnosis,
  medicines:    safeJson(row.medicines_json,  []),
  labTests:     safeJson(row.lab_tests_json,  []),
  notes:        row.notes,
  impression:   row.impression,
});

// ─── GET /api/analytics ───────────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const requestedOwner = req.query.ownerUserId;
    let targetOwner = req.user._id;

    if (requestedOwner && parseInt(requestedOwner) !== req.user._id) {
      const access = await callProcedure('CheckAccountAccess', [
        requestedOwner, req.user.email, req.user._id,
      ]);
      if (!access[0]?.[0]) return successResponse(res, 403, 'Access denied');
      targetOwner = parseInt(requestedOwner);
    }

    // CALL GetAllRecordsForAnalytics(ownerUserId)
    const results = await callProcedure('GetAllRecordsForAnalytics', [targetOwner]);
    const records = (results[0] || []).map(rowToRecord);

    if (!records.length) {
      return successResponse(res, 200, 'No records found', {
        analytics: {
          totalRecords: 0,
          monthlyVisits: [],
          diagnosisDistribution: [],
          hospitalVisits: [],
          recordTypeDistribution: [],
          recentActivity: [],
        },
      });
    }

    const monthlyVisits = getMonthlyVisits(records);

    const diagnosisMap = {};
    records.forEach((r) => {
      if (r.diagnosis) {
        const key = r.diagnosis.trim().toLowerCase();
        diagnosisMap[key] = (diagnosisMap[key] || 0) + 1;
      }
    });
    const diagnosisDistribution = Object.entries(diagnosisMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    const hospitalMap = {};
    records.forEach((r) => {
      if (r.hospitalName) {
        const key = r.hospitalName.trim();
        hospitalMap[key] = (hospitalMap[key] || 0) + 1;
      }
    });
    const hospitalVisits = Object.entries(hospitalMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, visits]) => ({ name, visits }));

    const typeMap = {};
    records.forEach((r) => {
      const key = r.recordType || 'Other';
      typeMap[key] = (typeMap[key] || 0) + 1;
    });
    const recordTypeDistribution = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

    const recentActivity = records.slice(0, 5).map((r) => ({
      _id:          r._id,
      doctorName:   r.doctorName,
      hospitalName: r.hospitalName,
      diagnosis:    r.diagnosis,
      visitDate:    r.visitDate,
      recordType:   r.recordType,
    }));

    return successResponse(res, 200, 'Analytics fetched', {
      analytics: { totalRecords: records.length, monthlyVisits, diagnosisDistribution, hospitalVisits, recordTypeDistribution, recentActivity },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/analytics/dashboard ────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    // CALL CountRecords(ownerUserId)
    const totalResult = await callProcedure('CountRecords', [req.user._id]);
    const totalRecords = totalResult[0]?.[0]?.total || 0;

    // CALL GetRecentRecords(ownerUserId, limit)
    const recentResult = await callProcedure('GetRecentRecords', [req.user._id, 5]);
    const recentRecords = (recentResult[0] || []).map((row) => ({
      _id:          row.id,
      recordType:   row.record_type,
      doctorName:   row.doctor_name,
      hospitalName: row.hospital_name,
      diagnosis:    row.diagnosis,
      visitDate:    row.visit_date,
      createdAt:    row.created_at,
    }));

    // CALL CountRecordsThisMonth(ownerUserId)
    const monthResult = await callProcedure('CountRecordsThisMonth', [req.user._id]);
    const recordsThisMonth = monthResult[0]?.[0]?.total || 0;

    // CALL CountActiveGrants(ownerUserId)
    const sharedResult = await callProcedure('CountActiveGrants', [req.user._id]);
    const sharedCount = sharedResult[0]?.[0]?.total || 0;

    return successResponse(res, 200, 'Dashboard stats fetched', {
      stats: { totalRecords, recordsThisMonth, sharedCount, recentRecords },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalytics, getDashboardStats };
