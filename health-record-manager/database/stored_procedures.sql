-- ============================================================
-- Health Record Manager — Stored Procedures
-- Run AFTER schema.sql
-- Optimized for MySQL Workbench Execution
-- ============================================================

USE health_record_manager;

DELIMITER $$

-- ════════════════════════════════════════════════════════════
-- USER PROCEDURES
-- ════════════════════════════════════════════════════════════

-- Create a new local user
DROP PROCEDURE IF EXISTS CreateUser$$
CREATE PROCEDURE CreateUser(
  IN p_full_name     VARCHAR(100),
  IN p_email         VARCHAR(255),
  IN p_password      VARCHAR(255),
  IN p_role          VARCHAR(20),
  IN p_auth_provider VARCHAR(20)
)
BEGIN
  INSERT INTO users (full_name, email, password, role, auth_provider)
  VALUES (p_full_name, LOWER(p_email), p_password, p_role, p_auth_provider);
  SELECT LAST_INSERT_ID() AS id;
END$$

-- Get user by email (for login)
DROP PROCEDURE IF EXISTS GetUserByEmail$$
CREATE PROCEDURE GetUserByEmail(IN p_email VARCHAR(255))
BEGIN
  SELECT id, full_name, email, password, role, profile_photo,
         google_id, auth_provider, is_active, last_login, created_at, updated_at
  FROM users
  WHERE email = LOWER(p_email)
  LIMIT 1;
END$$

-- Get user by ID
DROP PROCEDURE IF EXISTS GetUserById$$
CREATE PROCEDURE GetUserById(IN p_id INT UNSIGNED)
BEGIN
  SELECT id, full_name, email, role, profile_photo,
         google_id, auth_provider, is_active, last_login, created_at, updated_at
  FROM users
  WHERE id = p_id
  LIMIT 1;
END$$

-- Get user by Google ID or email (for Google OAuth)
DROP PROCEDURE IF EXISTS GetUserByGoogleIdOrEmail$$
CREATE PROCEDURE GetUserByGoogleIdOrEmail(
  IN p_google_id VARCHAR(255),
  IN p_email     VARCHAR(255)
)
BEGIN
  SELECT id, full_name, email, password, role, profile_photo,
         google_id, auth_provider, is_active, last_login, created_at, updated_at
  FROM users
  WHERE google_id = p_google_id OR email = LOWER(p_email)
  LIMIT 1;
END$$

-- Create Google user
DROP PROCEDURE IF EXISTS CreateGoogleUser$$
CREATE PROCEDURE CreateGoogleUser(
  IN p_full_name     VARCHAR(100),
  IN p_email         VARCHAR(255),
  IN p_google_id     VARCHAR(255),
  IN p_profile_photo VARCHAR(500),
  IN p_role          VARCHAR(20)
)
BEGIN
  INSERT INTO users (full_name, email, google_id, profile_photo, auth_provider, role, last_login)
  VALUES (p_full_name, LOWER(p_email), p_google_id, p_profile_photo, 'google', p_role, NOW());
  SELECT LAST_INSERT_ID() AS id;
END$$

-- Update Google user on login
DROP PROCEDURE IF EXISTS UpdateGoogleUserOnLogin$$
CREATE PROCEDURE UpdateGoogleUserOnLogin(
  IN p_id            INT UNSIGNED,
  IN p_google_id     VARCHAR(255),
  IN p_profile_photo VARCHAR(500)
)
BEGIN
  UPDATE users
  SET google_id     = COALESCE(google_id, p_google_id),
      profile_photo = COALESCE(profile_photo, p_profile_photo),
      auth_provider = 'google',
      last_login    = NOW(),
      updated_at    = NOW()
  WHERE id = p_id;
END$$

-- Update last login timestamp
DROP PROCEDURE IF EXISTS UpdateLastLogin$$
CREATE PROCEDURE UpdateLastLogin(IN p_id INT UNSIGNED)
BEGIN
  UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = p_id;
END$$

-- Update user profile (name / role)
DROP PROCEDURE IF EXISTS UpdateUserProfile$$
CREATE PROCEDURE UpdateUserProfile(
  IN p_id        INT UNSIGNED,
  IN p_full_name VARCHAR(100),
  IN p_role      VARCHAR(20)
)
BEGIN
  UPDATE users
  SET full_name  = COALESCE(NULLIF(p_full_name,''), full_name),
      role       = COALESCE(NULLIF(p_role,''), role),
      updated_at = NOW()
  WHERE id = p_id;
  CALL GetUserById(p_id);
END$$

-- Update password
DROP PROCEDURE IF EXISTS UpdateUserPassword$$
CREATE PROCEDURE UpdateUserPassword(
  IN p_id       INT UNSIGNED,
  IN p_password VARCHAR(255)
)
BEGIN
  UPDATE users SET password = p_password, updated_at = NOW() WHERE id = p_id;
END$$

-- Get user password hash (for change-password / login)
DROP PROCEDURE IF EXISTS GetUserPasswordHash$$
CREATE PROCEDURE GetUserPasswordHash(IN p_id INT UNSIGNED)
BEGIN
  SELECT id, password, auth_provider FROM users WHERE id = p_id LIMIT 1;
END$$

-- Check if email exists
DROP PROCEDURE IF EXISTS CheckEmailExists$$
CREATE PROCEDURE CheckEmailExists(IN p_email VARCHAR(255))
BEGIN
  SELECT COUNT(*) AS cnt FROM users WHERE email = LOWER(p_email);
END$$

-- ════════════════════════════════════════════════════════════
-- FAMILY PROFILE PROCEDURES
-- ════════════════════════════════════════════════════════════

-- Get all active profiles for a user
DROP PROCEDURE IF EXISTS GetProfiles$$
CREATE PROCEDURE GetProfiles(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT fp.*,
    (SELECT GROUP_CONCAT(allergy ORDER BY id SEPARATOR '||')
     FROM profile_allergies WHERE profile_id = fp.id) AS allergies_raw,
    (SELECT GROUP_CONCAT(condition_name ORDER BY id SEPARATOR '||')
     FROM profile_chronic_conditions WHERE profile_id = fp.id) AS chronic_conditions_raw
  FROM family_profiles fp
  WHERE fp.owner_user_id = p_owner_user_id AND fp.is_active = 1
  ORDER BY fp.created_at ASC;
END$$

-- Get single profile
DROP PROCEDURE IF EXISTS GetProfileById$$
CREATE PROCEDURE GetProfileById(
  IN p_id           INT UNSIGNED,
  IN p_owner_user_id INT UNSIGNED
)
BEGIN
  SELECT fp.*,
    (SELECT GROUP_CONCAT(allergy ORDER BY id SEPARATOR '||')
     FROM profile_allergies WHERE profile_id = fp.id) AS allergies_raw,
    (SELECT GROUP_CONCAT(condition_name ORDER BY id SEPARATOR '||')
     FROM profile_chronic_conditions WHERE profile_id = fp.id) AS chronic_conditions_raw
  FROM family_profiles fp
  WHERE fp.id = p_id AND fp.owner_user_id = p_owner_user_id AND fp.is_active = 1
  LIMIT 1;
END$$

-- Count active profiles for a user
DROP PROCEDURE IF EXISTS CountActiveProfiles$$
CREATE PROCEDURE CountActiveProfiles(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT COUNT(*) AS cnt FROM family_profiles
  WHERE owner_user_id = p_owner_user_id AND is_active = 1;
END$$

-- Create family profile
DROP PROCEDURE IF EXISTS CreateProfile$$
CREATE PROCEDURE CreateProfile(
  IN p_owner_user_id INT UNSIGNED,
  IN p_profile_name  VARCHAR(100),
  IN p_actual_name   VARCHAR(100),
  IN p_age           TINYINT UNSIGNED,
  IN p_gender        VARCHAR(10),
  IN p_blood_group   VARCHAR(10),
  IN p_relationship  VARCHAR(20),
  IN p_date_of_birth DATE
)
BEGIN
  INSERT INTO family_profiles
    (owner_user_id, profile_name, actual_name, age, gender, blood_group, relationship, date_of_birth)
  VALUES
    (p_owner_user_id, p_profile_name, p_actual_name, p_age, p_gender, p_blood_group, p_relationship, p_date_of_birth);
  SELECT LAST_INSERT_ID() AS id;
END$$

-- Add allergy to profile
DROP PROCEDURE IF EXISTS AddProfileAllergy$$
CREATE PROCEDURE AddProfileAllergy(IN p_profile_id INT UNSIGNED, IN p_allergy VARCHAR(200))
BEGIN
  INSERT INTO profile_allergies (profile_id, allergy) VALUES (p_profile_id, p_allergy);
END$$

-- Add chronic condition to profile
DROP PROCEDURE IF EXISTS AddProfileChronicCondition$$
CREATE PROCEDURE AddProfileChronicCondition(IN p_profile_id INT UNSIGNED, IN p_condition VARCHAR(200))
BEGIN
  INSERT INTO profile_chronic_conditions (profile_id, condition_name) VALUES (p_profile_id, p_condition);
END$$

-- Delete all allergies for a profile (used before re-inserting on update)
DROP PROCEDURE IF EXISTS DeleteProfileAllergies$$
CREATE PROCEDURE DeleteProfileAllergies(IN p_profile_id INT UNSIGNED)
BEGIN
  DELETE FROM profile_allergies WHERE profile_id = p_profile_id;
END$$

-- Delete all chronic conditions for a profile
DROP PROCEDURE IF EXISTS DeleteProfileChronicConditions$$
CREATE PROCEDURE DeleteProfileChronicConditions(IN p_profile_id INT UNSIGNED)
BEGIN
  DELETE FROM profile_chronic_conditions WHERE profile_id = p_profile_id;
END$$

-- Update family profile
DROP PROCEDURE IF EXISTS UpdateProfile$$
CREATE PROCEDURE UpdateProfile(
  IN p_id            INT UNSIGNED,
  IN p_owner_user_id INT UNSIGNED,
  IN p_profile_name  VARCHAR(100),
  IN p_actual_name   VARCHAR(100),
  IN p_age           TINYINT UNSIGNED,
  IN p_gender        VARCHAR(10),
  IN p_blood_group   VARCHAR(10),
  IN p_relationship  VARCHAR(20),
  IN p_date_of_birth DATE
)
BEGIN
  UPDATE family_profiles
  SET profile_name  = COALESCE(NULLIF(p_profile_name,''),  profile_name),
      actual_name   = COALESCE(p_actual_name, actual_name),
      age           = COALESCE(p_age,         age),
      gender        = COALESCE(NULLIF(p_gender,''),        gender),
      blood_group   = COALESCE(NULLIF(p_blood_group,''),   blood_group),
      relationship  = COALESCE(NULLIF(p_relationship,''),  relationship),
      date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
      updated_at    = NOW()
  WHERE id = p_id AND owner_user_id = p_owner_user_id;
  SELECT ROW_COUNT() AS affected;
END$$

-- Soft-delete a profile
DROP PROCEDURE IF EXISTS DeleteProfile$$
CREATE PROCEDURE DeleteProfile(IN p_id INT UNSIGNED, IN p_owner_user_id INT UNSIGNED)
BEGIN
  UPDATE family_profiles
  SET is_active = 0, updated_at = NOW()
  WHERE id = p_id AND owner_user_id = p_owner_user_id;
  SELECT ROW_COUNT() AS affected;
END$$

-- ════════════════════════════════════════════════════════════
-- MEDICAL RECORD PROCEDURES
-- ════════════════════════════════════════════════════════════

-- Insert a new medical record (returns new id)
DROP PROCEDURE IF EXISTS CreateMedicalRecord$$
CREATE PROCEDURE CreateMedicalRecord(
  IN p_owner_user_id         INT UNSIGNED,
  IN p_uploaded_by_user_id   INT UNSIGNED,
  IN p_record_type           VARCHAR(30),
  IN p_doctor_name           VARCHAR(150),
  IN p_hospital_name         VARCHAR(200),
  IN p_diagnosis             TEXT,
  IN p_notes                 TEXT,
  IN p_visit_date            DATE,
  IN p_lab_name              VARCHAR(200),
  IN p_patient_name          VARCHAR(150),
  IN p_impression            TEXT,
  IN p_scan_type             VARCHAR(100),
  IN p_body_part             VARCHAR(100),
  IN p_findings              TEXT,
  IN p_admission_date        VARCHAR(50),
  IN p_discharge_date        VARCHAR(50),
  IN p_treatment_summary     TEXT,
  IN p_discharge_advice      TEXT,
  IN p_condition_at_discharge VARCHAR(200),
  IN p_bill_number           VARCHAR(100),
  IN p_total_amount          VARCHAR(50),
  IN p_extracted_text        LONGTEXT,
  IN p_ocr_processed         TINYINT(1),
  IN p_ocr_confidence        VARCHAR(10)
)
BEGIN
  INSERT INTO medical_records (
    owner_user_id, uploaded_by_user_id, record_type,
    doctor_name, hospital_name, diagnosis, notes, visit_date,
    lab_name, patient_name, impression,
    scan_type, body_part, findings,
    admission_date, discharge_date, treatment_summary, discharge_advice, condition_at_discharge,
    bill_number, total_amount,
    extracted_text, ocr_processed, ocr_confidence
  ) VALUES (
    p_owner_user_id, NULLIF(p_uploaded_by_user_id, 0), p_record_type,
    p_doctor_name, p_hospital_name, p_diagnosis, p_notes, p_visit_date,
    p_lab_name, p_patient_name, p_impression,
    p_scan_type, p_body_part, p_findings,
    p_admission_date, p_discharge_date, p_treatment_summary, p_discharge_advice, p_condition_at_discharge,
    p_bill_number, p_total_amount,
    p_extracted_text, p_ocr_processed, p_ocr_confidence
  );
  SELECT LAST_INSERT_ID() AS id;
END$$

-- Add medicine to a record
DROP PROCEDURE IF EXISTS AddRecordMedicine$$
CREATE PROCEDURE AddRecordMedicine(
  IN p_record_id INT UNSIGNED,
  IN p_name      VARCHAR(200),
  IN p_dosage    VARCHAR(100),
  IN p_frequency VARCHAR(100),
  IN p_duration  VARCHAR(100)
)
BEGIN
  INSERT INTO record_medicines (record_id, name, dosage, frequency, duration)
  VALUES (p_record_id, p_name, p_dosage, p_frequency, p_duration);
END$$

-- Add lab test to a record
DROP PROCEDURE IF EXISTS AddRecordLabTest$$
CREATE PROCEDURE AddRecordLabTest(
  IN p_record_id    INT UNSIGNED,
  IN p_test_name    VARCHAR(200),
  IN p_value        VARCHAR(100),
  IN p_unit         VARCHAR(50),
  IN p_normal_range VARCHAR(100),
  IN p_status       VARCHAR(20)
)
BEGIN
  INSERT INTO record_lab_tests (record_id, test_name, value, unit, normal_range, status)
  VALUES (p_record_id, p_test_name, p_value, p_unit, p_normal_range, p_status);
END$$

-- Add bill item to a record
DROP PROCEDURE IF EXISTS AddRecordBillItem$$
CREATE PROCEDURE AddRecordBillItem(
  IN p_record_id   INT UNSIGNED,
  IN p_description VARCHAR(300),
  IN p_amount      VARCHAR(50)
)
BEGIN
  INSERT INTO record_bill_items (record_id, description, amount)
  VALUES (p_record_id, p_description, p_amount);
END$$

-- Delete all medicines for a record (used before re-inserting on update)
DROP PROCEDURE IF EXISTS DeleteRecordMedicines$$
CREATE PROCEDURE DeleteRecordMedicines(IN p_record_id INT UNSIGNED)
BEGIN
  DELETE FROM record_medicines WHERE record_id = p_record_id;
END$$

-- Delete all lab tests for a record
DROP PROCEDURE IF EXISTS DeleteRecordLabTests$$
CREATE PROCEDURE DeleteRecordLabTests(IN p_record_id INT UNSIGNED)
BEGIN
  DELETE FROM record_lab_tests WHERE record_id = p_record_id;
END$$

-- Delete all bill items for a record
DROP PROCEDURE IF EXISTS DeleteRecordBillItems$$
CREATE PROCEDURE DeleteRecordBillItems(IN p_record_id INT UNSIGNED)
BEGIN
  DELETE FROM record_bill_items WHERE record_id = p_record_id;
END$$

-- Get records for a user with optional filters and pagination
DROP PROCEDURE IF EXISTS GetRecords$$
CREATE PROCEDURE GetRecords(
  IN p_owner_user_id INT UNSIGNED,
  IN p_search        VARCHAR(255),
  IN p_doctor        VARCHAR(150),
  IN p_hospital      VARCHAR(200),
  IN p_diagnosis     VARCHAR(255),
  IN p_record_type   VARCHAR(30),
  IN p_start_date    DATE,
  IN p_end_date      DATE,
  IN p_limit         INT,
  IN p_offset        INT
)
BEGIN
  -- Select matching rows
  SELECT 
    mr.*,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('name',rm.name,'dosage',rm.dosage,'frequency',rm.frequency,'duration',rm.duration))
     FROM record_medicines rm WHERE rm.record_id = mr.id) AS medicines_json,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('testName',rlt.test_name,'value',rlt.value,'unit',rlt.unit,'normalRange',rlt.normal_range,'status',rlt.status))
     FROM record_lab_tests rlt WHERE rlt.record_id = mr.id) AS lab_tests_json,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('description',rbi.description,'amount',rbi.amount))
     FROM record_bill_items rbi WHERE rbi.record_id = mr.id) AS bill_items_json
  FROM medical_records mr
  WHERE mr.owner_user_id = p_owner_user_id
    AND mr.is_deleted = 0
    AND (p_search IS NULL OR p_search = '' OR (
          mr.doctor_name   LIKE CONCAT('%', p_search, '%') OR
          mr.hospital_name LIKE CONCAT('%', p_search, '%') OR
          mr.diagnosis     LIKE CONCAT('%', p_search, '%')
        ))
    AND (p_doctor      IS NULL OR p_doctor      = '' OR mr.doctor_name   LIKE CONCAT('%', p_doctor,   '%'))
    AND (p_hospital    IS NULL OR p_hospital    = '' OR mr.hospital_name LIKE CONCAT('%', p_hospital, '%'))
    AND (p_diagnosis   IS NULL OR p_diagnosis   = '' OR mr.diagnosis     LIKE CONCAT('%', p_diagnosis,'%'))
    AND (p_record_type IS NULL OR p_record_type = '' OR mr.record_type   = p_record_type)
    AND (p_start_date  IS NULL OR mr.visit_date >= p_start_date)
    AND (p_end_date    IS NULL OR mr.visit_date <= p_end_date)
  ORDER BY mr.visit_date DESC
  LIMIT p_limit OFFSET p_offset;

  -- Compliant counter dataset that mimics FOUND_ROWS() for backend matching expectations
  SELECT COUNT(*) AS total 
  FROM medical_records mr
  WHERE mr.owner_user_id = p_owner_user_id
    AND mr.is_deleted = 0
    AND (p_search IS NULL OR p_search = '' OR (
          mr.doctor_name   LIKE CONCAT('%', p_search, '%') OR
          mr.hospital_name LIKE CONCAT('%', p_search, '%') OR
          mr.diagnosis     LIKE CONCAT('%', p_search, '%')
        ))
    AND (p_doctor      IS NULL OR p_doctor      = '' OR mr.doctor_name   LIKE CONCAT('%', p_doctor,   '%'))
    AND (p_hospital    IS NULL OR p_hospital    = '' OR mr.hospital_name LIKE CONCAT('%', p_hospital, '%'))
    AND (p_diagnosis   IS NULL OR p_diagnosis   = '' OR mr.diagnosis     LIKE CONCAT('%', p_diagnosis,'%'))
    AND (p_record_type IS NULL OR p_record_type = '' OR mr.record_type   = p_record_type)
    AND (p_start_date  IS NULL OR mr.visit_date >= p_start_date)
    AND (p_end_date    IS NULL OR mr.visit_date <= p_end_date);
END$$

-- Get a single record by ID (no owner filter — caller checks access)
DROP PROCEDURE IF EXISTS GetRecordById$$
CREATE PROCEDURE GetRecordById(IN p_id INT UNSIGNED)
BEGIN
  SELECT mr.*,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('name',rm.name,'dosage',rm.dosage,'frequency',rm.frequency,'duration',rm.duration))
     FROM record_medicines rm WHERE rm.record_id = mr.id) AS medicines_json,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('testName',rlt.test_name,'value',rlt.value,'unit',rlt.unit,'normalRange',rlt.normal_range,'status',rlt.status))
     FROM record_lab_tests rlt WHERE rlt.record_id = mr.id) AS lab_tests_json,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('description',rbi.description,'amount',rbi.amount))
     FROM record_bill_items rbi WHERE rbi.record_id = mr.id) AS bill_items_json
  FROM medical_records mr
  WHERE mr.id = p_id AND mr.is_deleted = 0
  LIMIT 1;
END$$

-- Update a medical record's scalar fields
DROP PROCEDURE IF EXISTS UpdateMedicalRecord$$
CREATE PROCEDURE UpdateMedicalRecord(
  IN p_id                    INT UNSIGNED,
  IN p_record_type           VARCHAR(30),
  IN p_doctor_name           VARCHAR(150),
  IN p_hospital_name         VARCHAR(200),
  IN p_diagnosis             TEXT,
  IN p_notes                 TEXT,
  IN p_visit_date            DATE,
  IN p_lab_name              VARCHAR(200),
  IN p_patient_name          VARCHAR(150),
  IN p_impression            TEXT,
  IN p_scan_type             VARCHAR(100),
  IN p_body_part             VARCHAR(100),
  IN p_findings              TEXT,
  IN p_admission_date        VARCHAR(50),
  IN p_discharge_date        VARCHAR(50),
  IN p_treatment_summary     TEXT,
  IN p_discharge_advice      TEXT,
  IN p_condition_at_discharge VARCHAR(200),
  IN p_bill_number           VARCHAR(100),
  IN p_total_amount          VARCHAR(50)
)
BEGIN
  UPDATE medical_records SET
    record_type            = COALESCE(NULLIF(p_record_type,''),           record_type),
    doctor_name            = COALESCE(p_doctor_name,                      doctor_name),
    hospital_name          = COALESCE(p_hospital_name,                    hospital_name),
    diagnosis              = COALESCE(p_diagnosis,                        diagnosis),
    notes                  = COALESCE(p_notes,                            notes),
    visit_date             = COALESCE(p_visit_date,                       visit_date),
    lab_name               = COALESCE(p_lab_name,                         lab_name),
    patient_name           = COALESCE(p_patient_name,                     patient_name),
    impression             = COALESCE(p_impression,                       impression),
    scan_type              = COALESCE(p_scan_type,                        scan_type),
    body_part              = COALESCE(p_body_part,                        body_part),
    findings               = COALESCE(p_findings,                         findings),
    admission_date         = COALESCE(p_admission_date,                   admission_date),
    discharge_date         = COALESCE(p_discharge_date,                   discharge_date),
    treatment_summary      = COALESCE(p_treatment_summary,                  treatment_summary),
    discharge_advice       = COALESCE(p_discharge_advice,                   discharge_advice),
    condition_at_discharge = COALESCE(p_condition_at_discharge,           condition_at_discharge),
    bill_number            = COALESCE(p_bill_number,                      bill_number),
    total_amount           = COALESCE(p_total_amount,                     total_amount),
    updated_at             = NOW()
  WHERE id = p_id AND is_deleted = 0;
  SELECT ROW_COUNT() AS affected;
END$$

-- Soft-delete a record
DROP PROCEDURE IF EXISTS DeleteMedicalRecord$$
CREATE PROCEDURE DeleteMedicalRecord(IN p_id INT UNSIGNED)
BEGIN
  UPDATE medical_records SET is_deleted = 1, updated_at = NOW() WHERE id = p_id;
  SELECT ROW_COUNT() AS affected;
END$$

-- Count records for a user (for dashboard)
DROP PROCEDURE IF EXISTS CountRecords$$
CREATE PROCEDURE CountRecords(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT COUNT(*) AS total FROM medical_records
  WHERE owner_user_id = p_owner_user_id AND is_deleted = 0;
END$$

-- Count records created this month
DROP PROCEDURE IF EXISTS CountRecordsThisMonth$$
CREATE PROCEDURE CountRecordsThisMonth(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT COUNT(*) AS total FROM medical_records
  WHERE owner_user_id = p_owner_user_id
    AND is_deleted = 0
    AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01');
END$$

-- Get recent records (for dashboard)
DROP PROCEDURE IF EXISTS GetRecentRecords$$
CREATE PROCEDURE GetRecentRecords(IN p_owner_user_id INT UNSIGNED, IN p_limit INT)
BEGIN
  SELECT id, record_type, doctor_name, hospital_name, diagnosis, visit_date, created_at
  FROM medical_records
  WHERE owner_user_id = p_owner_user_id AND is_deleted = 0
  ORDER BY created_at DESC
  LIMIT p_limit;
END$$

-- Get all non-deleted records for analytics (no pagination)
DROP PROCEDURE IF EXISTS GetAllRecordsForAnalytics$$
CREATE PROCEDURE GetAllRecordsForAnalytics(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT mr.*,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('name',rm.name,'dosage',rm.dosage,'frequency',rm.frequency,'duration',rm.duration))
     FROM record_medicines rm WHERE rm.record_id = mr.id) AS medicines_json,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('testName',rlt.test_name,'value',rlt.value,'unit',rlt.unit,'normalRange',rlt.normal_range,'status',rlt.status))
     FROM record_lab_tests rlt WHERE rlt.record_id = mr.id) AS lab_tests_json,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('description',rbi.description,'amount',rbi.amount))
     FROM record_bill_items rbi WHERE rbi.record_id = mr.id) AS bill_items_json
  FROM medical_records mr
  WHERE mr.owner_user_id = p_owner_user_id AND mr.is_deleted = 0
  ORDER BY mr.visit_date DESC;
END$$

-- ════════════════════════════════════════════════════════════
-- ACCESS CONTROL PROCEDURES
-- ════════════════════════════════════════════════════════════

-- Create an access grant
DROP PROCEDURE IF EXISTS CreateAccessGrant$$
CREATE PROCEDURE CreateAccessGrant(
  IN p_owner_user_id  INT UNSIGNED,
  IN p_target_email   VARCHAR(255),
  IN p_target_user_id INT UNSIGNED,
  IN p_profile_id     INT UNSIGNED,
  IN p_access_type    VARCHAR(20),
  IN p_expiry_date    DATETIME,
  IN p_shared_by      VARCHAR(100)
)
BEGIN
  INSERT INTO access_controls
    (owner_user_id, target_email, target_user_id, profile_id, access_type, expiry_date, shared_by, status)
  VALUES
    (p_owner_user_id, LOWER(p_target_email), NULLIF(p_target_user_id,0),
     NULLIF(p_profile_id,0), p_access_type, p_expiry_date, p_shared_by, 'active');
  SELECT LAST_INSERT_ID() AS id;
END$$

-- Update an existing access grant (upsert scenario)
DROP PROCEDURE IF EXISTS UpdateAccessGrant$$
CREATE PROCEDURE UpdateAccessGrant(
  IN p_id          INT UNSIGNED,
  IN p_access_type VARCHAR(20),
  IN p_expiry_date DATETIME,
  IN p_target_email VARCHAR(255)
)
BEGIN
  UPDATE access_controls
  SET access_type  = p_access_type,
      expiry_date  = p_expiry_date,
      target_email = LOWER(p_target_email),
      status       = 'active',
      updated_at   = NOW()
  WHERE id = p_id;
END$$

-- Find existing active account-level grant between two users
DROP PROCEDURE IF EXISTS FindActiveAccountGrant$$
CREATE PROCEDURE FindActiveAccountGrant(
  IN p_owner_user_id  INT UNSIGNED,
  IN p_target_user_id INT UNSIGNED
)
BEGIN
  SELECT * FROM access_controls
  WHERE owner_user_id  = p_owner_user_id
    AND target_user_id = p_target_user_id
    AND profile_id IS NULL
    AND status = 'active'
  LIMIT 1;
END$$

-- Revoke an access grant
DROP PROCEDURE IF EXISTS RevokeAccessGrant$$
CREATE PROCEDURE RevokeAccessGrant(IN p_id INT UNSIGNED, IN p_owner_user_id INT UNSIGNED)
BEGIN
  UPDATE access_controls
  SET status = 'revoked', updated_at = NOW()
  WHERE id = p_id AND owner_user_id = p_owner_user_id;
  SELECT ROW_COUNT() AS affected;
END$$

-- Get all grants given by a user (with target user info)
DROP PROCEDURE IF EXISTS GetGrantedAccess$$
CREATE PROCEDURE GetGrantedAccess(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT ac.*,
    u.full_name AS target_full_name,
    u.email     AS target_email_user,
    u.profile_photo AS target_profile_photo,
    u.role      AS target_role
  FROM access_controls ac
  LEFT JOIN users u ON u.id = ac.target_user_id
  WHERE ac.owner_user_id = p_owner_user_id
  ORDER BY ac.created_at DESC;
END$$

-- Get all active grants shared with a user (by email or userId)
DROP PROCEDURE IF EXISTS GetSharedWithMe$$
CREATE PROCEDURE GetSharedWithMe(
  IN p_target_email   VARCHAR(255),
  IN p_target_user_id INT UNSIGNED
)
BEGIN
  SELECT ac.*,
    u.full_name     AS owner_full_name,
    u.email         AS owner_email,
    u.profile_photo AS owner_profile_photo
  FROM access_controls ac
  JOIN users u ON u.id = ac.owner_user_id
  WHERE (ac.target_email = LOWER(p_target_email) OR ac.target_user_id = p_target_user_id)
    AND ac.status = 'active'
    AND ac.expiry_date > NOW()
  ORDER BY ac.created_at DESC;
END$$

-- Check if a user has active access to an owner's account
DROP PROCEDURE IF EXISTS CheckAccountAccess$$
CREATE PROCEDURE CheckAccountAccess(
  IN p_owner_user_id  INT UNSIGNED,
  IN p_target_email   VARCHAR(255),
  IN p_target_user_id INT UNSIGNED
)
BEGIN
  SELECT * FROM access_controls
  WHERE owner_user_id = p_owner_user_id
    AND (target_email = LOWER(p_target_email) OR target_user_id = p_target_user_id)
    AND status = 'active'
    AND expiry_date > NOW()
  LIMIT 1;
END$$

-- Check upload/manage access to an owner's account
DROP PROCEDURE IF EXISTS CheckUploadAccess$$
CREATE PROCEDURE CheckUploadAccess(
  IN p_owner_user_id  INT UNSIGNED,
  IN p_target_email   VARCHAR(255),
  IN p_target_user_id INT UNSIGNED
)
BEGIN
  SELECT * FROM access_controls
  WHERE owner_user_id = p_owner_user_id
    AND (target_email = LOWER(p_target_email) OR target_user_id = p_target_user_id)
    AND status = 'active'
    AND expiry_date > NOW()
    AND access_type IN ('upload','manage')
  LIMIT 1;
END$$

-- Count active grants given by a user
DROP PROCEDURE IF EXISTS CountActiveGrants$$
CREATE PROCEDURE CountActiveGrants(IN p_owner_user_id INT UNSIGNED)
BEGIN
  SELECT COUNT(*) AS total FROM access_controls
  WHERE owner_user_id = p_owner_user_id
    AND status = 'active'
    AND expiry_date > NOW();
END$$

-- Expire stale grants (called periodically or on fetch)
DROP PROCEDURE IF EXISTS ExpireStaleGrants$$
CREATE PROCEDURE ExpireStaleGrants()
BEGIN
  UPDATE access_controls
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expiry_date <= NOW();
END$$

-- Get a single access grant by ID
DROP PROCEDURE IF EXISTS GetAccessGrantById$$
CREATE PROCEDURE GetAccessGrantById(IN p_id INT UNSIGNED)
BEGIN
  SELECT ac.*,
    u.full_name AS target_full_name,
    u.email     AS target_email_user,
    u.profile_photo AS target_profile_photo,
    u.role      AS target_role
  FROM access_controls ac
  LEFT JOIN users u ON u.id = ac.target_user_id
  WHERE ac.id = p_id
  LIMIT 1;
END$$

DELIMITER ;