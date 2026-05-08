const vision = require('@google-cloud/vision');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Initialize Google Vision ─────────────────────────────────────────────────
let visionClient = null;
try {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fs2 = require('fs');
  if (credPath && fs2.existsSync(credPath) && fs2.statSync(credPath).size > 10) {
    visionClient = new vision.ImageAnnotatorClient();
    console.log('✅ Google Vision OCR ready');
  } else {
    console.warn('⚠️  Google credentials missing or empty — using Tesseract fallback');
  }
} catch (e) {
  console.warn('⚠️  Google Vision unavailable, falling back to Tesseract:', e.message);
}

// ─── Write buffer to a temp file, run fn(tempPath), then clean up ─────────────
const withTempFile = async (buffer, ext, fn) => {
  const tmpPath = path.join(os.tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    return await fn(tmpPath);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
};

// ─── Raw text extraction ──────────────────────────────────────────────────────
const extractTextFromImageBuffer = async (buffer) => {
  // Try Google Vision first (accepts buffer directly)
  if (visionClient) {
    try {
      const [result] = await visionClient.textDetection({ image: { content: buffer } });
      const text = result.fullTextAnnotation?.text || '';
      if (text.trim().length > 0) {
        console.log('✅ Google Vision extracted', text.length, 'chars');
        return text;
      }
      console.warn('⚠️  Google Vision returned empty text, trying Tesseract');
    } catch (err) {
      console.warn('⚠️  Google Vision failed:', err.message, '— falling back to Tesseract');
    }
  }

  // Tesseract needs a file path — write to temp
  return withTempFile(buffer, '.jpg', async (tmpPath) => {
    try {
      console.log('🔄 Running Tesseract OCR on temp file');
      const result = await Tesseract.recognize(tmpPath, 'eng', {
        logger: (m) => { if (m.status === 'recognizing text') process.stdout.write(`\r🔄 Tesseract: ${Math.round(m.progress * 100)}%`); },
      });
      console.log('\n✅ Tesseract extracted', result.data.text.length, 'chars');
      return result.data.text;
    } catch (err) {
      console.error('❌ Tesseract failed:', err.message);
      return '';
    }
  });
};

const extractTextFromPDFBuffer = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    console.log('✅ PDF text extracted');
    return data.text;
  } catch (err) {
    console.error('❌ PDF extraction failed:', err.message);
    return '';
  }
};

// ─── STEP 1: Document type detection ─────────────────────────────────────────
/**
 * Classify the document type from OCR text using keyword scoring.
 * Returns one of: 'Prescription' | 'Lab Report' | 'Scan' | 'Discharge Summary' | 'Medical Bill' | 'Vaccination' | 'Other'
 */
const detectDocumentType = (text) => {
  if (!text?.trim()) return 'Other';
  const t = text.toLowerCase();

  const scores = {
    'Prescription': 0,
    'Lab Report': 0,
    'Scan': 0,
    'Discharge Summary': 0,
    'Medical Bill': 0,
    'Vaccination': 0,
  };

  // ── Prescription signals ──────────────────────────────────────────────────
  const rxSignals = [
    /\brx\b/, /\bprescription\b/, /\btablet\b/, /\bcapsule\b/, /\bsyrup\b/,
    /\bmg\b/, /\bml\b/, /\bdosage\b/, /\btwice\s+daily\b/, /\bonce\s+daily\b/,
    /\bafter\s+food\b/, /\bbefore\s+food\b/, /\brefill\b/, /\bdispense\b/,
    /\bsig\b/, /\bdisp\b/, /\bqty\b/, /\bq\.?d\b/, /\bb\.?i\.?d\b/, /\bt\.?i\.?d\b/,
  ];
  rxSignals.forEach((p) => { if (p.test(t)) scores['Prescription'] += 2; });
  if (/dr\.?\s+[a-z]/.test(t) && /mg|tablet|capsule/i.test(t)) scores['Prescription'] += 3;

  // ── Lab Report signals ────────────────────────────────────────────────────
  const labSignals = [
    /\blab\s+report\b/, /\blaboratory\b/, /\btest\s+result\b/, /\bblood\s+test\b/,
    /\bhaemoglobin\b/, /\bhemoglobin\b/, /\bwbc\b/, /\brbc\b/, /\bplatelet\b/,
    /\bglucose\b/, /\bcholesterol\b/, /\bcreatinine\b/, /\burea\b/, /\bbilirubin\b/,
    /\bnormal\s+range\b/, /\breference\s+range\b/, /\bh\/l\b/, /\bhigh\b.*\blow\b/,
    /\bpositive\b|\bnegative\b/, /\bspecimen\b/, /\bsample\b/, /\bserum\b/,
    /\bpathology\b/, /\bdiagnostic\b/, /\banalysis\b/, /\bculture\b/,
    /\burinalysis\b/, /\bcbc\b/, /\blft\b/, /\bkft\b/, /\blipid\s+profile\b/,
  ];
  labSignals.forEach((p) => { if (p.test(t)) scores['Lab Report'] += 2; });
  if (/normal\s+range|reference\s+range/i.test(t)) scores['Lab Report'] += 4;

  // ── Scan / Radiology signals ──────────────────────────────────────────────
  const scanSignals = [
    /\bx[\-\s]?ray\b/, /\bultrasound\b/, /\bsonography\b/, /\bct\s+scan\b/,
    /\bmri\b/, /\becg\b/, /\bechocardiogram\b/, /\bradiology\b/, /\bimaging\b/,
    /\bimpression\b/, /\bfindings\b/, /\bscan\b/, /\bview\b.*\bshows\b/,
    /\bno\s+abnormality\b/, /\bnormal\s+study\b/, /\bconclusion\b/,
  ];
  scanSignals.forEach((p) => { if (p.test(t)) scores['Scan'] += 2; });
  if (/impression\s*:/i.test(t) && /radiology|imaging|scan|x.ray|mri|ct/i.test(t)) scores['Scan'] += 4;

  // ── Discharge Summary signals ─────────────────────────────────────────────
  const dischargeSignals = [
    /\bdischarge\s+summary\b/, /\bdischarge\s+date\b/, /\badmission\s+date\b/,
    /\bdate\s+of\s+admission\b/, /\bdate\s+of\s+discharge\b/, /\bhospital\s+stay\b/,
    /\binpatient\b/, /\bward\b/, /\bbed\s+no\b/, /\bip\s+no\b/,
    /\btreatment\s+given\b/, /\bprocedure\s+performed\b/, /\boperation\b/,
    /\bsurgery\b/, /\bcondition\s+at\s+discharge\b/, /\badvice\s+on\s+discharge\b/,
  ];
  dischargeSignals.forEach((p) => { if (p.test(t)) scores['Discharge Summary'] += 2; });
  if (/admission.*discharge|discharge.*admission/i.test(t)) scores['Discharge Summary'] += 5;

  // ── Medical Bill signals ──────────────────────────────────────────────────
  const billSignals = [
    /\binvoice\b/, /\bbill\b/, /\breceipt\b/, /\bamount\b/, /\btotal\b/,
    /\bpayment\b/, /\bcharge\b/, /\bfee\b/, /\brs\.?\s*\d/, /\binr\s*\d/,
    /\$\s*\d/, /\btax\b/, /\bgst\b/, /\bdiscount\b/,
  ];
  billSignals.forEach((p) => { if (p.test(t)) scores['Medical Bill'] += 2; });

  // ── Vaccination signals ───────────────────────────────────────────────────
  const vaccSignals = [
    /\bvaccin/i, /\bimmunization\b/, /\bvaccination\s+card\b/, /\bdose\b/,
    /\bbooster\b/, /\bmmr\b/, /\bopv\b/, /\bdpt\b/, /\bhepatitis\b/,
    /\bpolio\b/, /\btetanus\b/, /\bcovid\b/, /\bcoronavirus\b/,
  ];
  vaccSignals.forEach((p) => { if (p.test(t)) scores['Vaccination'] += 2; });

  // Pick highest score
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  console.log('📋 Document type scores:', scores, '→ detected:', best[0]);
  return best[1] > 0 ? best[0] : 'Other';
};

// ─── STEP 2: Type-specific parsers ───────────────────────────────────────────

// ── Common fields (used by all types) ────────────────────────────────────────
const extractCommonFields = (text) => {
  const result = { doctorName: '', hospitalName: '', visitDate: '' };

  const doctorLabeled = text.match(/(?:doctor|physician|consultant|surgeon|attending|referred\s+by)\s*[:\-]\s*(?:dr\.?\s*)?([A-Za-z][A-Za-z\s\.]{2,50})/i);
  const doctorStandalone = text.match(/\bdr\.?\s+([A-Z][a-zA-Z\s\.]{2,40})/i);
  const dm = doctorLabeled || doctorStandalone;
  if (dm?.[1]) result.doctorName = dm[1].trim().replace(/\s+/g, ' ').substring(0, 60);

  const hospInline = text.match(/([A-Z][a-zA-Z\s\.&\-]{2,60}(?:hospital|clinic|medical\s+cent(?:er|re)|health\s+care|infirmary|institute|centre|dispensary|laboratory|diagnostics|pathology))/i);
  const hospLabeled = text.match(/(?:hospital|clinic|lab|laboratory|facility|centre|center)\s*[:\-]\s*([A-Za-z][A-Za-z\s\.&,\-]{2,80})/i);
  const hm = hospInline || hospLabeled;
  if (hm?.[1]) result.hospitalName = hm[1].trim().replace(/\s+/g, ' ').substring(0, 80);

  const datePatterns = [
    /(?:date|visit\s+date|dated?|consultation\s+date|report\s+date|test\s+date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
  ];
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m?.[1]) { result.visitDate = m[1].trim(); break; }
  }

  return result;
};

// ── Prescription parser ───────────────────────────────────────────────────────
const parsePrescription = (text) => {
  const common = extractCommonFields(text);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Diagnosis
  let diagnosis = '';
  const diagMatch = text.match(/(?:diagnosis|dx|impression|assessment|condition|chief\s+complaint|presenting\s+complaint)\s*[:\-]\s*([^\n]{3,200})/i);
  if (diagMatch?.[1]) diagnosis = diagMatch[1].trim().substring(0, 200);

  // Medicines — Rx section first
  let medicines = [];
  const rxMatch = text.match(/(?:rx|prescription|medicines?|medications?|drugs?|treatment)\s*[:\-]?\s*([\s\S]{10,1000}?)(?:\n{2,}|notes|advice|instructions|follow|lab|investigation|$)/i);
  if (rxMatch?.[1]) {
    const medLines = rxMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[\d\.\-\*\•\(\)\s]{0,4}/, '').trim())
      .filter((l) => l.length > 2 && l.length < 160 && !/^(date|doctor|hospital|diagnosis|patient|name|age|sex|gender)/i.test(l));

    medicines = medLines.slice(0, 15).map((line) => {
      const full = line.match(/^([A-Za-z][A-Za-z\s\-\/]+?)\s+([\d\.]+\s*(?:mg|ml|mcg|g|iu|units?|tab|cap|syrup)?)\s*((?:once|twice|thrice|\d+\s*times?)[^,\n]*?)?\s*(?:for\s+)?(\d+\s*(?:days?|weeks?|months?))?$/i);
      if (full) return { name: full[1].trim(), dosage: full[2].trim(), frequency: full[3]?.trim() || '', duration: full[4]?.trim() || '' };
      const parts = line.split(/\s{2,}|\t/);
      return { name: parts[0]?.trim() || line, dosage: parts[1]?.trim() || '', frequency: parts[2]?.trim() || '', duration: parts[3]?.trim() || '' };
    });
  }
  // Fallback: scan for dosage patterns
  if (medicines.length === 0) {
    const medCandidates = lines.filter((l) => /\d+\s*(?:mg|ml|mcg|g|tab|cap)/i.test(l) && l.length < 120);
    medicines = medCandidates.slice(0, 10).map((line) => {
      const m = line.match(/^([A-Za-z][A-Za-z\s\-]+?)\s+([\d\.]+\s*(?:mg|ml|mcg|g|tab|cap)[^\s]*)\s*(.*)?$/i);
      return m ? { name: m[1].trim(), dosage: m[2].trim(), frequency: m[3]?.trim() || '', duration: '' }
               : { name: line, dosage: '', frequency: '', duration: '' };
    });
  }

  // Notes
  let notes = '';
  const notesMatch = text.match(/(?:notes?|advice|instructions?|remarks?|follow[\s\-]?up|plan)\s*[:\-]\s*([^\n]{5,600}(?:\n[^\n]{0,300})*)/i);
  if (notesMatch?.[1]) notes = notesMatch[1].trim().substring(0, 600);

  return { ...common, diagnosis, medicines, notes };
};

// ── Lab Report parser ─────────────────────────────────────────────────────────
const parseLabReport = (text) => {
  const common = extractCommonFields(text);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Lab name (may differ from hospital)
  let labName = common.hospitalName;
  const labMatch = text.match(/(?:lab|laboratory|diagnostics|pathology)\s*[:\-]?\s*([A-Za-z][A-Za-z\s\.&]{2,60})/i);
  if (labMatch?.[1]) labName = labMatch[1].trim().substring(0, 80);

  // Patient name
  let patientName = '';
  const patientMatch = text.match(/(?:patient\s+name|name)\s*[:\-]\s*([A-Za-z][A-Za-z\s\.]{2,50})/i);
  if (patientMatch?.[1]) patientName = patientMatch[1].trim().substring(0, 60);

  // Extract test results — look for lines with value + unit + range pattern
  const labTests = [];

  // Pattern: "Test Name   Value   Unit   Normal Range   Status"
  // e.g. "Haemoglobin   13.5   g/dL   12.0-16.0   Normal"
  const testLinePattern = /^([A-Za-z][A-Za-z\s\(\)\/\-\.]{2,50})\s+([\d\.]+)\s*(g\/dL|mg\/dL|mmol\/L|IU\/L|U\/L|%|cells\/μL|10\^3\/μL|mEq\/L|ng\/mL|pg\/mL|μg\/dL|fl|pg|sec|min|[a-zA-Z\/]+)?\s*([\d\.\-\s]+(?:to|–|-)\s*[\d\.]+)?\s*(normal|high|low|positive|negative|reactive|non[\s\-]reactive|borderline)?/i;

  lines.forEach((line) => {
    const m = line.match(testLinePattern);
    if (m && m[2] && parseFloat(m[2]) !== NaN) {
      const value = parseFloat(m[2]);
      const normalRange = m[4]?.trim() || '';
      let status = m[5]?.toLowerCase() || '';

      // Auto-determine status from range if not explicit
      if (!status && normalRange) {
        const rangeParts = normalRange.match(/([\d\.]+)\s*(?:to|–|-)\s*([\d\.]+)/i);
        if (rangeParts) {
          const low = parseFloat(rangeParts[1]);
          const high = parseFloat(rangeParts[2]);
          if (!isNaN(low) && !isNaN(high)) {
            if (value < low) status = 'low';
            else if (value > high) status = 'high';
            else status = 'normal';
          }
        }
      }

      labTests.push({
        testName: m[1].trim(),
        value: m[2].trim(),
        unit: m[3]?.trim() || '',
        normalRange,
        status: status || 'normal',
      });
    }
  });

  // Fallback: look for labeled test results
  if (labTests.length === 0) {
    const testMatches = [...text.matchAll(/([A-Za-z][A-Za-z\s\(\)\/]{3,40})\s*[:\-]\s*([\d\.]+)\s*([a-zA-Z\/μ%]+)?\s*(?:\(?([\d\.\-\s]+(?:to|–|-)\s*[\d\.]+)\)?)?/gi)];
    testMatches.slice(0, 20).forEach((m) => {
      if (m[2] && !isNaN(parseFloat(m[2]))) {
        labTests.push({
          testName: m[1].trim(),
          value: m[2].trim(),
          unit: m[3]?.trim() || '',
          normalRange: m[4]?.trim() || '',
          status: 'normal',
        });
      }
    });
  }

  // Overall impression / conclusion
  let impression = '';
  const impMatch = text.match(/(?:impression|conclusion|summary|remarks?|interpretation)\s*[:\-]\s*([^\n]{5,400}(?:\n[^\n]{0,200})*)/i);
  if (impMatch?.[1]) impression = impMatch[1].trim().substring(0, 400);

  return {
    ...common,
    labName,
    patientName,
    labTests,
    impression,
    diagnosis: impression, // map to diagnosis for unified storage
  };
};

// ── Scan / Radiology parser ───────────────────────────────────────────────────
const parseScanReport = (text) => {
  const common = extractCommonFields(text);

  // Scan type
  let scanType = '';
  const scanTypeMatch = text.match(/(?:type\s+of\s+study|examination|procedure|modality)\s*[:\-]\s*([^\n]{3,80})/i)
    || text.match(/\b(x[\-\s]?ray|ultrasound|sonography|ct\s+scan|mri|ecg|echo(?:cardiogram)?|mammogram|dexa)\b/i);
  if (scanTypeMatch?.[1]) scanType = scanTypeMatch[1].trim().substring(0, 80);

  // Body part / region
  let bodyPart = '';
  const bodyMatch = text.match(/(?:region|area|part|organ|site)\s*[:\-]\s*([^\n]{3,60})/i)
    || text.match(/(?:of\s+the\s+|scan\s+of\s+)([a-z\s]{3,40})/i);
  if (bodyMatch?.[1]) bodyPart = bodyMatch[1].trim().substring(0, 60);

  // Findings
  let findings = '';
  const findingsMatch = text.match(/(?:findings?|observations?|description)\s*[:\-]\s*([\s\S]{10,800}?)(?:\n{2,}|impression|conclusion|$)/i);
  if (findingsMatch?.[1]) findings = findingsMatch[1].trim().substring(0, 800);

  // Impression
  let impression = '';
  const impMatch = text.match(/(?:impression|conclusion|summary|opinion)\s*[:\-]\s*([\s\S]{5,400}?)(?:\n{2,}|$)/i);
  if (impMatch?.[1]) impression = impMatch[1].trim().substring(0, 400);

  // Radiologist
  let radiologist = common.doctorName;
  const radMatch = text.match(/(?:radiologist|reported\s+by|consultant\s+radiologist)\s*[:\-]\s*(?:dr\.?\s*)?([A-Za-z][A-Za-z\s\.]{2,50})/i);
  if (radMatch?.[1]) radiologist = radMatch[1].trim().substring(0, 60);

  return {
    ...common,
    doctorName: radiologist,
    scanType,
    bodyPart,
    findings,
    impression,
    diagnosis: impression || findings.substring(0, 200),
  };
};

// ── Discharge Summary parser ──────────────────────────────────────────────────
const parseDischargeSum = (text) => {
  const common = extractCommonFields(text);

  // Admission date
  let admissionDate = '';
  const admMatch = text.match(/(?:date\s+of\s+admission|admission\s+date|admitted\s+on)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (admMatch?.[1]) admissionDate = admMatch[1].trim();

  // Discharge date
  let dischargeDate = '';
  const disMatch = text.match(/(?:date\s+of\s+discharge|discharge\s+date|discharged\s+on)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (disMatch?.[1]) dischargeDate = disMatch[1].trim();

  // Diagnosis
  let diagnosis = '';
  const diagMatch = text.match(/(?:final\s+diagnosis|diagnosis|primary\s+diagnosis|discharge\s+diagnosis)\s*[:\-]\s*([^\n]{3,300})/i);
  if (diagMatch?.[1]) diagnosis = diagMatch[1].trim().substring(0, 300);

  // Treatment summary
  let treatmentSummary = '';
  const treatMatch = text.match(/(?:treatment\s+given|treatment\s+summary|management|procedure\s+performed|course\s+in\s+hospital)\s*[:\-]\s*([\s\S]{10,800}?)(?:\n{2,}|advice|discharge\s+advice|follow|$)/i);
  if (treatMatch?.[1]) treatmentSummary = treatMatch[1].trim().substring(0, 800);

  // Discharge advice
  let dischargeAdvice = '';
  const advMatch = text.match(/(?:discharge\s+advice|advice\s+on\s+discharge|instructions?\s+on\s+discharge|follow[\s\-]?up)\s*[:\-]\s*([\s\S]{5,600}?)(?:\n{2,}|$)/i);
  if (advMatch?.[1]) dischargeAdvice = advMatch[1].trim().substring(0, 600);

  // Condition at discharge
  let conditionAtDischarge = '';
  const condMatch = text.match(/(?:condition\s+at\s+discharge|patient\s+condition|status\s+at\s+discharge)\s*[:\-]\s*([^\n]{3,100})/i);
  if (condMatch?.[1]) conditionAtDischarge = condMatch[1].trim().substring(0, 100);

  return {
    ...common,
    visitDate: admissionDate || common.visitDate,
    admissionDate,
    dischargeDate,
    diagnosis,
    treatmentSummary,
    dischargeAdvice,
    conditionAtDischarge,
    notes: dischargeAdvice,
  };
};

// ── Medical Bill parser ───────────────────────────────────────────────────────
const parseMedicalBill = (text) => {
  const common = extractCommonFields(text);

  // Total amount
  let totalAmount = '';
  const totalMatch = text.match(/(?:total|grand\s+total|net\s+amount|amount\s+due|total\s+amount)\s*[:\-]?\s*(?:rs\.?|inr|₹|\$)?\s*([\d,\.]+)/i);
  if (totalMatch?.[1]) totalAmount = totalMatch[1].replace(/,/g, '').trim();

  // Bill number
  let billNumber = '';
  const billMatch = text.match(/(?:bill\s+no|invoice\s+no|receipt\s+no)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i);
  if (billMatch?.[1]) billNumber = billMatch[1].trim().substring(0, 40);

  // Line items
  const lineItems = [];
  const itemPattern = /^([A-Za-z][A-Za-z\s\(\)\/\-\.]{3,60})\s+([\d,\.]+)\s*$/gm;
  const matches = [...text.matchAll(itemPattern)];
  matches.slice(0, 20).forEach((m) => {
    const amount = parseFloat(m[2].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      lineItems.push({ description: m[1].trim(), amount: m[2].trim() });
    }
  });

  return {
    ...common,
    billNumber,
    totalAmount,
    lineItems,
    diagnosis: `Bill No: ${billNumber || 'N/A'} | Total: ${totalAmount || 'N/A'}`,
  };
};

// ─── STEP 3: Route to correct parser ─────────────────────────────────────────
const parseByDocumentType = (text, documentType) => {
  switch (documentType) {
    case 'Prescription':       return parsePrescription(text);
    case 'Lab Report':         return parseLabReport(text);
    case 'Scan':               return parseScanReport(text);
    case 'Discharge Summary':  return parseDischargeSum(text);
    case 'Medical Bill':       return parseMedicalBill(text);
    case 'Vaccination':        return parsePrescription(text); // similar structure
    default:                   return parsePrescription(text); // generic fallback
  }
};

// ─── Full OCR pipeline — accepts a buffer + mimetype ─────────────────────────
const runOCR = async (buffer, mimetype, hintType = null) => {
  // Extract raw text from buffer
  const rawText = mimetype === 'application/pdf'
    ? await extractTextFromPDFBuffer(buffer)
    : await extractTextFromImageBuffer(buffer);

  // Detect document type (use hint if provided, e.g. user pre-selected)
  const documentType = hintType && hintType !== 'Other'
    ? hintType
    : detectDocumentType(rawText);

  // Parse structured data based on type
  const structured = parseByDocumentType(rawText, documentType);

  const confidence = rawText.length > 50 ? 'high' : rawText.length > 10 ? 'low' : 'none';

  console.log(`📋 OCR complete: type=${documentType}, confidence=${confidence}, chars=${rawText.length}`);

  return {
    extractedText: rawText,
    documentType,
    ocrConfidence: confidence,
    ...structured,
  };
};

module.exports = {
  runOCR,
  detectDocumentType,
  parseByDocumentType,
  extractTextFromImageBuffer,
  extractTextFromPDFBuffer,
};
