# Models — Migrated to MySQL

The Mongoose model files in this folder have been replaced by MySQL tables and stored procedures.

| Old Mongoose Model     | New MySQL Table(s)                                                                 |
|------------------------|------------------------------------------------------------------------------------|
| `User.js`              | `users`                                                                            |
| `FamilyProfile.js`     | `family_profiles`, `profile_allergies`, `profile_chronic_conditions`               |
| `MedicalRecord.js`     | `medical_records`, `record_medicines`, `record_lab_tests`, `record_bill_items`, `record_tags` |
| `AccessControl.js`     | `access_controls`                                                                  |

See `database/schema.sql` for table definitions and `database/stored_procedures.sql` for all stored procedures.
All database operations in controllers now use `CALL ProcedureName(...)` via `config/db.js → callProcedure()`.
