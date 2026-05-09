const MedicalRecord = require('../models/MedicalRecord');
const AccessControl = require('../models/AccessControl');
const {
  generateHealthSummary,
  generatePatientSummary,
  generateDoctorSummary,
} = require('../services/aiSummaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ─── GET /api/summary ─────────────────────────────────────────────────────────
// Full summary for the logged-in user's own records
const getHealthSummary = async (req, res, next) => {
  try {
    const records = await MedicalRecord.find({ ownerUserId: req.user._id, isDeleted: false }).sort({ visitDate: -1 });
    const summary = generateHealthSummary(records);

    return successResponse(res, 200, 'Health summary generated', { summary });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/summary/shared/:ownerUserId ─────────────────────────────────────
// Summary for a shared account (requires active access grant)
const getSharedSummary = async (req, res, next) => {
  try {
    const { ownerUserId } = req.params;

    const access = await AccessControl.findOne({
      ownerUserId,
      $or: [{ targetEmail: req.user.email }, { targetUserId: req.user._id }],
      status: 'active',
      expiryDate: { $gt: new Date() },
    });

    if (!access) return errorResponse(res, 403, 'Access denied');

    const records = await MedicalRecord.find({ ownerUserId, isDeleted: false }).sort({ visitDate: -1 });
    const summary = generateHealthSummary(records);

    return successResponse(res, 200, 'Shared health summary generated', { summary });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHealthSummary, getSharedSummary };
