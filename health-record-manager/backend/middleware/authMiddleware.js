const jwt = require('jsonwebtoken');
const { callProcedure } = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // CALL GetUserById(id)
    const results = await callProcedure('GetUserById', [decoded.id]);
    const user = results[0]?.[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // Normalise field names to match what controllers expect
    req.user = {
      _id:          user.id,
      id:           user.id,
      fullName:     user.full_name,
      email:        user.email,
      role:         user.role,
      profilePhoto: user.profile_photo,
      authProvider: user.auth_provider,
      isActive:     user.is_active,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
