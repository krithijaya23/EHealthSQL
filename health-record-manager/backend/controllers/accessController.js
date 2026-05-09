const AccessControl = require('../models/AccessControl');
const User = require('../models/User');
const MedicalRecord = require('../models/MedicalRecord');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ─── Helper: auto-expire stale records ───────────────────────────────────────
const autoExpire = async (list) => {
  const now = new Date();
  const stale = list.filter((a) => a.status === 'active' && a.expiryDate < now);
  await Promise.all(stale.map((a) => {
    a.status = 'expired';
    return a.save();
  }));
};

// ─── GET /api/access/lookup-user ──────────────────────────────────────────────
// Check if a user with the given email exists in the DB
const lookupUser = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return errorResponse(res, 400, 'Email is required');

    if (email.toLowerCase() === req.user.email.toLowerCase()) {
      return errorResponse(res, 400, 'Cannot share access with yourself');
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('fullName email profilePhoto');
    if (!user) {
      return successResponse(res, 200, 'User not found', { found: false });
    }

    return successResponse(res, 200, 'User found', {
      found: true,
      user: { _id: user._id, fullName: user.fullName, email: user.email, profilePhoto: user.profilePhoto },
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/access/share ───────────────────────────────────────────────────
const shareAccess = async (req, res, next) => {
  try {
    const { targetEmail, accessType, expiryDays, customExpiry } = req.body;

    if (!targetEmail) {
      return errorResponse(res, 400, 'Target email is required');
    }

    // Cannot share with yourself
    if (targetEmail.toLowerCase() === req.user.email.toLowerCase()) {
      return errorResponse(res, 400, 'Cannot share access with yourself');
    }

    // Target user MUST exist in the DB
    const targetUser = await User.findOne({ email: targetEmail.toLowerCase() });
    if (!targetUser) {
      return errorResponse(res, 404, 'No account found with this email. The person must sign up first.');
    }

    // Calculate expiry date
    let expiryDate;
    if (customExpiry) {
      expiryDate = new Date(customExpiry);
      expiryDate.setHours(23, 59, 59, 999);
    } else {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (parseInt(expiryDays) || 7));
    }

    if (expiryDate <= new Date()) {
      return errorResponse(res, 400, 'Expiry date must be in the future');
    }

    // Upsert: update existing active grant or create new one (account-level, no profileId)
    const existing = await AccessControl.findOne({
      ownerUserId: req.user._id,
      targetUserId: targetUser._id,
      profileId: null,
      status: 'active',
    });

    let access;
    if (existing) {
      existing.accessType = accessType || 'view';
      existing.expiryDate = expiryDate;
      existing.targetEmail = targetEmail.toLowerCase();
      await existing.save();
      access = existing;
    } else {
      access = await AccessControl.create({
        ownerUserId: req.user._id,
        targetEmail: targetEmail.toLowerCase(),
        targetUserId: targetUser._id,
        profileId: null,
        accessType: accessType || 'view',
        expiryDate,
        sharedBy: req.user.fullName,
        status: 'active',
      });
    }

    const populated = await AccessControl.findById(access._id)
      .populate('targetUserId', 'fullName email profilePhoto');

    return successResponse(res, existing ? 200 : 201,
      existing ? 'Access updated successfully' : 'Access shared successfully',
      { access: populated }
    );
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/access/revoke/:id ───────────────────────────────────────────
const revokeAccess = async (req, res, next) => {
  try {
    const access = await AccessControl.findOneAndUpdate(
      { _id: req.params.id, ownerUserId: req.user._id },
      { status: 'revoked' },
      { new: true }
    );
    if (!access) return errorResponse(res, 404, 'Access record not found');
    return successResponse(res, 200, 'Access revoked successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/granted ──────────────────────────────────────────────────
const getGrantedAccess = async (req, res, next) => {
  try {
    const accessList = await AccessControl.find({ ownerUserId: req.user._id })
      .populate('targetUserId', 'fullName email profilePhoto role')
      .sort({ createdAt: -1 });

    await autoExpire(accessList);

    const fresh = await AccessControl.find({ ownerUserId: req.user._id })
      .populate('targetUserId', 'fullName email profilePhoto role')
      .sort({ createdAt: -1 });

    return successResponse(res, 200, 'Access list fetched', { accessList: fresh });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/shared-with-me ──────────────────────────────────────────
const getSharedWithMe = async (req, res, next) => {
  try {
    const accessList = await AccessControl.find({
      $or: [
        { targetEmail: req.user.email },
        { targetUserId: req.user._id },
      ],
      status: 'active',
      expiryDate: { $gt: new Date() },
    })
      .populate('ownerUserId', 'fullName email profilePhoto')
      .sort({ createdAt: -1 });

    return successResponse(res, 200, 'Shared profiles fetched', { accessList });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/shared-profile/:profileId ───────────────────────────────
const getSharedProfileRecords = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const access = await AccessControl.findOne({
      $or: [
        { targetEmail: req.user.email },
        { targetUserId: req.user._id },
      ],
      profileId,
      status: 'active',
      expiryDate: { $gt: new Date() },
    });

    if (!access) {
      return errorResponse(res, 403, 'Access denied or expired for this profile');
    }

    const profile = await FamilyProfile.findById(profileId);
    if (!profile) return errorResponse(res, 404, 'Profile not found');

    const records = await MedicalRecord.find({ profileId, isDeleted: false })
      .sort({ visitDate: -1 });

    return successResponse(res, 200, 'Shared profile records fetched', {
      profile,
      records,
      accessType: access.accessType,
      expiryDate: access.expiryDate,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/managed-account/:ownerUserId ────────────────────────────
const getManagedAccount = async (req, res, next) => {
  try {
    const { ownerUserId } = req.params;

    const access = await AccessControl.findOne({
      ownerUserId,
      $or: [{ targetEmail: req.user.email }, { targetUserId: req.user._id }],
      status: 'active',
      expiryDate: { $gt: new Date() },
    });

    if (!access) return errorResponse(res, 403, 'Access denied or expired');

    const owner = await User.findById(ownerUserId).select('fullName email profilePhoto');
    if (!owner) return errorResponse(res, 404, 'Account not found');

    const records = await MedicalRecord.find({ ownerUserId, isDeleted: false }).sort({ visitDate: -1 });

    return successResponse(res, 200, 'Account data fetched', {
      owner,
      records,
      accessType: access.accessType,
      expiryDate: access.expiryDate,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/check/:profileId ────────────────────────────────────────
const checkAccess = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const access = await AccessControl.findOne({
      $or: [
        { targetEmail: req.user.email },
        { targetUserId: req.user._id },
      ],
      profileId,
      status: 'active',
      expiryDate: { $gt: new Date() },
    });

    if (!access) {
      return successResponse(res, 200, 'No access', { hasAccess: false });
    }

    return successResponse(res, 200, 'Access found', {
      hasAccess: true,
      accessType: access.accessType,
      expiryDate: access.expiryDate,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupUser,
  shareAccess,
  revokeAccess,
  getGrantedAccess,
  getSharedWithMe,
  getSharedProfileRecords,
  getManagedAccount,
  checkAccess,
};
