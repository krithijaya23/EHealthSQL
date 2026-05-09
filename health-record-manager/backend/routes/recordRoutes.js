const express = require('express');
const router = express.Router();
const {
  ocrExtract, uploadRecord, getRecords, getRecord,
  downloadRecord, updateRecord, deleteRecord,
} = require('../controllers/recordController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.post('/ocr-extract', upload.single('file'), ocrExtract);
router.post('/upload', upload.single('file'), uploadRecord);

router.get('/',              getRecords);
router.get('/detail/:id',    getRecord);
router.get('/detail/:id/download', downloadRecord);
router.put('/:id',           updateRecord);
router.delete('/:id',        deleteRecord);

module.exports = router;
