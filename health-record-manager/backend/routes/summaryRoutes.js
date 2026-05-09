const express = require('express');
const router = express.Router();
const { getHealthSummary, getSharedSummary } = require('../controllers/summaryController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getHealthSummary);
router.get('/shared/:ownerUserId', getSharedSummary);

module.exports = router;
