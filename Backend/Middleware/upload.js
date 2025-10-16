// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToSupabase, deleteLocalFile } = require('../utils/supabase');
const { v4: uuidv4 } = require('uuid'); 

const PUBLIC_BUCKET = process.env.PUBLIC_BUCKET || 'Alerto-public';
const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET || 'Alerto-private';

// const storage = multer.memoryStorage();

// Storage for announcements (public bucket)
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

// Storage for sensitive files (private bucket)
const privateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/private';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter to allow specific mimetypes per field
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  const allowedDocTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime'];


  switch (file.fieldname) {
    case 'idFile':
    case 'selfieTaken':
    case 'idImage':
      if (allowedImageTypes.includes(file.mimetype)) return cb(null, true);
      break;
    case 'intentFile':
      if (allowedDocTypes.includes(file.mimetype)) return cb(null, true);
      break;
    case 'images':
      // Allow images, videos, docs for announcements
      if (
        allowedImageTypes.includes(file.mimetype) ||
        allowedDocTypes.includes(file.mimetype) ||
        allowedVideoTypes.includes(file.mimetype)
      ) return cb(null, true);
      break;
    case 'media':  // NEW CASE for report submissions
      if (
        allowedImageTypes.includes(file.mimetype) ||  // Allow images
        allowedVideoTypes.includes(file.mimetype)    // Allow videos if needed
      ) return cb(null, true);  // You can add docs if reports support them
      break;
    default:
      cb(new Error(`Unsupported field: ${file.fieldname}`));
  }
  cb(new Error(`Unsupported file type for field ${file.fieldname}: ${file.mimetype}`));
};


// Multer upload instances
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

function uploadWithSupabase(fields, isAnnouncement = false) {
  const handler = isAnnouncement ? uploadAnnouncements.fields(fields) : uploadPrivate.fields(fields);

  return (req, res, next) => {
    handler(req, res, async (err) => {
      if (err) 
        return next(err);

      try {
        req.supabaseFiles = {};

        for (const field of fields) {
          
          const files = req.files[field.name];
          if (!files) continue;
          for (const f of files) {

            const localPath = path.join(f.destination, f.filename);
            const relativePath = `private/${f.filename}`;            
            // Determine bucket and public/private flag using env vars
            let bucketName = PRIVATE_BUCKET;
            let isPublic = false;

           if (field.name === 'images' && isAnnouncement) {
              bucketName = PUBLIC_BUCKET;
              isPublic = true;
            }
            let url = null;
            try {
              url = await uploadToSupabase(localPath, relativePath, bucketName, isPublic);
            } catch (uploadErr) {
              console.error(`[UPLOAD] Supabase upload failed for ${relativePath}:`, uploadErr.message);
              return next(uploadErr);
            }
            // Delete local file after successful upload
            deleteLocalFile(localPath);

            if (!req.supabaseFiles[field.name]) req.supabaseFiles[field.name] = [];
            req.supabaseFiles[field.name].push({
              // localPath: `/uploads/${relativePath}`,
              field: field.name,
              supabaseUrl: url,
              isPublic,
              relativePath
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
