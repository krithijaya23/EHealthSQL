# MongoDB → MySQL Migration Guide
## Health Record Manager — DBMS PBL Project

---

## What Changed

| Layer | Before | After |
|---|---|---|
| Database | MongoDB (NoSQL) | MySQL (Relational) |
| ORM/Driver | Mongoose | mysql2/promise |
| DB Config | `mongoose.connect(MONGO_URI)` | `mysql2.createPool(...)` |
| Queries | Mongoose model methods | `CALL StoredProcedureName(...)` |
| Models | Mongoose schemas (4 files) | MySQL tables (10 tables) |
| Frontend | Unchanged | Unchanged |
| APIs/Routes | Unchanged | Unchanged |

---

## Step 1 — Install MySQL

1. Download and install **MySQL Community Server** from https://dev.mysql.com/downloads/
2. During setup, set a root password — note it down
3. Optionally install **MySQL Workbench** for a GUI

---

## Step 2 — Create the Database and Tables

Open MySQL Workbench or the MySQL command line and run:

```sql
SOURCE /path/to/health-record-manager/database/schema.sql;
```

Or paste the contents of `schema.sql` directly into MySQL Workbench and execute.

This creates:
- `health_record_manager` database
- All 10 tables with primary keys, foreign keys, and indexes

---

## Step 3 — Create Stored Procedures

```sql
SOURCE /path/to/health-record-manager/database/stored_procedures.sql;
```

This creates all stored procedures used by the backend.

---

## Step 4 — Install Backend Dependencies

```bash
cd health-record-manager/backend
npm install
```

This installs `mysql2` (replaces `mongoose`).

---

## Step 5 — Configure Environment Variables

Copy `.env.example` to `.env` and fill in your MySQL credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=health_record_manager
```

Remove or ignore the old `MONGO_URI` variable.

---

## Step 6 — Start the Backend

```bash
npm run dev
```

You should see:
```
✅ MySQL Connected: localhost:3306/health_record_manager
🚀 Server running on port 5000
```

---

## Step 7 — Start the Frontend (unchanged)

```bash
cd health-record-manager/frontend
npm start
```

The frontend is completely unchanged. All API calls work exactly as before.

---

## How the Migration Works — Key Concepts

### Before (MongoDB/Mongoose)
```js
// Find a user
const user = await User.findOne({ email });

// Create a record
const record = await MedicalRecord.create({ ownerUserId, diagnosis, ... });

// Find records with filter
const records = await MedicalRecord.find({ ownerUserId, isDeleted: false })
  .sort({ visitDate: -1 });
```

### After (MySQL Stored Procedures)
```js
// Find a user — CALL GetUserByEmail(email)
const results = await callProcedure('GetUserByEmail', [email]);
const user = results[0]?.[0];

// Create a record — CALL CreateMedicalRecord(...)
const result = await callProcedure('CreateMedicalRecord', [ownerUserId, ...]);
const newId = result[0]?.[0]?.id;

// Find records — CALL GetRecords(ownerUserId, search, ..., limit, offset)
const results = await callProcedure('GetRecords', [ownerUserId, null, null, ...]);
const records = results[0];
const total   = results[1]?.[0]?.total;
```

### The `callProcedure` Helper
```js
// config/db.js
const callProcedure = async (name, params = []) => {
  const placeholders = params.map(() => '?').join(', ');
  const sql = `CALL ${name}(${placeholders})`;
  const [results] = await pool.execute(sql, params);
  return results; // array of result sets
};
```

---

## Relational Schema Diagram

```
users (id PK)
  ├── family_profiles (owner_user_id FK → users.id)
  │     ├── profile_allergies (profile_id FK → family_profiles.id)
  │     └── profile_chronic_conditions (profile_id FK → family_profiles.id)
  ├── medical_records (owner_user_id FK → users.id)
  │     ├── record_medicines (record_id FK → medical_records.id)
  │     ├── record_lab_tests (record_id FK → medical_records.id)
  │     ├── record_bill_items (record_id FK → medical_records.id)
  │     └── record_tags (record_id FK → medical_records.id)
  └── access_controls (owner_user_id FK → users.id,
                        target_user_id FK → users.id,
                        profile_id FK → family_profiles.id)
```

---

## MongoDB → MySQL Field Name Mapping

### users
| MongoDB Field | MySQL Column |
|---|---|
| `_id` | `id` |
| `fullName` | `full_name` |
| `email` | `email` |
| `password` | `password` |
| `role` | `role` |
| `profilePhoto` | `profile_photo` |
| `googleId` | `google_id` |
| `authProvider` | `auth_provider` |
| `isActive` | `is_active` |
| `lastLogin` | `last_login` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

### medical_records
| MongoDB Field | MySQL Column |
|---|---|
| `_id` | `id` |
| `ownerUserId` | `owner_user_id` |
| `uploadedByUserId` | `uploaded_by_user_id` |
| `recordType` | `record_type` |
| `doctorName` | `doctor_name` |
| `hospitalName` | `hospital_name` |
| `visitDate` | `visit_date` |
| `labName` | `lab_name` |
| `patientName` | `patient_name` |
| `scanType` | `scan_type` |
| `bodyPart` | `body_part` |
| `admissionDate` | `admission_date` |
| `dischargeDate` | `discharge_date` |
| `treatmentSummary` | `treatment_summary` |
| `dischargeAdvice` | `discharge_advice` |
| `conditionAtDischarge` | `condition_at_discharge` |
| `billNumber` | `bill_number` |
| `totalAmount` | `total_amount` |
| `extractedText` | `extracted_text` |
| `ocrProcessed` | `ocr_processed` |
| `ocrConfidence` | `ocr_confidence` |
| `isDeleted` | `is_deleted` |
| `medicines[]` | `record_medicines` table |
| `labTests[]` | `record_lab_tests` table |
| `lineItems[]` | `record_bill_items` table |
| `tags[]` | `record_tags` table |

---

## Stored Procedures Reference

### User Procedures
| Procedure | Purpose |
|---|---|
| `CreateUser(fullName, email, password, role, authProvider)` | Register new local user |
| `GetUserByEmail(email)` | Login / lookup |
| `GetUserById(id)` | Auth middleware, getMe |
| `GetUserByGoogleIdOrEmail(googleId, email)` | Google OAuth |
| `CreateGoogleUser(...)` | Google OAuth new user |
| `UpdateGoogleUserOnLogin(id, googleId, photo)` | Google OAuth existing user |
| `UpdateLastLogin(id)` | After login |
| `UpdateUserProfile(id, fullName, role)` | Profile update |
| `UpdateUserPassword(id, hashedPassword)` | Change/reset password |
| `GetUserPasswordHash(id)` | Change password verification |
| `CheckEmailExists(email)` | Signup duplicate check |

### Medical Record Procedures
| Procedure | Purpose |
|---|---|
| `CreateMedicalRecord(...)` | Upload new record |
| `GetRecords(ownerUserId, search, ..., limit, offset)` | List with filters + pagination |
| `GetRecordById(id)` | Single record with child rows as JSON |
| `UpdateMedicalRecord(id, ...)` | Edit record |
| `DeleteMedicalRecord(id)` | Soft delete |
| `AddRecordMedicine(recordId, ...)` | Insert medicine row |
| `AddRecordLabTest(recordId, ...)` | Insert lab test row |
| `AddRecordBillItem(recordId, ...)` | Insert bill item row |
| `DeleteRecordMedicines(recordId)` | Clear medicines before update |
| `DeleteRecordLabTests(recordId)` | Clear lab tests before update |
| `DeleteRecordBillItems(recordId)` | Clear bill items before update |
| `CountRecords(ownerUserId)` | Dashboard total count |
| `CountRecordsThisMonth(ownerUserId)` | Dashboard monthly count |
| `GetRecentRecords(ownerUserId, limit)` | Dashboard recent activity |
| `GetAllRecordsForAnalytics(ownerUserId)` | Analytics + AI summary |

### Access Control Procedures
| Procedure | Purpose |
|---|---|
| `CreateAccessGrant(...)` | Share access |
| `UpdateAccessGrant(id, ...)` | Update existing grant |
| `FindActiveAccountGrant(ownerUserId, targetUserId)` | Upsert check |
| `RevokeAccessGrant(id, ownerUserId)` | Revoke access |
| `GetGrantedAccess(ownerUserId)` | List grants given |
| `GetSharedWithMe(email, userId)` | List grants received |
| `CheckAccountAccess(ownerUserId, email, userId)` | Verify read access |
| `CheckUploadAccess(ownerUserId, email, userId)` | Verify write access |
| `CountActiveGrants(ownerUserId)` | Dashboard shared count |
| `ExpireStaleGrants()` | Auto-expire old grants |
| `GetAccessGrantById(id)` | Fetch single grant |

### Family Profile Procedures
| Procedure | Purpose |
|---|---|
| `GetProfiles(ownerUserId)` | List all profiles |
| `GetProfileById(id, ownerUserId)` | Single profile |
| `CountActiveProfiles(ownerUserId)` | Enforce 10-profile limit |
| `CreateProfile(...)` | New profile |
| `UpdateProfile(id, ownerUserId, ...)` | Edit profile |
| `DeleteProfile(id, ownerUserId)` | Soft delete |
| `AddProfileAllergy(profileId, allergy)` | Add allergy |
| `AddProfileChronicCondition(profileId, condition)` | Add condition |
| `DeleteProfileAllergies(profileId)` | Clear before update |
| `DeleteProfileChronicConditions(profileId)` | Clear before update |

---

## What Was NOT Changed

- All React frontend pages, components, and context files
- All API routes and HTTP methods
- All middleware (auth, upload, error handler logic)
- All services (OCR, AI summary, email)
- JWT authentication flow
- Google OAuth flow
- OTP-based password reset (still in-memory Map)
- Response format (`{ success, message, data }`)
- File upload handling (multer memory storage)
