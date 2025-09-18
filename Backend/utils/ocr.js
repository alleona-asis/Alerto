const fuzzball = require('fuzzball');

const ID_KEYWORDS = {
  passport: ['passport', 'republic', 'travel document'],
  driver_license: ['driver', 'license', 'dl no', 'lto'],
  national_id: ['national id', 'psa', 'philsys'],
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

module.exports = {
  cleanText,
  fuzzyMatchKeywords,
  ID_KEYWORDS,
};
