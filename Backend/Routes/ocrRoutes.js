/*
const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fuzzball = require('fuzzball');

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' });

// Keywords map
const ID_KEYWORDS = {
  passport: ['passport', 'republic', 'travel document'],
  driver_license: ['driver', 'license', 'dl no', 'lto'],
  national_id: ['national id', 'psa', 'philsys'],
  philhealth: ['philhealth', 'pin'],
  student_id: ['student', 'school', 'university', 'college'],
};

// Clean raw OCR text
function cleanText(rawText) {
  return rawText
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .replace(/[^a-zA-Z0-9\s:\-.,\/]/g, '')
    .trim();
}

// Fuzzy match logic
function fuzzyMatchKeywords(text, idType) {
  if (!ID_KEYWORDS[idType]) return { matched: false, keyword: null };

  const cleaned = text.toLowerCase();
  const keywords = ID_KEYWORDS[idType];

  let bestMatch = null;
  let bestScore = 0;

  keywords.forEach(keyword => {
    const score = fuzzball.partial_ratio(keyword.toLowerCase(), cleaned);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = keyword;
    }
  });

  return bestScore >= 70 // you can adjust this threshold
    ? { matched: true, keyword: bestMatch, score: bestScore }
    : { matched: false, keyword: null, score: bestScore };
}

// POST /api/ocr
router.post('/', upload.single('image'), async (req, res) => {
  const idType = req.body.idType;

  if (!idType || !ID_KEYWORDS[idType]) {
    return res.status(400).json({ error: 'Invalid or missing ID type' });
  }

  try {
    const originalPath = req.file.path;
    const processedPath = path.join('uploads/temp/', `processed_${Date.now()}.png`);

    await sharp(originalPath)
      .grayscale()
      .normalize()
      .resize({ width: 1000 })
      .toFile(processedPath);

    const { data: { text: rawText } } = await Tesseract.recognize(processedPath, 'eng', {
      logger: m => console.log('🧠 OCR Progress:', m),
    });

    const cleanedText = cleanText(rawText);
    const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

    // Clean up files
    fs.unlinkSync(originalPath);
    fs.unlinkSync(processedPath);

    return res.json({
      text: cleanedText,
      matched,
      matchedKeyword: keyword,
      matchScore: score, // 🔍 show how close the match was
    });

  } catch (error) {
    console.error('❌ OCR failed:', error);
    res.status(500).json({ error: 'OCR processing failed' });
  }
});

module.exports = router;
*/