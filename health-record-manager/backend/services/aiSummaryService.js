/**
 * AI Summary Service
 * Uses Google Gemini to generate rich health summaries.
 * Falls back to rule-based summaries if Gemini is unavailable.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Initialise Gemini ────────────────────────────────────────────────────────
let gemini = null;
try {
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('✅ Gemini AI ready');
  } else {
    console.warn('⚠️  GEMINI_API_KEY not set — using rule-based summaries');
  }
} catch (e) {
  console.warn('⚠️  Gemini init failed:', e.message);
}

// ─── Monthly visit counts for charts ─────────────────────────────────────────
const getMonthlyVisits = (records) => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const count = records.filter((r) => {
      const d = new Date(r.visitDate);
      return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    }).length;
    months.push({ month: `${monthName} ${year}`, count });
  }
  return months;
};

// ─── Core analytics ───────────────────────────────────────────────────────────
const analyzeRecords = (records) => {
  const diagnosisCount  = {};
  const medicineCount   = {};
  const hospitalCount   = {};
  const doctorCount     = {};
  const labTestMap      = {};
  const recordTypeCount = {};

  records.forEach((r) => {
    if (r.diagnosis) {
      const k = r.diagnosis.toLowerCase().trim();
      diagnosisCount[k] = (diagnosisCount[k] || 0) + 1;
    }
    (r.medicines || []).forEach((m) => {
      if (m.name) {
        const k = m.name.toLowerCase().trim();
        medicineCount[k] = (medicineCount[k] || 0) + 1;
      }
    });
    if (r.hospitalName) {
      const k = r.hospitalName.trim();
      hospitalCount[k] = (hospitalCount[k] || 0) + 1;
    }
    if (r.doctorName) {
      const k = r.doctorName.trim();
      doctorCount[k] = (doctorCount[k] || 0) + 1;
    }
    (r.labTests || []).forEach((t) => {
      if (!t.testName) return;
      const k = t.testName.toLowerCase().trim();
      if (!labTestMap[k]) labTestMap[k] = { high: 0, low: 0, normal: 0, total: 0 };
      labTestMap[k].total += 1;
      if (t.status === 'high' || t.status === 'positive') labTestMap[k].high += 1;
      else if (t.status === 'low') labTestMap[k].low += 1;
      else labTestMap[k].normal += 1;
    });
    if (r.recordType) {
      recordTypeCount[r.recordType] = (recordTypeCount[r.recordType] || 0) + 1;
    }
  });

  const sort = (obj) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  const abnormalTests = Object.entries(labTestMap)
    .filter(([, v]) => v.high > 0 || v.low > 0)
    .sort((a, b) => (b[1].high + b[1].low) - (a[1].high + a[1].low))
    .slice(0, 5)
    .map(([name, v]) => ({
      name,
      abnormalCount: v.high + v.low,
      total: v.total,
      direction: v.high >= v.low ? 'elevated' : 'low',
    }));

  return {
    frequentDiagnoses:  sort(diagnosisCount).slice(0, 6),
    currentMedications: sort(medicineCount).slice(0, 10),
    frequentHospitals:  sort(hospitalCount).slice(0, 4),
    frequentDoctors:    sort(doctorCount).slice(0, 4),
    abnormalTests,
    recordTypeCount,
  };
};

const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// ─── Build structured context for Gemini ─────────────────────────────────────
const buildContext = (records) => {
  const {
    frequentDiagnoses, currentMedications, frequentHospitals,
    frequentDoctors, abnormalTests, recordTypeCount,
  } = analyzeRecords(records);

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const recentRecords  = records.filter((r) => new Date(r.visitDate) >= threeMonthsAgo);

  const recentEncounters = records.slice(0, 8).map((r) => ({
    date:      r.visitDate ? new Date(r.visitDate).toLocaleDateString('en-GB') : 'N/A',
    type:      r.recordType || 'Other',
    diagnosis: r.diagnosis || '',
    doctor:    r.doctorName || '',
    hospital:  r.hospitalName || '',
    medicines: (r.medicines || []).slice(0, 4).map((m) => m.name).filter(Boolean),
    labTests:  (r.labTests  || []).slice(0, 4).map((t) => `${t.testName}: ${t.value}${t.unit ? ' ' + t.unit : ''} (${t.status})`).filter(Boolean),
    notes:     r.notes ? r.notes.substring(0, 200) : '',
    impression: r.impression ? r.impression.substring(0, 200) : '',
  }));

  return {
    totalRecords:      records.length,
    recentCount:       recentRecords.length,
    firstVisit:        records[records.length - 1]?.visitDate,
    lastVisit:         records[0]?.visitDate,
    frequentDiagnoses,
    currentMedications,
    frequentHospitals,
    frequentDoctors,
    abnormalTests,
    recordTypeCount,
    recentEncounters,
  };
};

// ─── Gemini: Patient-friendly summary ────────────────────────────────────────
const geminiPatientSummary = async (ctx) => {
  const prompt = `You are a healthcare assistant generating a patient-friendly health summary.

Based on the following medical history data, write a clear, warm, and easy-to-understand health summary for the patient. 
Use simple language. No medical jargon. Write in paragraph format (4-6 paragraphs). Be specific and informative.
Do NOT use bullet points. Do NOT use headers. Do NOT use markdown formatting.

Medical History Data:
- Total records: ${ctx.totalRecords}
- Records in last 3 months: ${ctx.recentCount}
- First visit: ${ctx.firstVisit ? new Date(ctx.firstVisit).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A'}
- Most recent visit: ${ctx.lastVisit ? new Date(ctx.lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
- Frequent diagnoses: ${ctx.frequentDiagnoses.map((d) => `${d.name} (${d.count} times)`).join(', ') || 'None recorded'}
- Medications on record: ${ctx.currentMedications.slice(0, 6).map((m) => m.name).join(', ') || 'None recorded'}
- Abnormal lab results: ${ctx.abnormalTests.map((t) => `${t.name} (${t.direction})`).join(', ') || 'None'}
- Most visited hospital: ${ctx.frequentHospitals[0]?.name || 'N/A'}
- Primary doctor: ${ctx.frequentDoctors[0] ? `Dr. ${ctx.frequentDoctors[0].name}` : 'N/A'}
- Recent encounters: ${ctx.recentEncounters.slice(0, 4).map((e) => `${e.date}: ${e.diagnosis || e.type}${e.doctor ? ' with Dr. ' + e.doctor : ''}`).join('; ')}

Write the summary now:`;

  const result = await gemini.generateContent(prompt);
  return result.response.text().trim();
};

// ─── Gemini: Clinical/Doctor summary ─────────────────────────────────────────
const geminiDoctorSummary = async (ctx) => {
  const prompt = `You are a clinical documentation assistant generating a professional medical summary for a healthcare provider.

Based on the following patient data, write a detailed clinical summary using proper medical terminology.
Write in paragraph format with clear sections. Use clinical language appropriate for a doctor.
Include: patient overview, primary diagnoses, pharmacotherapy, lab findings, healthcare utilisation, recent encounters, and clinical impressions.
Do NOT use markdown headers (##). Use plain text section labels followed by a colon if needed.
Write 5-7 substantial paragraphs.

Patient Medical Data:
- Total documented encounters: ${ctx.totalRecords}
- Encounters in last 3 months: ${ctx.recentCount}
- History from: ${ctx.firstVisit ? new Date(ctx.firstVisit).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'N/A'} to ${ctx.lastVisit ? new Date(ctx.lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
- Primary diagnoses: ${ctx.frequentDiagnoses.map((d) => `${d.name} (n=${d.count})`).join('; ') || 'None documented'}
- Pharmacotherapy: ${ctx.currentMedications.slice(0, 8).map((m) => m.name).join(', ') || 'None documented'}
- Abnormal investigations: ${ctx.abnormalTests.map((t) => `${t.name}: ${t.abnormalCount}/${t.total} results ${t.direction}`).join('; ') || 'None noted'}
- Record types: ${Object.entries(ctx.recordTypeCount).map(([t, c]) => `${t} (${c})`).join(', ')}
- Healthcare facilities: ${ctx.frequentHospitals.map((h) => `${h.name} (${h.count} visits)`).join(', ') || 'N/A'}
- Treating physicians: ${ctx.frequentDoctors.map((d) => `Dr. ${d.name} (${d.count})`).join(', ') || 'N/A'}
- Recent clinical encounters:
${ctx.recentEncounters.slice(0, 6).map((e) => `  ${e.date} | ${e.type} | ${e.diagnosis || 'N/A'} | Dr. ${e.doctor || 'N/A'} | ${e.hospital || 'N/A'}${e.labTests.length ? ' | Labs: ' + e.labTests.join(', ') : ''}${e.medicines.length ? ' | Rx: ' + e.medicines.join(', ') : ''}`).join('\n')}

Write the clinical summary now:`;

  const result = await gemini.generateContent(prompt);
  return result.response.text().trim();
};

// ─── Rule-based fallbacks ─────────────────────────────────────────────────────
const fallbackPatientSummary = (records) => {
  if (!records || records.length === 0) {
    return 'No medical records have been uploaded yet. Start by adding your first prescription, lab report, or medical document to get a personalised health summary.';
  }
  const { frequentDiagnoses, currentMedications, frequentHospitals, abnormalTests } = analyzeRecords(records);
  const paragraphs = [];
  const lastVisit = records[0]?.visitDate ? new Date(records[0].visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  paragraphs.push(`Your health record contains ${records.length} medical document${records.length > 1 ? 's' : ''}${lastVisit ? `, with the most recent entry on ${lastVisit}` : ''}.`);
  if (frequentDiagnoses.length > 0) {
    paragraphs.push(`The most frequently recorded health concern is "${cap(frequentDiagnoses[0].name)}"${frequentDiagnoses[0].count > 1 ? `, appearing ${frequentDiagnoses[0].count} times` : ''}. ${frequentDiagnoses[0].count >= 3 ? 'Since this condition recurs frequently, it may be worth discussing a long-term management plan with your doctor.' : ''}`);
  }
  if (currentMedications.length > 0) {
    paragraphs.push(`Medicines that appear in your records include: ${currentMedications.slice(0, 5).map((m) => cap(m.name)).join(', ')}.`);
  }
  if (abnormalTests.length > 0) {
    paragraphs.push(`Some lab results have shown values outside the normal range, including ${abnormalTests.slice(0, 3).map((t) => `${cap(t.name)} (${t.direction})`).join(', ')}. Follow up with your doctor regarding these findings.`);
  }
  if (frequentHospitals.length > 0) {
    paragraphs.push(`Your primary healthcare facility is ${frequentHospitals[0].name}.`);
  }
  return paragraphs.join('\n\n');
};

const fallbackDoctorSummary = (records) => {
  if (!records || records.length === 0) return 'No medical history available for this patient.';
  const { frequentDiagnoses, currentMedications, frequentHospitals, frequentDoctors, abnormalTests } = analyzeRecords(records);
  const paragraphs = [];
  paragraphs.push(`Patient presents with ${records.length} documented medical encounter${records.length > 1 ? 's' : ''}.`);
  if (frequentDiagnoses.length > 0) {
    paragraphs.push(`Primary diagnoses: ${frequentDiagnoses.map((d) => `${cap(d.name)} (n=${d.count})`).join('; ')}.`);
  }
  if (currentMedications.length > 0) {
    paragraphs.push(`Documented pharmacotherapy: ${currentMedications.slice(0, 8).map((m) => cap(m.name)).join(', ')}.${currentMedications.length >= 5 ? ' Polypharmacy noted — medication reconciliation recommended.' : ''}`);
  }
  if (abnormalTests.length > 0) {
    paragraphs.push(`Abnormal investigations: ${abnormalTests.map((t) => `${cap(t.name)}: ${t.abnormalCount}/${t.total} results ${t.direction}`).join('; ')}.`);
  }
  if (frequentHospitals.length > 0 || frequentDoctors.length > 0) {
    paragraphs.push(`Healthcare utilisation — Facilities: ${frequentHospitals.map((h) => `${h.name} (${h.count})`).join(', ') || 'N/A'}. Physicians: ${frequentDoctors.map((d) => `Dr. ${d.name}`).join(', ') || 'N/A'}.`);
  }
  return paragraphs.join('\n\n');
};

// ─── Public: generate both summaries ─────────────────────────────────────────
const generatePatientSummary = async (records) => {
  if (!records || records.length === 0) return fallbackPatientSummary([]);
  if (!gemini) return fallbackPatientSummary(records);
  try {
    const ctx = buildContext(records);
    return await geminiPatientSummary(ctx);
  } catch (err) {
    console.error('Gemini patient summary failed:', err.message);
    return fallbackPatientSummary(records);
  }
};

const generateDoctorSummary = async (records) => {
  if (!records || records.length === 0) return fallbackDoctorSummary([]);
  if (!gemini) return fallbackDoctorSummary(records);
  try {
    const ctx = buildContext(records);
    return await geminiDoctorSummary(ctx);
  } catch (err) {
    console.error('Gemini doctor summary failed:', err.message);
    return fallbackDoctorSummary(records);
  }
};

// ─── Full health summary object ───────────────────────────────────────────────
const generateHealthSummary = async (records) => {
  if (!records || records.length === 0) {
    return {
      totalVisits: 0,
      frequentDiagnoses: [],
      currentMedications: [],
      recentTrends: [],
      lastVisit: null,
      insights: ['No medical records found. Start by uploading your first record.'],
      patientSummary: await generatePatientSummary([]),
      doctorSummary:  await generateDoctorSummary([]),
    };
  }

  const {
    frequentDiagnoses, currentMedications, frequentHospitals,
    frequentDoctors, abnormalTests,
  } = analyzeRecords(records);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const recentRecords = records.filter((r) => new Date(r.visitDate) >= threeMonthsAgo);

  const recentTrends = [];
  if (recentRecords.length > records.length * 0.5 && records.length >= 4) recentTrends.push('Increased medical visits in the last 3 months');
  if (frequentDiagnoses.length > 0 && frequentDiagnoses[0].count >= 3) recentTrends.push(`Recurring condition: ${cap(frequentDiagnoses[0].name)}`);
  if (currentMedications.length >= 5) recentTrends.push('Multiple ongoing medications detected');
  if (abnormalTests.length > 0) recentTrends.push(`Abnormal lab values: ${cap(abnormalTests[0].name)}`);

  const insights = [];
  if (records.length >= 1) insights.push(`${records.length} medical record${records.length > 1 ? 's' : ''} stored securely`);
  if (frequentDiagnoses.length > 0) insights.push(`Most frequent diagnosis: "${cap(frequentDiagnoses[0].name)}" (${frequentDiagnoses[0].count}×)`);
  if (currentMedications.length > 0) insights.push(`Commonly prescribed: ${currentMedications.slice(0, 3).map((m) => cap(m.name)).join(', ')}`);
  if (frequentHospitals.length > 0) insights.push(`Most visited: ${frequentHospitals[0].name}`);
  if (abnormalTests.length > 0) insights.push(`Abnormal lab result: ${cap(abnormalTests[0].name)} (${abnormalTests[0].direction})`);

  // Generate both summaries in parallel
  const [patientSummary, doctorSummary] = await Promise.all([
    generatePatientSummary(records),
    generateDoctorSummary(records),
  ]);

  return {
    totalVisits: records.length,
    frequentDiagnoses,
    currentMedications,
    frequentHospitals,
    frequentDoctors,
    abnormalTests,
    recentTrends,
    lastVisit: records[0]?.visitDate || null,
    insights,
    monthlyVisits: getMonthlyVisits(records),
    recentRecordsCount: recentRecords.length,
    patientSummary,
    doctorSummary,
  };
};

module.exports = {
  generateHealthSummary,
  generatePatientSummary,
  generateDoctorSummary,
  getMonthlyVisits,
};
