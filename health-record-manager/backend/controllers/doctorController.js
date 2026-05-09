const MedicalRecord = require('../models/MedicalRecord');
const FamilyProfile = require('../models/FamilyProfile');
const AccessControl = require('../models/AccessControl');
const { generateHealthSummary } = require('../services/aiSummaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// @desc    Get shared patient profiles for doctor
// @route   GET /api/doctor/patients
// @access  Private (doctor)
const getSharedPatients = async (req, res, next) => {
  try {
    const accessList = await AccessControl.find({
      targetEmail: req.user.email,
      status: 'active',
      expiryDate: { $gt: new Date() },
    })
      .populate('profileId')
      .populate('ownerUserId', 'fullName email');

    const patients = accessList.map((access) => ({
      accessId: access._id,
      profile: access.profileId,
      owner: access.ownerUserId,
      accessType: access.accessType,
      expiryDate: access.expiryDate,
    }));

    return successResponse(res, 200, 'Shared patients fetched', { patients });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patient medical timeline (doctor view)
// @route   GET /api/doctor/patient/:profileId/timeline
// @access  Private (doctor with access)
const getPatientTimeline = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    // Verify doctor has access
    const access = await AccessControl.findOne({
      targetEmail: req.user.email,
      profileId,
      status: 'active',
      expiryDate: { $gt: new Date() },
    });

    if (!access) {
      return errorResponse(res, 403, 'Access denied to this patient profile');
    }

    const profile = await FamilyProfile.findById(profileId);
    const records = await MedicalRecord.find({ profileId, isDeleted: false }).sort({ visitDate: -1 });
    const summary = await generateHealthSummary(records);

    return successResponse(res, 200, 'Patient timeline fetched', {
      profile,
      records,
      summary,
      accessType: access.accessType,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Doctor uploads report for patient
// @route   POST /api/doctor/patient/:profileId/upload
// @access  Private (doctor with upload access)
const doctorUploadRecord = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const access = await AccessControl.findOne({
      targetEmail: req.user.email,
      profileId,
      status: 'active',
      accessType: 'upload',
      expiryDate: { $gt: new Date() },
    });

    if (!access) {
      return errorResponse(res, 403, 'Upload access denied for this patient');
    }

    const profile = await FamilyProfile.findById(profileId);
    const { doctorName, hospitalName, diagnosis, notes, visitDate, recordType } = req.body;

    let fileData = null;
    if (req.file) {
      fileData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
      };
    }

    const record = await MedicalRecord.create({
      profileId,
      ownerUserId: profile.ownerUserId,
      uploadedFile: fileData,
      recordType: recordType || 'Other',
      doctorName: doctorName || req.user.fullName,
      hospitalName: hospitalName || '',
      diagnosis: diagnosis || '',
      notes: notes || '',
      visitDate: visitDate || new Date(),
    });

    return successResponse(res, 201, 'Record uploaded by doctor', { record });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSharedPatients, getPatientTimeline, doctorUploadRecord };
