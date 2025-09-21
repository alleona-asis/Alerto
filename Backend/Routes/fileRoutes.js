// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { generateSignedUrl } = require('../utils/supabase');


router.get('/signed-url', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath query parameter is required' });
    }

    const signedUrl = await generateSignedUrl(filePath, 3600); // 1 hour expiry

    // Disable caching for this response
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    
    return res.json({ signedUrl });
  } catch (err) {
    console.error('Signed URL endpoint error:', err);
    return res.status(500).json({ error: 'Failed to create signed URL' });
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
