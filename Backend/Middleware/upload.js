// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = '';

    if (file.fieldname === 'idFile') {
      folder = 'uploads/id';
    } else if (file.fieldname === 'intentFile') {
      folder = 'uploads/letter';
    }

    fs.mkdirSync(folder, { recursive: true });
    console.log(`[UPLOAD] Saving ${file.originalname} to ${folder}`);
    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const idMimeTypes = ['image/png', 'image/jpeg'];
  const intentMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (file.fieldname === 'idFile' && idMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === 'intentFile' && intentMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn(`[UPLOAD] Invalid file type: ${file.originalname} (${file.mimetype})`);
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

module.exports = upload;
