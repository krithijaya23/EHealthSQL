const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  dosage: { type: String, trim: true },
  frequency: { type: String, trim: true },
  duration: { type: String, trim: true },
});

const labTestSchema = new mongoose.Schema({
  testName: { type: String, trim: true },
  value: { type: String, trim: true },
  unit: { type: String, trim: true },
  normalRange: { type: String, trim: true },
  status: {
    type: String,
    enum: ['normal', 'high', 'low', 'positive', 'negative', 'borderline', 'unknown'],
    default: 'normal',
  },
});

const billItemSchema = new mongoose.Schema({
  description: { type: String, trim: true },
  amount: { type: String, trim: true },
});

const medicalRecordSchema = new mongoose.Schema(
  {
    // Records belong directly to a user — no family profile indirection
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    recordType: {
      type: String,
      enum: ['Prescription', 'Lab Report', 'Scan', 'Discharge Summary', 'Medical Bill', 'Vaccination', 'Other'],
      default: 'Other',
    },

    // Common fields
    doctorName:   { type: String, trim: true, default: '' },
    hospitalName: { type: String, trim: true, default: '' },
    diagnosis:    { type: String, trim: true, default: '' },
    notes:        { type: String, trim: true, default: '' },
    visitDate:    { type: Date, default: Date.now },

    // Prescription
    medicines: [medicineSchema],

    // Lab Report
    labName:     { type: String, trim: true, default: '' },
    patientName: { type: String, trim: true, default: '' },
    labTests:    [labTestSchema],
    impression:  { type: String, trim: true, default: '' },

    // Scan
    scanType: { type: String, trim: true, default: '' },
    bodyPart: { type: String, trim: true, default: '' },
    findings: { type: String, trim: true, default: '' },

    // Discharge Summary
    admissionDate:        { type: String, default: '' },
    dischargeDate:        { type: String, default: '' },
    treatmentSummary:     { type: String, trim: true, default: '' },
    dischargeAdvice:      { type: String, trim: true, default: '' },
    conditionAtDischarge: { type: String, trim: true, default: '' },

    // Medical Bill
    billNumber:  { type: String, trim: true, default: '' },
    totalAmount: { type: String, trim: true, default: '' },
    lineItems:   [billItemSchema],

    // OCR metadata
    extractedText: { type: String, default: '' },
    ocrProcessed:  { type: Boolean, default: false },
    ocrConfidence: { type: String, enum: ['high', 'low', 'none', ''], default: '' },

    // AI summaries
    aiPatientSummary: { type: String, default: '' },
    aiDoctorSummary:  { type: String, default: '' },

    tags:      [{ type: String }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ ownerUserId: 1, visitDate: -1 });
medicalRecordSchema.index({ doctorName: 'text', hospitalName: 'text', diagnosis: 'text', 'labTests.testName': 'text' });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
