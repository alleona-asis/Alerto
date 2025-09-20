// utils/supabase.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Upload file buffer to Supabase storage bucket
 * @param {string} localPath - local file path
 * @param {string} fileName - path in bucket
 * @param {string} bucket - bucket name
 * @param {boolean} isPublic - if true, return public URL; else signed URL
 */
async function uploadToSupabase(localPath, fileName, bucket = 'uploads-private', isPublic = false) {
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage.from(bucket).upload(fileName, fileBuffer, {
    cacheControl: '3600',
    upsert: false
  });

  if (error) throw error;

  if (isPublic) {
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
  } else {
    const { data, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 60 * 60); // 1 hour expiry
    if (signedError) throw signedError;
    return data.signedUrl;
  }
}

/**
 * Delete local file after upload
 */
function deleteLocalFile(localPath) {
  fs.unlink(localPath, (err) => {
    if (err) console.error(`Failed to delete local file ${localPath}:`, err);
  });
}

module.exports = { uploadToSupabase, deleteLocalFile };
