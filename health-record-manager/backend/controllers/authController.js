const { OAuth2Client } = require('google-auth-library');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const { callProcedure } = require('../config/db');
const generateToken     = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { sendPasswordResetOTP } = require('../services/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory OTP store: { email -> { otp, expiresAt, attempts } }
const otpStore = new Map();

// ─── Helper: build safe user object for response ──────────────────────────────
const safeUser = (row) => ({
  _id:          row.id,
  fullName:     row.full_name,
  email:        row.email,
  role:         row.role,
  profilePhoto: row.profile_photo,
  authProvider: row.auth_provider,
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
const signup = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      return errorResponse(res, 400, 'Please provide fullName, email and password');
    }

    // Check duplicate email — CALL CheckEmailExists(email)
    const checkResult = await callProcedure('CheckEmailExists', [email]);
    if (checkResult[0]?.[0]?.cnt > 0) {
      return errorResponse(res, 400, 'Email already registered');
    }

    // Hash password
    const salt     = await bcrypt.genSalt(12);
    const hashed   = await bcrypt.hash(password, salt);

    // CALL CreateUser(fullName, email, hashedPassword, role, authProvider)
    const result = await callProcedure('CreateUser', [
      fullName, email, hashed, role || 'patient', 'local',
    ]);
    const newId = result[0]?.[0]?.id;

    // Fetch the created user
    const userResult = await callProcedure('GetUserById', [newId]);
    const user = userResult[0]?.[0];

    const token = generateToken(user.id);
    return successResponse(res, 201, 'Account created successfully', {
      token,
      user: safeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Please provide email and password');
    }

    // CALL GetUserByEmail(email) — returns password hash too
    const result = await callProcedure('GetUserByEmail', [email]);
    const user   = result[0]?.[0];

    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    if (user.auth_provider === 'google') {
      return errorResponse(res, 400, 'This account uses Google Sign-In. Please use "Continue with Google".');
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // CALL UpdateLastLogin(id)
    await callProcedure('UpdateLastLogin', [user.id]);

    const token = generateToken(user.id);
    return successResponse(res, 200, 'Login successful', {
      token,
      user: safeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/auth/google ────────────────────────────────────────────────────
const googleAuth = async (req, res, next) => {
  try {
    const { credential, role, userInfo } = req.body;

    let googleId, email, name, picture;

    if (userInfo) {
      ({ sub: googleId, email, name, picture } = userInfo);
    } else if (credential) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        ({ sub: googleId, email, name, picture } = payload);
      } catch (err) {
        return errorResponse(res, 401, 'Invalid Google token');
      }
    } else {
      return errorResponse(res, 400, 'Google credential or userInfo is required');
    }

    if (!email || !googleId) {
      return errorResponse(res, 400, 'Could not retrieve Google account information');
    }

    // CALL GetUserByGoogleIdOrEmail(googleId, email)
    const findResult = await callProcedure('GetUserByGoogleIdOrEmail', [googleId, email]);
    let user     = findResult[0]?.[0];
    let isNewUser = false;

    if (user) {
      // CALL UpdateGoogleUserOnLogin(id, googleId, profilePhoto)
      await callProcedure('UpdateGoogleUserOnLogin', [user.id, googleId, picture || null]);
      // Re-fetch fresh data
      const fresh = await callProcedure('GetUserById', [user.id]);
      user = fresh[0]?.[0];
    } else {
      // CALL CreateGoogleUser(fullName, email, googleId, profilePhoto, role)
      const createResult = await callProcedure('CreateGoogleUser', [
        name, email, googleId, picture || null, role || 'patient',
      ]);
      const newId = createResult[0]?.[0]?.id;
      const fresh = await callProcedure('GetUserById', [newId]);
      user = fresh[0]?.[0];
      isNewUser = true;
    }

    const token = generateToken(user.id);
    return successResponse(res, isNewUser ? 201 : 200,
      isNewUser ? 'Account created with Google' : 'Google login successful',
      { token, user: safeUser(user) }
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const result = await callProcedure('GetUserById', [req.user._id]);
    const user   = result[0]?.[0];
    return successResponse(res, 200, 'User fetched', { user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/auth/update ─────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, role } = req.body;
    const safeRole = role && ['patient', 'doctor'].includes(role) ? role : '';

    // CALL UpdateUserProfile(id, fullName, role)
    await callProcedure('UpdateUserProfile', [req.user._id, fullName || '', safeRole]);

    const result = await callProcedure('GetUserById', [req.user._id]);
    const user   = result[0]?.[0];
    return successResponse(res, 200, 'Profile updated', { user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/auth/change-password ───────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // CALL GetUserPasswordHash(id)
    const result = await callProcedure('GetUserPasswordHash', [req.user._id]);
    const row    = result[0]?.[0];

    if (row?.auth_provider === 'google') {
      return errorResponse(res, 400, 'Google accounts cannot change password here');
    }

    const isMatch = await bcrypt.compare(currentPassword, row?.password || '');
    if (!isMatch) {
      return errorResponse(res, 400, 'Current password is incorrect');
    }

    const salt    = await bcrypt.genSalt(12);
    const hashed  = await bcrypt.hash(newPassword, salt);

    // CALL UpdateUserPassword(id, hashedPassword)
    await callProcedure('UpdateUserPassword', [req.user._id, hashed]);

    return successResponse(res, 200, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 400, 'Email is required');

    const result = await callProcedure('GetUserByEmail', [email.toLowerCase()]);
    const user   = result[0]?.[0];

    if (!user) {
      return successResponse(res, 200, 'If this email exists, an OTP has been sent');
    }

    if (user.auth_provider === 'google') {
      return errorResponse(res, 400, 'This account uses Google Sign-In. Please sign in with Google.');
    }

    const otp       = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email.toLowerCase(), { otp, expiresAt, attempts: 0 });

    const emailResult = await sendPasswordResetOTP(email, otp, user.full_name);

    if (emailResult.devMode) {
      return successResponse(res, 200, 'OTP generated (dev mode)', {
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
      });
    }

    return successResponse(res, 200, 'OTP sent to your email address');
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return errorResponse(res, 400, 'Email and OTP are required');

    const stored = otpStore.get(email.toLowerCase());

    if (!stored) return errorResponse(res, 400, 'OTP not found or already used. Please request a new one.');
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return errorResponse(res, 400, 'OTP has expired. Please request a new one.');
    }

    stored.attempts += 1;
    if (stored.attempts > 5) {
      otpStore.delete(email.toLowerCase());
      return errorResponse(res, 429, 'Too many attempts. Please request a new OTP.');
    }

    if (stored.otp !== otp.toString()) {
      return errorResponse(res, 400, `Invalid OTP. ${5 - stored.attempts} attempts remaining.`);
    }

    const resetToken      = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 15 * 60 * 1000;

    otpStore.set(email.toLowerCase(), { resetToken, resetTokenExpiry, verified: true });

    return successResponse(res, 200, 'OTP verified successfully', { resetToken });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return errorResponse(res, 400, 'Email, reset token, and new password are required');
    }
    if (newPassword.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    const stored = otpStore.get(email.toLowerCase());

    if (!stored?.verified) return errorResponse(res, 400, 'Invalid or expired reset session. Please start over.');
    if (Date.now() > stored.resetTokenExpiry) {
      otpStore.delete(email.toLowerCase());
      return errorResponse(res, 400, 'Reset session expired. Please start over.');
    }
    if (stored.resetToken !== resetToken) {
      return errorResponse(res, 400, 'Invalid reset token.');
    }

    const result = await callProcedure('GetUserByEmail', [email.toLowerCase()]);
    const user   = result[0]?.[0];
    if (!user) return errorResponse(res, 404, 'User not found');

    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newPassword, salt);

    // CALL UpdateUserPassword(id, hashedPassword)
    await callProcedure('UpdateUserPassword', [user.id, hashed]);

    otpStore.delete(email.toLowerCase());

    return successResponse(res, 200, 'Password reset successfully. You can now sign in.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup, login, googleAuth, getMe, updateProfile, changePassword,
  forgotPassword, verifyOTP, resetPassword,
};
