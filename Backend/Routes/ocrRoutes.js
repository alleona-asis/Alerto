const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');

const { processOCRLocalFile, ID_KEYWORDS } = require('../utils/ocr');

const upload = multer({ dest: 'uploads/temp/' });

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const idType = req.body.idType || req.body.id_type;
    if (!idType || !ID_KEYWORDS[idType]) {
      return res.status(400).json({ error: 'Invalid or missing ID type' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    console.log('[OCR] start', {
      idType,
      tempPath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const result = await processOCRLocalFile(req.file.path, idType);

    await fs.promises.unlink(req.file.path).catch(() => {});
    console.log('[OCR] done', {
      matched: result.matched,
      matchedKeyword: result.matchedKeyword,
      matchScore: result.matchScore,
      textLen: result.ocrResult?.length || 0
    });

    return res.json({
      message: 'OCR processed successfully',
      text: result.ocrResult,
      matched: result.matched,
      matchedKeyword: result.matchedKeyword,
      matchScore: result.matchScore
    });
  } catch (error) {
    console.error('[OCR] failed:', error);
    return res.status(500).json({ error: 'OCR processing failed' });
  }
});

module.exports = router;
