-- ============================================================
-- Health Record Manager — MySQL Schema
-- Run this file first to create all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS health_record_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE health_record_manager;

-- ─────────────────────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NULL,          -- NULL for Google-only accounts
  role          ENUM('patient','doctor')     NOT NULL DEFAULT 'patient',
  profile_photo VARCHAR(500)  NULL,
  google_id     VARCHAR(255)  NULL UNIQUE,
  auth_provider ENUM('local','google')       NOT NULL DEFAULT 'local',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  last_login    DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_email       (email),
  INDEX idx_users_google_id   (google_id),
  INDEX idx_users_role        (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: family_profiles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_profiles (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id       INT UNSIGNED NOT NULL,
  profile_name        VARCHAR(100) NOT NULL,
  actual_name         VARCHAR(100) NULL DEFAULT '',
  age                 TINYINT UNSIGNED NOT NULL,
  gender              ENUM('Male','Female','Other') NOT NULL,
  blood_group         ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown') NOT NULL DEFAULT 'Unknown',
  relationship        ENUM('Self','Mom','Dad','Spouse','Son','Daughter','Sibling','Other') NOT NULL,
  date_of_birth       DATE NULL,
  profile_photo       VARCHAR(500) NULL,
  is_default_profile  TINYINT(1) NOT NULL DEFAULT 0,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_fp_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_fp_owner (owner_user_id),
  INDEX idx_fp_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: profile_allergies  (replaces embedded array)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_allergies (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT UNSIGNED NOT NULL,
  allergy     VARCHAR(200) NOT NULL,

  CONSTRAINT fk_pa_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE,
  INDEX idx_pa_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: profile_chronic_conditions  (replaces embedded array)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_chronic_conditions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT UNSIGNED NOT NULL,
  condition_name VARCHAR(200) NOT NULL,

  CONSTRAINT fk_pcc_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE,
  INDEX idx_pcc_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: medical_records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_records (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id         INT UNSIGNED NOT NULL,
  uploaded_by_user_id   INT UNSIGNED NULL,

  record_type           ENUM('Prescription','Lab Report','Scan','Discharge Summary','Medical Bill','Vaccination','Other') NOT NULL DEFAULT 'Other',

  -- Common fields
  doctor_name           VARCHAR(150) NOT NULL DEFAULT '',
  hospital_name         VARCHAR(200) NOT NULL DEFAULT '',
  diagnosis             TEXT         NOT NULL DEFAULT '',
  notes                 TEXT         NOT NULL DEFAULT '',
  visit_date            DATE         NOT NULL,

  -- Lab Report
  lab_name              VARCHAR(200) NOT NULL DEFAULT '',
  patient_name          VARCHAR(150) NOT NULL DEFAULT '',
  impression            TEXT         NOT NULL DEFAULT '',

  -- Scan
  scan_type             VARCHAR(100) NOT NULL DEFAULT '',
  body_part             VARCHAR(100) NOT NULL DEFAULT '',
  findings              TEXT         NOT NULL DEFAULT '',

  -- Discharge Summary
  admission_date        VARCHAR(50)  NOT NULL DEFAULT '',
  discharge_date        VARCHAR(50)  NOT NULL DEFAULT '',
  treatment_summary     TEXT         NOT NULL DEFAULT '',
  discharge_advice      TEXT         NOT NULL DEFAULT '',
  condition_at_discharge VARCHAR(200) NOT NULL DEFAULT '',

  -- Medical Bill
  bill_number           VARCHAR(100) NOT NULL DEFAULT '',
  total_amount          VARCHAR(50)  NOT NULL DEFAULT '',

  -- OCR metadata
  extracted_text        LONGTEXT     NOT NULL DEFAULT '',
  ocr_processed         TINYINT(1)   NOT NULL DEFAULT 0,
  ocr_confidence        ENUM('high','low','none','') NOT NULL DEFAULT '',

  -- AI summaries
  ai_patient_summary    LONGTEXT     NOT NULL DEFAULT '',
  ai_doctor_summary     LONGTEXT     NOT NULL DEFAULT '',

  is_deleted            TINYINT(1)   NOT NULL DEFAULT 0,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_mr_owner    FOREIGN KEY (owner_user_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_mr_owner_date   (owner_user_id, visit_date DESC),
  INDEX idx_mr_deleted      (is_deleted),
  INDEX idx_mr_record_type  (record_type),
  FULLTEXT INDEX ft_mr_search (doctor_name, hospital_name, diagnosis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: record_medicines  (replaces medicines[] sub-schema)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_medicines (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  record_id   INT UNSIGNED NOT NULL,
  name        VARCHAR(200) NOT NULL DEFAULT '',
  dosage      VARCHAR(100) NOT NULL DEFAULT '',
  frequency   VARCHAR(100) NOT NULL DEFAULT '',
  duration    VARCHAR(100) NOT NULL DEFAULT '',

  CONSTRAINT fk_rm_record FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
  INDEX idx_rm_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: record_lab_tests  (replaces labTests[] sub-schema)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_lab_tests (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  record_id    INT UNSIGNED NOT NULL,
  test_name    VARCHAR(200) NOT NULL DEFAULT '',
  value        VARCHAR(100) NOT NULL DEFAULT '',
  unit         VARCHAR(50)  NOT NULL DEFAULT '',
  normal_range VARCHAR(100) NOT NULL DEFAULT '',
  status       ENUM('normal','high','low','positive','negative','borderline','unknown') NOT NULL DEFAULT 'normal',

  CONSTRAINT fk_rlt_record FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
  INDEX idx_rlt_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: record_bill_items  (replaces lineItems[] sub-schema)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_bill_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  record_id   INT UNSIGNED NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  amount      VARCHAR(50)  NOT NULL DEFAULT '',

  CONSTRAINT fk_rbi_record FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
  INDEX idx_rbi_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: record_tags  (replaces tags[] array)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_tags (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  record_id INT UNSIGNED NOT NULL,
  tag       VARCHAR(100) NOT NULL,

  CONSTRAINT fk_rt_record FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
  INDEX idx_rt_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────
-- TABLE: access_controls
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_controls (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id   INT UNSIGNED NOT NULL,
  target_email    VARCHAR(255) NOT NULL,
  target_user_id  INT UNSIGNED NULL,
  profile_id      INT UNSIGNED NULL,   -- NULL = account-level access
  access_type     ENUM('view','upload','manage') NOT NULL DEFAULT 'view',
  expiry_date     DATETIME NOT NULL,
  status          ENUM('active','expired','revoked') NOT NULL DEFAULT 'active',
  shared_by       VARCHAR(100) NOT NULL DEFAULT '',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_ac_owner   FOREIGN KEY (owner_user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ac_target  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ac_profile FOREIGN KEY (profile_id)     REFERENCES family_profiles(id) ON DELETE SET NULL,

  INDEX idx_ac_owner        (owner_user_id),
  INDEX idx_ac_target_email (target_email),
  INDEX idx_ac_target_user  (target_user_id),
  INDEX idx_ac_status       (status),
  INDEX idx_ac_expiry       (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
