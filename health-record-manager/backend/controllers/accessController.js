const { callProcedure } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Convert DB row to camelCase shape
const normaliseAccess = (row) => ({
  _id:          row.id,
  id:           row.id,
  ownerUserId:  row.owner_user_id,
  targetEmail:  row.target_email,
  targetUserId: row.target_user_id,
  profileId:    row.profile_id,
  accessType:   row.access_type,
  expiryDate:   row.expiry_date,
  status:       row.status,
  sharedBy:     row.shared_by,
  createdAt:    row.created_at,
  updatedAt:    row.updated_at,
  // Populated target user fields (from JOIN in stored procedure)
  targetUser: row.target_full_name ? {
    _id:          row.target_user_id,
    fullName:     row.target_full_name,
    email:        row.target_email_user || row.target_email,
    profilePhoto: row.target_profile_photo,
    role:         row.target_role,
  } : null,
  // Populated owner fields (for shared-with-me)
  ownerUser: row.owner_full_name ? {
    _id:          row.owner_user_id,
    fullName:     row.owner_full_name,
    email:        row.owner_email,
    profilePhoto: row.owner_profile_photo,
  } : null,
});

// ─── GET /api/access/lookup-user ──────────────────────────────────────────────
const lookupUser = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return errorResponse(res, 400, 'Email is required');

    if (email.toLowerCase() === req.user.email.toLowerCase()) {
      return errorResponse(res, 400, 'Cannot share access with yourself');
    }

    const results = await callProcedure('GetUserByEmail', [email]);
    const user    = results[0]?.[0];

    if (!user) {
      return successResponse(res, 200, 'User not found', { found: false });
    }

    return successResponse(res, 200, 'User found', {
      found: true,
      user: {
        _id:          user.id,
        fullName:     user.full_name,
        email:        user.email,
        profilePhoto: user.profile_photo,
      },
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

    if (targetEmail.toLowerCase() === req.user.email.toLowerCase()) {
      return errorResponse(res, 400, 'Cannot share access with yourself');
    }

    // Target user must exist
    const userResult = await callProcedure('GetUserByEmail', [targetEmail]);
    const targetUser = userResult[0]?.[0];
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

    const expiryStr = expiryDate.toISOString().slice(0, 19).replace('T', ' ');

    // Check for existing active account-level grant
    const existingResult = await callProcedure('FindActiveAccountGrant', [
      req.user._id, targetUser.id,
    ]);
    const existing = existingResult[0]?.[0];

    let accessId;
    if (existing) {
      // CALL UpdateAccessGrant(id, accessType, expiryDate, targetEmail)
      await callProcedure('UpdateAccessGrant', [
        existing.id, accessType || 'view', expiryStr, targetEmail.toLowerCase(),
      ]);
      accessId = existing.id;
    } else {
      // CALL CreateAccessGrant(ownerUserId, targetEmail, targetUserId, profileId, accessType, expiryDate, sharedBy)
      const createResult = await callProcedure('CreateAccessGrant', [
        req.user._id,
        targetEmail.toLowerCase(),
        targetUser.id,
        0, // null profile_id = account-level
        accessType || 'view',
        expiryStr,
        req.user.fullName,
      ]);
      accessId = createResult[0]?.[0]?.id;
    }

    // Fetch the populated grant
    const grantResult = await callProcedure('GetAccessGrantById', [accessId]);
    const access = normaliseAccess(grantResult[0]?.[0]);

    return successResponse(res, existing ? 200 : 201,
      existing ? 'Access updated successfully' : 'Access shared successfully',
      { access }
    );
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/access/revoke/:id ───────────────────────────────────────��───
const revokeAccess = async (req, res, next) => {
  try {
    // CALL RevokeAccessGrant(id, ownerUserId)
    const result = await callProcedure('RevokeAccessGrant', [req.params.id, req.user._id]);
    if (!result[0]?.[0]?.affected) return errorResponse(res, 404, 'Access record not found');
    return successResponse(res, 200, 'Access revoked successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/granted ──────────────────────────────────────────────────
const getGrantedAccess = async (req, res, next) => {
  try {
    // Expire stale grants first
    await callProcedure('ExpireStaleGrants', []);

    // CALL GetGrantedAccess(ownerUserId)
    const results = await callProcedure('GetGrantedAccess', [req.user._id]);
    const accessList = (results[0] || []).map(normaliseAccess);

    return successResponse(res, 200, 'Access list fetched', { accessList });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/shared-with-me ──────────────────────────────────────────
const getSharedWithMe = async (req, res, next) => {
  try {
    // CALL GetSharedWithMe(targetEmail, targetUserId)
    const results = await callProcedure('GetSharedWithMe', [req.user.email, req.user._id]);
    const accessList = (results[0] || []).map(normaliseAccess);

    return successResponse(res, 200, 'Shared profiles fetched', { accessList });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/shared-profile/:profileId ───────────────────────────────
const getSharedProfileRecords = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    // Check access to this profile
    const accessResult = await callProcedure('CheckAccountAccess', [
      profileId, req.user.email, req.user._id,
    ]);
    const access = accessResult[0]?.[0];

    if (!access) {
      return errorResponse(res, 403, 'Access denied or expired for this profile');
    }

    return successResponse(res, 200, 'Shared profile records fetched', {
      accessType:  access.access_type,
      expiryDate:  access.expiry_date,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/managed-account/:ownerUserId ────────────────────────────
const getManagedAccount = async (req, res, next) => {
  try {
    const { ownerUserId } = req.params;

    // CALL CheckAccountAccess(ownerUserId, email, userId)
    const accessResult = await callProcedure('CheckAccountAccess', [
      ownerUserId, req.user.email, req.user._id,
    ]);
    const access = accessResult[0]?.[0];

    if (!access) return errorResponse(res, 403, 'Access denied or expired');

    // Get owner info
    const ownerResult = await callProcedure('GetUserById', [ownerUserId]);
    const owner = ownerResult[0]?.[0];
    if (!owner) return errorResponse(res, 404, 'Account not found');

    // Get all records for this owner
    const recordsResult = await callProcedure('GetAllRecordsForAnalytics', [ownerUserId]);
    const records = (recordsResult[0] || []).map((row) => {
      const { callProcedure: _, ...rest } = row;
      return {
        _id:          row.id,
        ownerUserId:  row.owner_user_id,
        recordType:   row.record_type,
        doctorName:   row.doctor_name,
        hospitalName: row.hospital_name,
        diagnosis:    row.diagnosis,
        visitDate:    row.visit_date,
        createdAt:    row.created_at,
      };
    });

    return successResponse(res, 200, 'Account data fetched', {
      owner: {
        _id:          owner.id,
        fullName:     owner.full_name,
        email:        owner.email,
        profilePhoto: owner.profile_photo,
      },
      records,
      accessType:  access.access_type,
      expiryDate:  access.expiry_date,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/access/check/:profileId ────────────────────────────────────────
const checkAccess = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const accessResult = await callProcedure('CheckAccountAccess', [
      profileId, req.user.email, req.user._id,
    ]);
    const access = accessResult[0]?.[0];

    if (!access) {
      return successResponse(res, 200, 'No access', { hasAccess: false });
    }

    return successResponse(res, 200, 'Access found', {
      hasAccess:   true,
      accessType:  access.access_type,
      expiryDate:  access.expiry_date,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupUser, shareAccess, revokeAccess, getGrantedAccess,
  getSharedWithMe, getSharedProfileRecords, getManagedAccount, checkAccess,
};
