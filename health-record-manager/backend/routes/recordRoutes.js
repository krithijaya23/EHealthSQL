const express = require('express');
const router = express.Router();
const {
  ocrExtract, uploadRecord, getRecords, getRecord,
  downloadRecord, updateRecord, deleteRecord,
} = require('../controllers/recordController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

// OCR-only: upload file, extract structured data, return without saving
router.post('/ocr-extract', upload.single('file'), ocrExtract);

// Save record (extracted data only — no file stored)
router.post('/upload', upload.single('file'), uploadRecord);

router.get('/detail/:id', getRecord);
router.get('/detail/:id/download', downloadRecord);
router.get('/:profileId', getRecords);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

module.exports = router;
