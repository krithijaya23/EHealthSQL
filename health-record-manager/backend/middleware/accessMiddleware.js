const { callProcedure } = require('../config/db');

/**
 * Middleware: verify user owns the profile OR has active shared access.
 * Sets req.profile, req.accessType ('owner' | 'view' | 'upload' | 'manage')
 */
const checkProfileAccess = async (req, res, next) => {
  try {
    const profileId = req.params.profileId || req.body.profileId;

    if (!profileId) {
      return res.status(400).json({ success: false, message: 'Profile ID is required' });
    }

    // 1. Owner check — CALL GetProfileById(id, ownerUserId)
    const ownerResults = await callProcedure('GetProfileById', [profileId, req.user._id]);
    const ownedProfile = ownerResults[0]?.[0];

    if (ownedProfile) {
      req.profile    = normaliseProfile(ownedProfile);
      req.accessType = 'owner';
      return next();
    }

    // 2. Shared access check — CALL CheckAccountAccess(ownerUserId, email, userId)
    // Here we check if the logged-in user has access to the profile's owner account
    // We need to find the profile owner first
    const profileResults = await callProcedure('GetProfileById', [profileId, 0]);
    // profileId with owner=0 won't match — use raw pool query instead
    const { pool } = require('../config/db');
    const [rows] = await pool.execute(
      'SELECT * FROM family_profiles WHERE id = ? AND is_active = 1 LIMIT 1',
      [profileId]
    );
    const profile = rows[0];

    if (!profile) {
      return res.status(403).json({ success: false, message: 'Access denied to this profile' });
    }

    const accessResults = await callProcedure('CheckAccountAccess', [
      profile.owner_user_id,
      req.user.email,
      req.user._id,
    ]);
    const access = accessResults[0]?.[0];

    if (!access) {
      return res.status(403).json({ success: false, message: 'Access denied to this profile' });
    }

    req.profile    = normaliseProfile(profile);
    req.accessType = access.access_type;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: require upload permission (owner, upload, or manage access type)
 */
const requireUploadAccess = (req, res, next) => {
  if (req.accessType === 'owner' || req.accessType === 'upload' || req.accessType === 'manage') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Upload permission required for this profile',
  });
};

// Convert snake_case DB row to camelCase for controllers
const normaliseProfile = (row) => ({
  _id:               row.id,
  id:                row.id,
  ownerUserId:       row.owner_user_id,
  profileName:       row.profile_name,
  actualName:        row.actual_name,
  age:               row.age,
  gender:            row.gender,
  bloodGroup:        row.blood_group,
  relationship:      row.relationship,
  dateOfBirth:       row.date_of_birth,
  profilePhoto:      row.profile_photo,
  isDefaultProfile:  !!row.is_default_profile,
  isActive:          !!row.is_active,
  allergies:         row.allergies_raw ? row.allergies_raw.split('||') : [],
  chronicConditions: row.chronic_conditions_raw ? row.chronic_conditions_raw.split('||') : [],
  createdAt:         row.created_at,
  updatedAt:         row.updated_at,
});

module.exports = { checkProfileAccess, requireUploadAccess };
