const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // MySQL duplicate entry (e.g. unique email)
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 400;
    // Extract the duplicate field name from the MySQL error message
    const match = err.message.match(/for key '(.+?)'/);
    const field = match ? match[1].replace(/.*\./, '') : 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // MySQL data too long
  if (err.code === 'ER_DATA_TOO_LONG') {
    statusCode = 400;
    message = 'Input value is too long for one of the fields';
  }

  // MySQL bad enum value
  if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'WARN_DATA_TRUNCATED') {
    statusCode = 400;
    message = 'Invalid value provided for one of the fields';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
