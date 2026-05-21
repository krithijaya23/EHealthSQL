const mysql = require('mysql2/promise');

// Create a connection pool — reuses connections efficiently
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'health_record_manager',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  // Return JS Date objects for DATE/DATETIME columns
  dateStrings:        false,
});

// Test the connection on startup
const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ MySQL Connected: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'health_record_manager'}`);
    conn.release();
  } catch (error) {
    console.error('❌ MySQL connection error:', error.message);
    process.exit(1);
  }
};

/**
 * Execute a stored procedure.
 * Usage: callProcedure('ProcedureName', [arg1, arg2, ...])
 * Returns: array of result sets — result[0] is the first SELECT, result[1] the second, etc.
 */
const callProcedure = async (name, params = []) => {
  const placeholders = params.map(() => '?').join(', ');
  const sql = `CALL ${name}(${placeholders})`;
  const [results] = await pool.execute(sql, params);
  return results; // array of result sets
};

module.exports = { pool, connectDB, callProcedure };
