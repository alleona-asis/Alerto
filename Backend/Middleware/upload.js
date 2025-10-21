// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToSupabase, deleteLocalFile } = require('../utils/supabase');
const { v4: uuidv4 } = require('uuid'); 

const PUBLIC_BUCKET = process.env.PUBLIC_BUCKET || 'Alerto-public';
const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET || 'Alerto-private';

// const storage = multer.memoryStorage();

// Map fields to subfolders
const FIELD_TO_FOLDER = {
  idFile: 'id',
  intentFile: 'letter',
  idImage: 'mobile',
  selfieTaken: 'selfie',
  image: 'ocr',
  picture: 'profile',
  images: 'announcements', // public bucket
  default: 'other'
};

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

// Storage for private files (private bucket)
const privateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/other';  // Default folder

    // Dynamic folder logic based on fieldname
    switch (file.fieldname) {
      case 'idFile':
        folder = 'uploads/id';
        break;
      case 'intentFile':
        folder = 'uploads/letter';
        break;
      case 'idImage':
        folder = 'uploads/mobile';  // For mobile ID uploads
        break;
      case 'selfieTaken':
        folder = 'uploads/selfie';  // For mobile user selfie pictures
        break;
      case 'image':
        folder = 'uploads/ocr';  // OCR-specific images
        break;
      case 'picture':
        folder = 'uploads/profile';  // For mobile user profile pictures
        break;
      case 'media':
        folder = 'uploads/reports';  // For report submissions
        break;
      case 'proof':
        folder = 'uploads/proof';
        break;
      // Add more cases as needed (e.g., 'proofFile': folder = 'uploads/proof';)
      default:
        folder = 'uploads/other';  // Fallback for unmatched fields
    }

    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter to allow specific mimetypes per field (unchanged)
const fileFilter = (req, file, cb) => {
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

  switch (file.fieldname) {
    case 'idFile':
      if (allowedImageTypes.includes(file.mimetype)) return cb(null, true);
    case 'selfieTaken':
      if (allowedImageTypes.includes(file.mimetype)) return cb(null, true);
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
    case 'media':  // For report submissions
      if (
        allowedImageTypes.includes(file.mimetype) ||  // Allow images
        allowedVideoTypes.includes(file.mimetype)    // Allow videos if needed
      ) return cb(null, true);  // You can add docs if reports support them
      break;
    case 'picture':
      if (allowedImageTypes.includes(file.mimetype)
      ) return cb(null, true);
      break;
     case 'proof':  // <-- ADD THIS: Allow images/docs for proof uploads
      if (allowedImageTypes.includes(file.mimetype) ||
          allowedDocTypes.includes(file.mimetype) || 
          allowedVideoTypes.includes(file.mimetype)
      ) return cb(null, true);
      break;
    case 'files':
      if (allowedImageTypes.includes(file.mimetype) ||
          allowedDocTypes.includes(file.mimetype) ||
          allowedVideoTypes.includes(file.mimetype)
      ) return cb(null, true);
      break;
    default:
      cb(new Error(`Unsupported field: ${file.fieldname}`));
  }
  cb(new Error(`Unsupported file type for field ${file.fieldname}: ${file.mimetype}`));
};


// Multer upload instances (unchanged)
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
    // Decide subfolder from fieldname
    const folder = FIELD_TO_FOLDER[field.name] || FIELD_TO_FOLDER.default;
    const relativePath = `${folder}/${f.filename}`;

    // Bucket selection
    let bucketName = PRIVATE_BUCKET;
    let isPublic = false;
    if (field.name === 'images' && isAnnouncement) {
      bucketName = PUBLIC_BUCKET;
      isPublic = true;
    }

    let url = null;
    try {
      url = await uploadToSupabase(f.path, relativePath, bucketName, isPublic);
    } catch (uploadErr) {
      console.error(`[UPLOAD] Supabase upload failed for ${relativePath}:`, uploadErr.message);
      return next(uploadErr);
    }

    // Clean up local file
    deleteLocalFile(f.path);

    // Save in req.supabaseFiles
    if (!req.supabaseFiles[field.name]) req.supabaseFiles[field.name] = [];
    req.supabaseFiles[field.name].push({
      supabaseUrl: url,
      isPublic,
      relativePath
    });
  }
}

        // for (const field of fields) {
          
          const files = req.files[field.name];
          if (!files) continue;
          for (const f of files) {
            const localPath = path.join(f.destination, f.filename);
                        
            // Determine bucket and relative path
            let bucketName = isAnnouncement ? PUBLIC_BUCKET : PRIVATE_BUCKET;
            let relativePath;
            let isPublic = isAnnouncement;
            if (isAnnouncement) {
              relativePath = `announcements/${f.filename}`;  // Public bucket: announcements/
            } else {
              // Private bucket: Dynamic path under uploads/ (e.g., uploads/reports/filename.jpg)
              relativePath = path.join(f.destination, f.filename);  // f.destination is 'uploads/subfolder', so this gives 'uploads/subfolder/filename'
            }

                        // Upload to Supabase (returns signed URL if private)
            let supabaseUrl = await uploadToSupabase(localPath, relativePath, bucketName, isPublic);
            // Delete local file
            deleteLocalFile(localPath);
            if (!req.supabaseFiles[field.name]) req.supabaseFiles[field.name] = [];
            req.supabaseFiles[field.name].push({
              field: field.name,
              supabaseUrl,    // This is the signed URL for private or public URL for announcements
              relativePath,
              filename: f.filename,
              isPublic,
              mimetype: f.mimetype
            });
          }
        }
        //   const files = req.files[field.name];
        //   if (!files) continue;
        //   for (const f of files) {

        //     const localPath = path.join(f.destination, f.filename);
        //     const relativePath = path.relative('uploads', localPath).replace(/\\/g, '/');
            
        //     // Determine bucket and public/private flag using env vars
        //     let bucketName = PRIVATE_BUCKET;
        //     let isPublic = false;

        //    if (field.name === 'images' && isAnnouncement) {
        //       bucketName = PUBLIC_BUCKET;
        //       isPublic = true;
        //     }
        //     let url = null;
        //     try {
        //       url = await uploadToSupabase(localPath, relativePath, bucketName, isPublic);
        //     } catch (uploadErr) {
        //       console.error(`[UPLOAD] Supabase upload failed for ${relativePath}:`, uploadErr.message);
        //       return next(uploadErr);
        //     }
        //     // Delete local file after successful upload
        //     deleteLocalFile(localPath);

        //     if (!req.supabaseFiles[field.name]) req.supabaseFiles[field.name] = [];
        //     req.supabaseFiles[field.name].push({
        //       // localPath: `/uploads/${relativePath}`,
        //       supabaseUrl: url,
        //       isPublic,
        //       relativePath
        //     });
        //   }
        // }
        next();
      } catch (e) {
        console.error('[UPLOAD] Fatal Supabase sync error:', e.message);
        next(e);
      }
    });
  };
}

module.exports = { uploadWithSupabase, uploadPrivate, uploadAnnouncements };
