// utils/supabase.js, for uploading to supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const mime = require('mime-types');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

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

  // const { data, error } = await supabase.storage
  //   .from(bucket)
  //   .upload(relativePath, fileBuffer, {
  //     cacheControl: '3600',
  //     upsert: false,
  //     contentType,
  //   });

  // if (error) {
  //   throw new Error(`Supabase upload error: ${error.message}`);
  // }

    // Upsert=true to avoid duplicate key failures on retries
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(relativePath, fileBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType,
        });

      if (upErr) {
        throw new Error(`Supabase upload error: ${upErr.message}`);
      }


  // Return public URL if public bucket
    if (isPublic) {
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(relativePath);
    return publicUrlData.publicUrl;
  } else {
    // For private buckets, return a signed URL instead of a public placeholder
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(relativePath,  60 * 60 * 24 * 7) // 7 days validity

    if (error) throw new Error(`Supabase signed URL error: ${error.message}`);
    return data.signedUrl;
  }
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

/**
 * Re-generate a signed URL for a private object (reports media, id verification, and the like)
 */
async function generateSignedUrl(relativePath, expiresInSeconds = 3600 * 24 * 7) { //7 days validity
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

function getPublicUrl(relativePath) {
  const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(relativePath);
  return data?.publicUrl || null;
}

module.exports = { uploadToSupabase, deleteLocalFile, generateSignedUrl, getPublicUrl };
