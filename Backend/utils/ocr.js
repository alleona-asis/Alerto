//utils/ocr.js
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fuzzball = require('fuzzball');

const ID_KEYWORDS = {
  passport: ['passport', 'republic', 'travel document'],
  driver_license: ['driver', 'license', 'dl no', 'lto'],
  national_id: ['national id', 'psa', 'philsys', 'Pagkakakilanlan'],
  philhealth: ['philhealth', 'pin'],
  student_id: ['student', 'school', 'university', 'college'],
};

function cleanText(rawText) {
  return rawText
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .replace(/[^a-zA-Z0-9\s:\-.,\/]/g, '')
    .trim();
}

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

  return bestScore >= 70
    ? { matched: true, keyword: bestMatch, score: bestScore }
    : { matched: false, keyword: null, score: bestScore };
}

async function processOCRLocalFile(localPath, idType) {
  if (!idType || !ID_KEYWORDS[idType]) {
    throw new Error('Invalid or missing ID type');
  }

  const processedBuffer = await sharp(localPath)
    .grayscale()
    .normalize()
    .resize({ width: 1000 })
    .png()
    .toBuffer();

  const { data: { text: rawText = '' } } = await Tesseract.recognize(processedBuffer, 'eng', {
    logger: m => console.log('[OCR] progress:', m.status, m.progress)
  });

  const cleanedText = cleanText(rawText);
  const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

  console.log('[OCR] cleaned text length:', cleanedText.length);
  console.log('[OCR] match:', { matched, keyword, score });

  return {
    ocrResult: cleanedText,
    matched,
    matchedKeyword: keyword,
    matchScore: score
  };
}



module.exports = {
  cleanText,
  fuzzyMatchKeywords,
  ID_KEYWORDS,
  processOCRLocalFile,
  
};
