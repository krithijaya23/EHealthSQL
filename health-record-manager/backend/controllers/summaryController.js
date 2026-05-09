const MedicalRecord = require('../models/MedicalRecord');
const AccessControl = require('../models/AccessControl');
const {
  generateHealthSummary,
  generatePatientSummary,
  generateDoctorSummary,
} = require('../services/aiSummaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ─── GET /api/summary ─────────────────────────────────────────────────────────
// Supports ?ownerUserId= for shared account context
const getHealthSummary = async (req, res, next) => {
  try {
    const requestedOwner = req.query.ownerUserId;
    let targetOwner = req.user._id;

    if (requestedOwner && requestedOwner !== req.user._id.toString()) {
      const access = await AccessControl.findOne({
        ownerUserId: requestedOwner,
        $or: [{ targetEmail: req.user.email }, { targetUserId: req.user._id }],
        status: 'active',
        expiryDate: { $gt: new Date() },
      });
      if (!access) return errorResponse(res, 403, 'Access denied');
      targetOwner = requestedOwner;
    }

    const records = await MedicalRecord.find({ ownerUserId: targetOwner, isDeleted: false }).sort({ visitDate: -1 });
    const summary = await generateHealthSummary(records);
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
    const summary = await generateHealthSummary(records);

    return successResponse(res, 200, 'Shared health summary generated', { summary });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHealthSummary, getSharedSummary };
