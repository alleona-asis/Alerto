//utils/ocr.js
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fuzzball = require('fuzzball');
const fs = require('fs');

const ID_KEYWORDS = {
  passport: [
    'passport', 
    'republic', 
    'travel document'
  ],
  driver_license: [
    'driver', 
    'license',
    'republic of the philippines', 
    'dl no', 
    'land transportation office',
    'transportation'
  ],
  national_id: [
    'national id', 
    'psa', 'philsys', 
    'Pagkakakilanlan', 
    'republic of the philippines',
    'republika ng pilipinas', 
    'philippine identification card',
    'sex', 
    'date of birth', 
    'id number',
    'psa'
  ],
  philhealth: [
    'philhealth',
    'republic of the philippines', 
    'pin',
    'philippine health insurance corporation',
    'insurance',
    'certification'
  ],
  student_id: [
    'student', 
    'school', 
    'university', 
    'college'
  ],
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


async function preprocess(buf) {
  return await sharp(buf)
    .rotate()              // EXIF rotation
    .grayscale()
    .normalize()
    .threshold(180)        // binarize
    .resize({ width: 1400, withoutEnlargement: false })
    .toBuffer();
}

async function recognizeBestAngle(buf, lang = 'eng+fil') {
  const angles = [0, 90, 180, 270];
  let best = { text:'', score: -1 };

  for (const a of angles) {
    const pre = await sharp(buf).rotate(a).toBuffer().then(preprocess);
    const { data: { text = '' } } = await Tesseract.recognize(pre, lang, {
    });
    const cleaned = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const score = cleaned.length; // simple heuristic: more text == better
    if (score > best.score) best = { text: cleaned, score };
  }
  return best;
}

async function processOCRLocalFile(localPath, idType) {
  const buf = await fs.promises.readFile(localPath);

  const { text, score } = await recognizeBestAngle(buf, 'eng+fil'); 

  const { matched, keyword, matchScore } = fuzzyMatchKeywords(text, idType);

  return { 
    ocrResult: text, 
    matched, 
    matchedKeyword: keyword, 
    matchScore: Math.max(matchScore, score) 
  };
}


// async function processOCRLocalFile(localPath, idType) {
//   if (!idType || !ID_KEYWORDS[idType]) {
//     throw new Error('Invalid or missing ID type');
//   }

//   const processedBuffer = await sharp(localPath)
//     .grayscale()
//     .normalize()
//     .resize({ width: 1000 })
//     .png()
//     .toBuffer();

//   const { data: { text: rawText = '' } } = await Tesseract.recognize(processedBuffer, 'eng', {
//     logger: m => console.log('[OCR] progress:', m.status, m.progress)
//   });

//   const cleanedText = cleanText(rawText);
//   const { matched, keyword, score } = fuzzyMatchKeywords(cleanedText, idType);

//   console.log('[OCR] cleaned text length:', cleanedText.length);
//   console.log('[OCR] match:', { matched, keyword, score });

//   return {
//     ocrResult: cleanedText,
//     matched,
//     matchedKeyword: keyword,
//     matchScore: score
//   };
// }



module.exports = {
  cleanText,
  fuzzyMatchKeywords,
  ID_KEYWORDS,
  processOCRLocalFile,
  
};
