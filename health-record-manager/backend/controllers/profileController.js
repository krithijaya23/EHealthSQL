const { callProcedure } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Convert DB row (snake_case + raw arrays) to camelCase shape
const normaliseProfile = (row) => ({
  _id:               row.id,
  id:                row.id,
  ownerUserId:       row.owner_user_id,
  profileName:       row.profile_name,
  actualName:        row.actual_name || '',
  age:               row.age,
  gender:            row.gender,
  bloodGroup:        row.blood_group,
  relationship:      row.relationship,
  dateOfBirth:       row.date_of_birth,
  profilePhoto:      row.profile_photo,
  isDefaultProfile:  !!row.is_default_profile,
  isActive:          !!row.is_active,
  allergies:         row.allergies_raw         ? row.allergies_raw.split('||').filter(Boolean)         : [],
  chronicConditions: row.chronic_conditions_raw ? row.chronic_conditions_raw.split('||').filter(Boolean) : [],
  createdAt:         row.created_at,
  updatedAt:         row.updated_at,
});

// ─── GET /api/profiles ────────────────────────────────────────────────────────
const getProfiles = async (req, res, next) => {
  try {
    // CALL GetProfiles(ownerUserId)
    const results  = await callProcedure('GetProfiles', [req.user._id]);
    const profiles = (results[0] || []).map(normaliseProfile);
    return successResponse(res, 200, 'Profiles fetched', { profiles });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/profiles/:id ────────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    // CALL GetProfileById(id, ownerUserId)
    const results = await callProcedure('GetProfileById', [req.params.id, req.user._id]);
    const row     = results[0]?.[0];

    if (!row) return errorResponse(res, 404, 'Profile not found');

    return successResponse(res, 200, 'Profile fetched', { profile: normaliseProfile(row) });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/profiles ───────────────────────────────────────────────────────
const createProfile = async (req, res, next) => {
  try {
    // Limit profiles per user — CALL CountActiveProfiles(ownerUserId)
    const countResult = await callProcedure('CountActiveProfiles', [req.user._id]);
    if ((countResult[0]?.[0]?.cnt || 0) >= 10) {
      return errorResponse(res, 400, 'Maximum 10 family profiles allowed');
    }

    const { profileName, age, gender, bloodGroup, relationship, dateOfBirth, actualName, allergies, chronicConditions } = req.body;

    // CALL CreateProfile(ownerUserId, profileName, actualName, age, gender, bloodGroup, relationship, dateOfBirth)
    const result = await callProcedure('CreateProfile', [
      req.user._id,
      profileName,
      actualName || '',
      age,
      gender,
      bloodGroup || 'Unknown',
      relationship,
      dateOfBirth || null,
    ]);
    const newId = result[0]?.[0]?.id;

    // Insert allergies
    for (const a of (allergies || [])) {
      if (a && a.trim()) {
        await callProcedure('AddProfileAllergy', [newId, a.trim()]);
      }
    }

    // Insert chronic conditions
    for (const c of (chronicConditions || [])) {
      if (c && c.trim()) {
        await callProcedure('AddProfileChronicCondition', [newId, c.trim()]);
      }
    }

    // Fetch the created profile
    const profileResult = await callProcedure('GetProfileById', [newId, req.user._id]);
    const profile = normaliseProfile(profileResult[0]?.[0]);

    return successResponse(res, 201, 'Profile created successfully', { profile });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/profiles/:id ────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { profileName, actualName, age, gender, bloodGroup, relationship, dateOfBirth, allergies, chronicConditions } = req.body;

    // CALL UpdateProfile(id, ownerUserId, ...)
    const updateResult = await callProcedure('UpdateProfile', [
      req.params.id,
      req.user._id,
      profileName   || null,
      actualName    || null,
      age           || null,
      gender        || null,
      bloodGroup    || null,
      relationship  || null,
      dateOfBirth   || null,
    ]);

    if (!updateResult[0]?.[0]?.affected) {
      return errorResponse(res, 404, 'Profile not found');
    }

    // Replace allergies if provided
    if (Array.isArray(allergies)) {
      await callProcedure('DeleteProfileAllergies', [req.params.id]);
      for (const a of allergies) {
        if (a && a.trim()) await callProcedure('AddProfileAllergy', [req.params.id, a.trim()]);
      }
    }

    // Replace chronic conditions if provided
    if (Array.isArray(chronicConditions)) {
      await callProcedure('DeleteProfileChronicConditions', [req.params.id]);
      for (const c of chronicConditions) {
        if (c && c.trim()) await callProcedure('AddProfileChronicCondition', [req.params.id, c.trim()]);
      }
    }

    const profileResult = await callProcedure('GetProfileById', [req.params.id, req.user._id]);
    const profile = normaliseProfile(profileResult[0]?.[0]);

    return successResponse(res, 200, 'Profile updated', { profile });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/profiles/:id ─────────────────────────────────────────────────
const deleteProfile = async (req, res, next) => {
  try {
    // CALL DeleteProfile(id, ownerUserId)
    const result = await callProcedure('DeleteProfile', [req.params.id, req.user._id]);
    if (!result[0]?.[0]?.affected) {
      return errorResponse(res, 404, 'Profile not found');
    }
    return successResponse(res, 200, 'Profile deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfiles, getProfile, createProfile, updateProfile, deleteProfile };
