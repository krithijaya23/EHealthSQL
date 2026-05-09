const MedicalRecord = require('../models/MedicalRecord');
const AccessControl = require('../models/AccessControl');
const { successResponse } = require('../utils/apiResponse');
const { getMonthlyVisits } = require('../services/aiSummaryService');

// ─── GET /api/analytics ───────────────────────────────────────────────────────
// Per-user analytics (all records)
const getAnalytics = async (req, res, next) => {
  try {
    const records = await MedicalRecord.find({ ownerUserId: req.user._id, isDeleted: false }).sort({ visitDate: -1 });

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
      _id: r._id, doctorName: r.doctorName, hospitalName: r.hospitalName,
      diagnosis: r.diagnosis, visitDate: r.visitDate, recordType: r.recordType,
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
    const totalRecords = await MedicalRecord.countDocuments({
      ownerUserId: req.user._id,
      isDeleted: false,
    });

    const recentRecords = await MedicalRecord.find({
      ownerUserId: req.user._id,
      isDeleted: false,
    }).sort({ createdAt: -1 }).limit(5);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const recordsThisMonth = await MedicalRecord.countDocuments({
      ownerUserId: req.user._id,
      isDeleted: false,
      createdAt: { $gte: startOfMonth },
    });

    // Count active access grants shared by this user
    const sharedCount = await AccessControl.countDocuments({
      ownerUserId: req.user._id,
      status: 'active',
      expiryDate: { $gt: new Date() },
    });

    return successResponse(res, 200, 'Dashboard stats fetched', {
      stats: { totalRecords, recordsThisMonth, sharedCount, recentRecords },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalytics, getDashboardStats };
