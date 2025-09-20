// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToSupabase, deleteLocalFile } = require('../utils/supabase');

// Storage for announcements (public bucket)
const announcementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/announcements';
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
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
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
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
            const relativePath = path.relative('uploads', localPath).replace(/\\/g, '/');

            // Determine bucket and public/private flag
            let bucket = 'uploads-private';
            let isPublic = false;

            if (field.name === 'images' && isAnnouncement) {
              bucket = 'uploads-public';
              isPublic = true;
            }

           let url = null;
            try {
              url = await uploadToSupabase(localPath, relativePath, bucket, isPublic);
            } catch (uploadErr) {
              console.error(`[UPLOAD] Supabase upload failed for ${relativePath}:`, uploadErr.message);
              // Optionally: return error or continue with local file only
              return next(uploadErr);
            }

            // Delete local file after successful upload
            deleteLocalFile(localPath);

            if (!req.supabaseFiles[field.name]) req.supabaseFiles[field.name] = [];
            req.supabaseFiles[field.name].push({
              localPath: `/uploads/${relativePath}`,
              supabaseUrl: url,
              isPublic
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
