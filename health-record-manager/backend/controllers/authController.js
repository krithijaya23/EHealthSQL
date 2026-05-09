const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { sendPasswordResetOTP } = require('../services/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory OTP store: { email -> { otp, expiresAt, attempts } }
const otpStore = new Map();

// ─── Helper: build safe user object for response ──────────────────────────────
const safeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  profilePhoto: user.profilePhoto,
  authProvider: user.authProvider,
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
const signup = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      return errorResponse(res, 400, 'Please provide fullName, email and password');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'Email already registered');
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role: role || 'patient',
      authProvider: 'local',
    });

    const token = generateToken(user._id);
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

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    if (user.authProvider === 'google') {
      return errorResponse(res, 400, 'This account uses Google Sign-In. Please use "Continue with Google".');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    const freshUser = await User.findById(user._id);

    return successResponse(res, 200, 'Login successful', {
      token,
      user: safeUser(freshUser),
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

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNewUser = false;

    if (user) {
      if (!user.googleId) user.googleId = googleId;
      if (!user.profilePhoto && picture) user.profilePhoto = picture;
      user.authProvider = 'google';
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });
    } else {
      user = await User.create({
        fullName: name,
        email,
        googleId,
        profilePhoto: picture || null,
        authProvider: 'google',
        role: role || 'patient',
        lastLogin: new Date(),
      });
      isNewUser = true;
    }

    const token = generateToken(user._id);
    const freshUser = await User.findById(user._id);

    return successResponse(res, isNewUser ? 201 : 200,
      isNewUser ? 'Account created with Google' : 'Google login successful',
      { token, user: safeUser(freshUser) }
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return successResponse(res, 200, 'User fetched', { user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/auth/update ─────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, role } = req.body;
    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (role && ['patient', 'doctor'].includes(role)) updates.role = role;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    return successResponse(res, 200, 'Profile updated', { user: safeUser(user) });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/auth/change-password ───────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (user.authProvider === 'google') {
      return errorResponse(res, 400, 'Google accounts cannot change password here');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 400, 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

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

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return successResponse(res, 200, 'If this email exists, an OTP has been sent');
    }

    if (user.authProvider === 'google') {
      return errorResponse(res, 400, 'This account uses Google Sign-In. Please sign in with Google.');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email.toLowerCase(), { otp, expiresAt, attempts: 0 });

    const result = await sendPasswordResetOTP(email, otp, user.fullName);

    if (result.devMode) {
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

    const resetToken = crypto.randomBytes(32).toString('hex');
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

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return errorResponse(res, 404, 'User not found');

    user.password = newPassword;
    await user.save();

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
