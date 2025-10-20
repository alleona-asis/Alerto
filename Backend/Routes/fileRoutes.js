// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { generateSignedUrl } = require('../utils/supabase');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.get('/signed-url', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    // Clean the path: Remove the bucket name prefix (e.g., 'Alerto-private/') to get the relative path
    const bucketName = 'Alerto-private';  // Your bucket name from logs
    const cleanPath = filePath.replace(new RegExp(`^${bucketName}/`), '');  // Results in 'uploads/72839.jpg'
    console.log(`Generating signed URL for cleaned path: ${cleanPath}`);  // For debugging
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(cleanPath, 3600);  // 1-hour expiry; adjust as needed
    if (error) {
      console.error('Supabase createSignedUrl error:', error);
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }

    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    console.error('Signed URL endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;


// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_KEY
// );

// router.get('/signed-url', async (req, res) => {
//   try {
//     const { filePath } = req.query;
//     if (!filePath) {
//       return res.status(400).json({ error: 'filePath query parameter is required' });
//     }

//     const { data, error } = await supabase.storage
//       .from('Alerto-private')
//       .createSignedUrl(filePath, 3600); // 1 hour expiry

//     if (error) {
//       console.error('Error creating signed URL:', error.message);
//       return res.status(500).json({ error: 'Failed to create signed URL' });
//     }

//     return res.json({ signedUrl: data.signedUrl });
//   } catch (err) {
//     console.error('Signed URL endpoint error:', err.message);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// });

// module.exports = router;
