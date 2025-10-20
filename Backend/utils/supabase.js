// utils/supabase.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const mime = require('mime-types');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PUBLIC_BUCKET = process.env.PUBLIC_BUCKET;   // 'Alerto-public'
const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET; // 'Alerto-private'


/**
 * Upload file buffer to Supabase storage bucket
 * @param {string} localPath - local file path on disk
 * @param {string} relativePath - path/key inside the bucket
 * @param {string} bucketName - bucket name to upload to
 * @param {boolean} isPublic - if true, return public URL; else return private URL or path
 * @returns {string} URL of uploaded file
 */

async function uploadToSupabase(localPath, relativePath, bucketName, isPublic) {

const bucket = bucketName || (isPublic ? PUBLIC_BUCKET : PRIVATE_BUCKET);

  // Read file buffer from localPath
  const fileBuffer = await fs.promises.readFile(localPath);

  // Detect content type from file extension
  const contentType = mime.lookup(localPath) || undefined;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(relativePath, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  // Return public URL if public bucket
  if (isPublic) {
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(relativePath);
    return publicUrlData.publicUrl;
  }

  // For private bucket, you can generate a signed URL or return a path
  // Here, returning a path placeholder; adjust as needed
  return `/storage/v1/object/public/${bucket}/${relativePath}`;
}

/**
 * Delete local file after upload
 * @param {string} localPath - local file path to delete
 */
function deleteLocalFile(localPath) {
  fs.unlink(localPath, (err) => {
    if (err) console.error(`Failed to delete local file ${localPath}:`, err);
  });
}

async function generateSignedUrl(relativePath, expiresInSeconds = 3600 * 24 * 7) {
  try {
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(relativePath, expiresInSeconds);
    if (error) {
      console.error('Supabase createSignedUrl error:', error);
      throw error;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    throw err;
  }
}


module.exports = { uploadToSupabase, deleteLocalFile, generateSignedUrl };
