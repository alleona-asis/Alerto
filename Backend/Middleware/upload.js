const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToSupabase, deleteLocalFile } = require('../utils/supabase');
const { v4: uuidv4 } = require('uuid'); 

const PUBLIC_BUCKET = process.env.PUBLIC_BUCKET || 'Alerto-public';
const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET || 'Alerto-private';

const ensureDir = dir => fs.mkdirSync(dir, { recursive: true });
const posixJoin = (...p) => p.join('/').replace(/\\/g, '/');

// Storage for announcements (in public bucket)
const announcementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/announcements';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Storage for private files (in private bucket)
const privateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/other';  

    switch (file.fieldname) {
      case 'idFile':
        folder = 'uploads/id'; //lgu id uploads
        break;
      case 'intentFile':
        folder = 'uploads/letter'; //lgu letter uploads
        break;
      case 'idImage':
        folder = 'uploads/mobile';  // for mobile ID uploads
        break;
      case 'selfieTaken':
        folder = 'uploads/selfie';  // for mobile user selfie pictures
        break;
      case 'selfie':
        folder = 'uploads/selfie'; // for mobile user selfie pictures
        break
      case 'image':
        folder = 'uploads/ocr';  // OCR-specific images
        break;
      case 'picture':
        folder = 'uploads/profile';  // for mobile user profile pictures
        break;
      case 'media':
        folder = 'uploads/reports';  // for report submissions
        break;
      case 'proof':
        folder = 'uploads/proof'; // for proof submission
        break;
      case 'officialImage':
        folder = 'uploads/officials'; //for barangay official upload
        break;
      default:
        folder = 'uploads/other';  // fallback for unmatched fields
    }

    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => 
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`
  )

});

  const allowedImageTypes = [
    'image/png', 
    'image/jpeg', 
    'image/jpg', 
    'image/webp', 
    'image/heic', 
    'image/heif'
  ];
  const allowedDocTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const allowedVideoTypes = [
    'video/mp4', 
    'video/mpeg', 
    'video/quicktime',
    'video/3gpp', 
    'video/3gpp2', 
    'video/webm', 
    'video/x-matroska'
  ];

  // File filter to allow specific types per field
const fileFilter = (req, file, cb) => {
  const ok = (types) => types.includes(file.mimetype);

  let pass = false;

  switch (file.fieldname) {
    case 'idFile':
        pass = ok(allowedImageTypes);
      break;
    case 'selfieTaken':
        pass = ok(allowedImageTypes);
      break;
    case 'selfie':
        pass = ok(allowedImageTypes);
      break;
    case 'idImage':
        pass = ok(allowedImageTypes);
      break;
    case 'intentFile':
        pass = ok(allowedDocTypes);
      break;
    case 'images':
      pass = ok(allowedImageTypes) || ok(allowedDocTypes) || ok(allowedVideoTypes);
      break;
    case 'media':
      pass = ok(allowedImageTypes) || ok(allowedVideoTypes);
      break;
    case 'picture':
        pass = ok(allowedImageTypes);
      break;
     case 'proof': 
       pass = ok(allowedImageTypes) || ok(allowedDocTypes) || ok(allowedVideoTypes);
      break;
    case 'files':
      pass = ok(allowedImageTypes) || ok(allowedDocTypes) || ok(allowedVideoTypes);
      break;
    case 'officialImage':
      pass = ok(allowedImageTypes);
      break;
    default:
       return cb(new Error(`Unsupported field: ${file.fieldname}`));
  }
    if (!pass) return cb(new Error(`Unsupported file type for field ${file.fieldname}: ${file.mimetype}`));
      return cb(null, true);
};


const uploadPrivate = multer({
  storage: privateStorage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit for private files
});
const uploadAnnouncements = multer({
  storage: announcementStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for announcements
});


function uploadWithSupabase(fields, isAnnouncement = false, options = {}) {
  const { skipDeleteFor = [] } = options;  
  const handler = isAnnouncement ? uploadAnnouncements.fields(fields) : uploadPrivate.fields(fields);

  return (req, res, next) => {
    handler(req, res, async (err) => {
      console.log('[MULTER] CT:', req.headers['content-type']);
      console.log('[MULTER] files keys:', Object.keys(req.files || {}));

      if (err) return next(err);

      try {
        req.supabaseFiles = {};

        for (const field of fields) {
          const files = (req.files && req.files[field.name]) || [];
          if (!files.length) continue;

          for (const f of files) {
            const localPath = path.join(f.destination, f.filename);

            let bucketName = isAnnouncement ? PUBLIC_BUCKET : PRIVATE_BUCKET;
            let isPublic   = !!isAnnouncement;
            let relativePath;

            if (f.fieldname === 'picture') {
              const userId = (req.params && req.params.id) ? String(req.params.id) : 'unknown';
              bucketName = PUBLIC_BUCKET;
              isPublic = true;
              relativePath = posixJoin('profile', `userID:${userId}`, f.filename);
            } else if (f.fieldname === 'officialImage') {
              bucketName = PUBLIC_BUCKET;         
              isPublic   = true;
              relativePath = posixJoin('officials', f.filename);
            } 
            else if (isAnnouncement) {
              relativePath = posixJoin('announcements', f.filename);
            } else {
              relativePath = posixJoin(f.destination, f.filename);
            }

            console.log('[UPLOAD] → Supabase', {
              field: f.fieldname,
              bucket: bucketName,
              relativePath,
              isPublic,
              mimetype: f.mimetype
            });

            // Upload to Supabase (returns public URL if public, signed URL if private)
            const supabaseUrl = await uploadToSupabase(localPath, relativePath, bucketName, isPublic);

            // Delete local file unless explicitly skipped
            if (!skipDeleteFor.includes(f.fieldname)) {
              deleteLocalFile(localPath);
            }

            if (!req.supabaseFiles[field.name]) req.supabaseFiles[field.name] = [];
            req.supabaseFiles[field.name].push({
              field: field.name,
              supabaseUrl,
              relativePath,  
              filename: f.filename,
              isPublic,
              mimetype: f.mimetype,
              localPath  
            });

            console.log('[UPLOAD] Stored:', {
              field: field.name,
              isPublic,
              relativePath,
              url: supabaseUrl
            });
          }
        }

        next();
      } catch (e) {
        console.error('[UPLOAD] Fatal Supabase sync error:', e.message);
        next(e);
      }
    });
  };
}

module.exports = { uploadWithSupabase, uploadPrivate, uploadAnnouncements };
